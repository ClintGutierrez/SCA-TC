import test from 'node:test';
import assert from 'node:assert/strict';
import { responderError } from '../utils/errores.js';
import { getBienes } from '../controllers/bienesController.js';
import { createMantenimiento } from '../controllers/mantenimientoController.js';
import { getReporteInventario } from '../controllers/reportesController.js';
import { getAuditoria } from '../controllers/auditoriaController.js';
import { me } from '../controllers/authController.js';

const response = () => ({
  statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const SECRETO = 'relation "usuarios_secretos" column password_hash violates constraint';
const pgError = (code) => Object.assign(new Error(SECRETO), { code });

test('errores: un error inesperado responde 500 genérico sin exponer el mensaje', (t) => {
  t.mock.method(console, 'error', () => {});
  const res = response();
  responderError(res, pgError(undefined), 'prueba');
  assert.equal(res.statusCode, 500);
  assert.doesNotMatch(JSON.stringify(res.body), /usuarios_secretos|password_hash/);
  assert.equal(console.error.mock.callCount(), 1, 'El detalle se registra en el servidor');
});

test('errores: los errores de datos de PostgreSQL se traducen a 400/409 con mensajes seguros', (t) => {
  t.mock.method(console, 'error', () => {});
  for (const [code, status] of [['22P02', 400], ['22007', 400], ['23502', 400], ['23514', 400], ['23503', 409], ['23505', 409]]) {
    const res = response();
    responderError(res, pgError(code), 'prueba');
    assert.equal(res.statusCode, status, code);
    assert.doesNotMatch(res.body.error, /usuarios_secretos|password_hash/);
  }
  assert.equal(console.error.mock.callCount(), 0, 'Los errores de datos del cliente no ensucian el registro');
});

test('errores: los controladores no devuelven mensajes internos de la BD', async (t) => {
  t.mock.method(console, 'error', () => {});
  // Como en la librería postgres, la consulta solo se ejecuta (y falla) al esperarla;
  // así los fragmentos sql`...` que se componen sin await no generan rechazos sueltos.
  const lazyFailure = () => ({ then: (resolve, reject) => Promise.reject(pgError(undefined)).then(resolve, reject) });
  const failing = Object.assign(() => lazyFailure(), { begin: async () => { throw pgError(undefined); } });
  const cases = [
    (res) => getBienes({ query: {} }, res, failing),
    (res) => getReporteInventario({}, res, failing),
    (res) => getAuditoria({ query: {} }, res, failing),
    (res) => me({ user: { sub: 7 } }, res, failing),
    (res) => createMantenimiento({ body: {} }, res, failing),
  ];
  for (const run of cases) {
    const res = response();
    await run(res);
    assert.equal(res.statusCode, 500);
    assert.doesNotMatch(JSON.stringify(res.body), /usuarios_secretos|password_hash/);
  }
});

test('errores: un ID mal formado en mantenimiento responde 400, no 500', async () => {
  const res = response();
  await createMantenimiento({ body: { bienId: 'abc' } }, res, async () => { throw pgError('22P02'); });
  assert.equal(res.statusCode, 400);
});
