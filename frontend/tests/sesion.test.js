import test from 'node:test';
import assert from 'node:assert/strict';
import { MENSAJES_FIN_SESION, MOTIVOS_FIN_SESION, alTerminarSesion, esCuentaDeshabilitada, notificarFinSesion } from '../src/utils/sesion.js';

test('sesión: solo el 403 con código CUENTA_DESHABILITADA cierra la sesión', () => {
  assert.equal(esCuentaDeshabilitada({ response: { status: 403, data: { code: 'CUENTA_DESHABILITADA' } } }), true);
  for (const error of [
    { response: { status: 403, data: { error: 'No tienes permisos para realizar esta acción' } } },
    { response: { status: 401, data: { code: 'CUENTA_DESHABILITADA' } } },
    { response: { status: 500 } }, {}, null, undefined,
  ]) {
    assert.equal(esCuentaDeshabilitada(error), false, JSON.stringify(error));
  }
});

test('sesión: avisa a los oyentes con el motivo y permite dejar de escuchar', () => {
  const recibidos = [];
  const dejar = alTerminarSesion((motivo) => recibidos.push(motivo));
  const fallido = alTerminarSesion(() => { throw new Error('oyente roto'); });
  const original = console.error; console.error = () => {};
  try {
    notificarFinSesion(MOTIVOS_FIN_SESION.cuentaDeshabilitada);
  } finally { console.error = original; }
  assert.deepEqual(recibidos, ['cuenta_deshabilitada'], 'Un oyente que falla no impide avisar a los demás');
  dejar(); fallido();
  notificarFinSesion(MOTIVOS_FIN_SESION.sesionExpirada);
  assert.equal(recibidos.length, 1);
  assert.ok(MENSAJES_FIN_SESION.cuenta_deshabilitada && MENSAJES_FIN_SESION.sesion_expirada);
});
