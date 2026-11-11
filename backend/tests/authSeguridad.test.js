import test from 'node:test';
import assert from 'node:assert/strict';
import { login, updateProfile } from '../controllers/authController.js';
import { disableUsuario, updateUsuario } from '../controllers/usuariosController.js';
import { hashPassword, hashToken, refreshCookieName } from '../utils/auth.js';

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  cookie() { return this; },
});

const withSecret = (t) => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'secreto-local-para-pruebas-de-seguridad';
  t.after(() => {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  });
};

const PASSWORD = 'Actual123!';
const baseUser = async (overrides = {}) => ({
  id: 7, nombre: 'Operador', email: 'operador@example.test', departamento: 'TI',
  rol: 'tecnico', estado: 'activo', activo_login: true, es_ti: true,
  password_hash: await hashPassword(PASSWORD), ...overrides,
});

// SQL simulado que registra cada consulta y responde según su texto.
const fakeSql = (user) => {
  const log = [];
  const sql = async (parts, ...values) => {
    const query = parts.join('?');
    log.push({ query, values });
    if (query.includes('FROM usuarios') && query.includes('LOWER(email)') && query.includes('id <>')) return [];
    if (query.includes('FROM usuarios')) return user ? [{ ...user }] : [];
    if (query.includes('UPDATE usuarios') && query.includes('RETURNING')) return [{ ...user, email: values[1] }];
    return [];
  };
  sql.begin = (callback) => callback(sql);
  return { sql, log, updates: () => log.filter((q) => q.query.includes('UPDATE usuarios')) };
};

test('login: correo inexistente y contraseña incorrecta responden igual (401)', async (t) => {
  withSecret(t);
  const user = await baseUser();
  const missing = response();
  await login({ body: { email: 'nadie@example.test', password: 'Cualquiera1!' } }, missing, fakeSql(null).sql);
  const wrong = response();
  await login({ body: { email: user.email, password: 'Incorrecta1!' } }, wrong, fakeSql(user).sql);
  assert.equal(missing.statusCode, 401);
  assert.deepEqual(missing.body, wrong.body);
  assert.equal(wrong.statusCode, 401);
});

test('login: una cuenta deshabilitada no se revela sin la contraseña correcta', async (t) => {
  withSecret(t);
  for (const overrides of [{ estado: 'inactivo' }, { activo_login: false }]) {
    const user = await baseUser(overrides);
    const wrong = response();
    await login({ body: { email: user.email, password: 'Incorrecta1!' } }, wrong, fakeSql(user).sql);
    assert.equal(wrong.statusCode, 401, 'Sin contraseña válida no debe revelar el estado');
    const right = response();
    await login({ body: { email: user.email, password: PASSWORD } }, right, fakeSql(user).sql);
    assert.equal(right.statusCode, 403);
    assert.equal(right.body.token, undefined);
  }
});

test('login: una cuenta sin contraseña configurada responde 401', async (t) => {
  withSecret(t);
  const user = await baseUser({ password_hash: null });
  const res = response();
  await login({ body: { email: user.email, password: PASSWORD } }, res, fakeSql(user).sql);
  assert.equal(res.statusCode, 401);
});

test('perfil: cambiar la contraseña exige la contraseña actual correcta', async () => {
  const user = await baseUser();
  for (const currentPassword of [undefined, '', 'Incorrecta1!']) {
    const db = fakeSql(user);
    const res = response();
    await updateProfile({ user: { sub: 7 }, body: { ...user, password: 'NuevaClave1!', currentPassword } }, res, db.sql);
    assert.equal(res.statusCode, 403);
    assert.equal(db.updates().length, 0, 'No debe modificar la cuenta');
  }
});

test('perfil: cambiar el correo exige la contraseña actual; nombre y departamento no', async () => {
  const user = await baseUser();
  const denied = fakeSql(user);
  const res = response();
  await updateProfile({ user: { sub: 7 }, body: { ...user, email: 'otro@example.test' } }, res, denied.sql);
  assert.equal(res.statusCode, 403);
  assert.equal(denied.updates().length, 0);

  const allowed = fakeSql(user);
  const ok = response();
  await updateProfile({ user: { sub: 7 }, body: { nombre: 'Nuevo nombre', email: 'OPERADOR@example.test', departamento: 'Soporte' } }, ok, allowed.sql);
  assert.equal(ok.statusCode, 200, 'Cambiar mayúsculas del mismo correo no cuenta como cambio');
});

test('perfil: el correo se guarda en minúsculas', async () => {
  const user = await baseUser();
  const db = fakeSql(user);
  const res = response();
  await updateProfile({ user: { sub: 7 }, body: { ...user, email: '  Nuevo@Example.TEST ', currentPassword: PASSWORD } }, res, db.sql);
  assert.equal(res.statusCode, 200);
  assert.equal(db.updates()[0].values[1], 'nuevo@example.test');
});

test('perfil: valida longitud de contraseña y formato de correo antes de consultar SQL', async () => {
  const user = await baseUser();
  const sql = Object.assign(async () => assert.fail('No debe consultar SQL'), { begin: () => assert.fail('No debe abrir transacción') });
  for (const body of [
    { ...user, password: 'corta', currentPassword: PASSWORD },
    { ...user, password: 'x'.repeat(73), currentPassword: PASSWORD },
    { ...user, email: 'no-es-correo' },
    { ...user, nombre: '   ' },
  ]) {
    const res = response();
    await updateProfile({ user: { sub: 7 }, body }, res, sql);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.campos);
  }
});

test('perfil: una cuenta deshabilitada no puede editarse con un token aún vigente', async () => {
  const user = await baseUser({ estado: 'inactivo' });
  const db = fakeSql(user);
  const res = response();
  await updateProfile({ user: { sub: 7 }, body: { ...user } }, res, db.sql);
  assert.equal(res.statusCode, 403);
  assert.equal(db.updates().length, 0);
});

test('perfil: al cambiar la contraseña se revocan las demás sesiones y se conserva la actual', async () => {
  const user = await baseUser();
  const cookie = 'refresh-actual';
  const db = fakeSql(user);
  const res = response();
  await updateProfile({
    user: { sub: 7 }, cookies: { [refreshCookieName]: cookie },
    body: { ...user, password: 'NuevaClave1!', currentPassword: PASSWORD },
  }, res, db.sql);
  assert.equal(res.statusCode, 200);
  const revoke = db.log.find((q) => q.query.includes('UPDATE auth_sessions'));
  assert.ok(revoke, 'Debe revocar sesiones');
  assert.deepEqual(revoke.values, [7, hashToken(cookie)]);

  const noChange = fakeSql(user);
  await updateProfile({ user: { sub: 7 }, body: { ...user, nombre: 'Otro' } }, response(), noChange.sql);
  assert.equal(noChange.log.some((q) => q.query.includes('auth_sessions')), false);
});

// Administración: la contraseña nueva o el acceso retirado revocan las sesiones de la cuenta.
const adminSql = (target) => {
  const admin = { id: 1, rol: 'administrador', estado: 'activo', activo_login: true, email: 'admin@example.test' };
  const log = [];
  const tx = async (parts, ...values) => {
    const query = parts.join('?');
    log.push({ query, values });
    if (query.includes('FOR UPDATE')) return [admin, { ...target }];
    if (query.includes('UPDATE usuarios')) return [{ ...target, estado: 'inactivo' }];
    return [];
  };
  return { sql: { begin: (callback) => callback(tx) }, revoked: () => log.filter((q) => q.query.includes('UPDATE auth_sessions')) };
};

test('usuarios: el administrador que cambia una contraseña revoca las sesiones de esa cuenta', async () => {
  const target = await baseUser();
  const db = adminSql(target);
  const res = response();
  await updateUsuario({ user: { sub: 1 }, params: { id: '7' }, body: { password: 'OtraClave1!' } }, res, db.sql);
  assert.equal(res.statusCode, 200);
  assert.equal(db.revoked().length, 1);
  assert.deepEqual(db.revoked()[0].values, [7]);

  const same = adminSql(target);
  await updateUsuario({ user: { sub: 1 }, params: { id: '7' }, body: { nombre: 'Solo nombre' } }, response(), same.sql);
  assert.equal(same.revoked().length, 0, 'Sin cambio de contraseña ni acceso no revoca');
});

test('usuarios: deshabilitar una cuenta revoca sus sesiones', async () => {
  const target = await baseUser();
  for (const run of [
    (db) => disableUsuario({ user: { sub: 1 }, params: { id: '7' } }, response(), db.sql),
    (db) => updateUsuario({ user: { sub: 1 }, params: { id: '7' }, body: { estado: 'inactivo' } }, response(), db.sql),
  ]) {
    const db = adminSql(target);
    await run(db);
    assert.equal(db.revoked().length, 1);
  }
});

test('cuentaHabilitada: solo estado activo con acceso habilitado', async () => {
  const { cuentaHabilitada } = await import('../utils/auth.js');
  assert.equal(cuentaHabilitada({ estado: 'activo', activo_login: true }), true);
  for (const user of [{ estado: 'inactivo', activo_login: true }, { estado: 'activo', activo_login: false },
    { estado: null, activo_login: true }, { estado: 'suspendido', activo_login: true }, { estado: 'activo', activo_login: null },
    {}, null, undefined]) {
    assert.equal(cuentaHabilitada(user), false, JSON.stringify(user));
  }
});

test('login y refresh aplican la misma regla que el middleware a estados ambiguos', async (t) => {
  withSecret(t);
  const { refresh } = await import('../controllers/authController.js');
  for (const overrides of [{ estado: null }, { estado: 'suspendido' }, { activo_login: null }]) {
    const user = await baseUser(overrides);
    const res = response();
    await login({ body: { email: user.email, password: PASSWORD } }, res, fakeSql(user).sql);
    assert.equal(res.statusCode, 403, `login ${JSON.stringify(overrides)}`);
    assert.equal(res.body.token, undefined);

    const revoked = [];
    const sql = async (parts, ...values) => {
      const query = parts.join('?');
      if (query.includes('FROM auth_sessions')) {
        return [{ id: 1, user_id: 7, expires_at: new Date(Date.now() + 86400000), revoked_at: null, ...user, ...overrides }];
      }
      if (query.includes('UPDATE auth_sessions') && query.includes('revoked_at = NOW()')) revoked.push(values);
      return [];
    };
    const refreshed = response();
    refreshed.clearCookie = () => refreshed;
    await refresh({ cookies: { [refreshCookieName]: 'token' } }, refreshed, sql);
    assert.equal(refreshed.statusCode, 401, `refresh ${JSON.stringify(overrides)}`);
    assert.equal(revoked.length, 1, 'La sesión se revoca');
  }
});
