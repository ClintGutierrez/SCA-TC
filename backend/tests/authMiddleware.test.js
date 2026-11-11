import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticate, requireRole } from '../middleware/auth.js';
import { createAuthToken } from '../utils/auth.js';

const withSecret = (t) => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'secreto-local-para-pruebas-de-middleware';
  t.after(() => {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  });
};

const response = () => ({
  statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const tokenFor = (claims) => createAuthToken({ id: 7, email: 'viejo@example.test', nombre: 'Viejo', rol: 'administrador', ...claims });

// Ejecuta authenticate y luego, si pasa, requireRole; devuelve el estado final.
const run = async (sql, headers, ...roles) => {
  const req = { headers };
  const res = response();
  let passed = false;
  await authenticate(sql)(req, res, () => { passed = true; });
  if (passed && roles.length) {
    passed = false;
    requireRole(...roles)(req, res, () => { passed = true; });
  }
  return { req, res, passed };
};

const dbUser = (row) => {
  const calls = [];
  const sql = async (parts, ...values) => { calls.push(values); return row ? [row] : []; };
  return { sql, calls };
};

const active = { id: 7, nombre: 'Actual', email: 'actual@example.test', rol: 'administrador', es_ti: false, estado: 'activo', activo_login: true };

test('middleware: sin token o con token inválido responde 401 sin consultar la BD', async (t) => {
  withSecret(t);
  const sql = async () => assert.fail('No debe consultar la BD');
  assert.equal((await run(sql, {})).res.statusCode, 401);
  assert.equal((await run(sql, { authorization: 'Bearer basura' })).res.statusCode, 401);
});

test('middleware: el rol y el correo vienen de la BD, no del token', async (t) => {
  withSecret(t);
  const { sql, calls } = dbUser({ ...active, rol: 'tecnico' });
  const headers = { authorization: `Bearer ${tokenFor({})}` };
  const ok = await run(sql, headers, 'tecnico');
  assert.equal(ok.passed, true);
  assert.equal(ok.req.user.rol, 'tecnico');
  assert.equal(ok.req.user.email, 'actual@example.test');
  assert.equal(ok.req.user.sub, 7);
  assert.deepEqual(calls[0], [7]);

  const degraded = await run(sql, headers, 'administrador');
  assert.equal(degraded.passed, false, 'Un administrador degradado no conserva permisos con su token anterior');
  assert.equal(degraded.res.statusCode, 403);
});

test('middleware: una cuenta deshabilitada o con estado desconocido pierde acceso aunque el JWT siga vigente', async (t) => {
  withSecret(t);
  const headers = { authorization: `Bearer ${tokenFor({})}` };
  for (const overrides of [{ estado: 'inactivo' }, { activo_login: false }, { activo_login: null }, { estado: null }, { estado: 'suspendido' }]) {
    const result = await run(dbUser({ ...active, ...overrides }).sql, headers);
    assert.equal(result.passed, false);
    assert.equal(result.res.statusCode, 403);
    assert.equal(result.res.body.code, 'CUENTA_DESHABILITADA');
  }
});

test('middleware: una cuenta eliminada responde 401', async (t) => {
  withSecret(t);
  const result = await run(dbUser(null).sql, { authorization: `Bearer ${tokenFor({})}` });
  assert.equal(result.passed, false);
  assert.equal(result.res.statusCode, 401);
});

test('middleware: un error de la BD se delega al manejador de errores', async (t) => {
  withSecret(t);
  const failure = new Error('BD caída');
  const req = { headers: { authorization: `Bearer ${tokenFor({})}` } };
  let received;
  await authenticate(async () => { throw failure; })(req, response(), (error) => { received = error; });
  assert.equal(received, failure);
});
