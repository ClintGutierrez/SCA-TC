import test from 'node:test';
import assert from 'node:assert/strict';
import { login, updateProfile } from '../controllers/authController.js';
import { createBaja, getBajas } from '../controllers/bajasController.js';
import { saveConfiguracion } from '../controllers/configuracionController.js';
import { hashPassword, verifyAccessToken } from '../utils/auth.js';
import { createEvidenceUrl } from '../utils/supabaseStorage.js';

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  cookie() { return this; },
});

function storage(t, handler = async () => ({ ok: true })) {
  for (const [key, value] of Object.entries({
    SUPABASE_URL: 'https://storage.example.test',
    SUPABASE_SECRET_KEY: 'clave-simulada',
    SUPABASE_STORAGE_BUCKET: 'pruebas',
  })) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  return t.mock.method(globalThis, 'fetch', handler);
}

const bajaRequest = (user = { sub: 7, id: 99 }) => {
  const image = { mimetype: 'image/png', size: 8, buffer: Buffer.from('simulado') };
  return {
    params: { bienId: 1 }, user, body: { motivo: 'Equipo obsoleto' },
    files: { fotoFrontal: [image], fotoLateral: [image] },
  };
};

test('H09: cambiar contraseña permite entrar con la nueva y rechaza la anterior', async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'secreto-local-para-prueba-de-perfil';
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  const oldPassword = 'Anterior123!';
  const newPassword = 'Nueva456!';
  const user = {
    id: 7, nombre: 'Operador', email: 'operador@example.test', departamento: 'TI',
    rol: 'tecnico', estado: 'activo', activo_login: true,
    password_hash: await hashPassword(oldPassword),
  };
  let savedHash;
  const sql = async (parts, ...values) => {
    const query = parts.join('');
    if (query.includes('WHERE LOWER(email)') && query.includes('id <>')) return [];
    if (query.includes('UPDATE usuarios') && query.includes('password_hash =')) {
      assert.equal(values.at(-1), user.id);
      savedHash = values[2]; // nombre, departamento, password_hash, id
      user.password_hash = savedHash;
      return [{ ...user }];
    }
    if (query.includes('SELECT *') && query.includes('FROM usuarios')) return [{ ...user }];
    if (query.includes('INSERT INTO audit_log') || query.includes('INSERT INTO auth_sessions')
      || query.includes('UPDATE auth_sessions') || query.includes('UPDATE usuarios')) return [];
    assert.fail('Consulta inesperada en autenticación');
  };
  sql.begin = (callback) => callback(sql);
  const updated = response();
  await updateProfile({ user: { sub: user.id }, body: { ...user, password: newPassword, currentPassword: oldPassword } }, updated, sql);
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.body.user.id, user.id);
  assert.equal(updated.body.user.password_hash, undefined);
  assert.ok(savedHash);
  assert.notEqual(savedHash, newPassword);

  const currentLogin = response();
  await login({ body: { email: user.email, password: newPassword } }, currentLogin, sql);
  assert.equal(currentLogin.statusCode, 200);
  assert.equal(verifyAccessToken(currentLogin.body.token).sub, user.id);

  const oldLogin = response();
  await login({ body: { email: user.email, password: oldPassword } }, oldLogin, sql);
  assert.equal(oldLogin.statusCode, 401);
});

test('H02: configuración conserva el operador de sub aunque exista otro id', async () => {
  const authors = [];
  const tx = async (parts, ...values) => {
    assert.match(parts.join(''), /INSERT INTO configuracion_sistema/);
    authors.push(values[2]);
    return [];
  };
  tx.json = (value) => value;
  const res = response();
  await saveConfiguracion({
    user: { sub: 7, id: 99 },
    body: { settings: { institution: { nombre: 'Prueba' }, inventory: { moneda: 'PEN' } } },
  }, res, { begin: (callback) => callback(tx) });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(authors, [7, 7]);
});

test('H02: baja conserva el operador de sub y permite omitir el documento', async (t) => {
  const fetchMock = storage(t);
  let author;
  const tx = async (parts, ...values) => {
    const query = parts.join('');
    if (query.includes('FROM bienes_informaticos')) return [{ id: 1, estado: 'activo' }];
    if (query.includes('SELECT id FROM bajas')) return [];
    if (query.includes('INSERT INTO bajas')) {
      author = values[5];
      assert.equal(values[2], null);
      return [];
    }
    assert.fail('Consulta inesperada en bajas');
  };
  const res = response();
  await createBaja(bajaRequest(), res, { begin: (callback) => callback(tx) });
  assert.equal(res.statusCode, 201);
  assert.equal(author, 7);
  assert.equal(fetchMock.mock.callCount(), 2);
  assert.ok(fetchMock.mock.calls.every(({ arguments: args }) => args[1].method === 'POST'));
});

test('H02: rechaza identidad ausente o inválida antes de SQL o Storage', async (t) => {
  const fetchMock = storage(t, async () => assert.fail('No debe subir archivos sin identidad'));
  const sql = { begin: () => assert.fail('No debe iniciar una transacción sin identidad') };
  for (const user of [undefined, { id: 99 }, { sub: 0 }, { sub: -1 }, { sub: 'inválido' }, { sub: 1.5 }]) {
    const baja = response();
    await createBaja({ ...bajaRequest(), user }, baja, sql);
    assert.equal(baja.statusCode, 401, 'Baja debe exigir el sub válido del token');
    const config = response();
    await saveConfiguracion({ user, body: { settings: { institution: {} } } }, config, sql);
    assert.equal(config.statusCode, 401, 'Configuración debe exigir el sub válido del token');
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('H10: lista conjuntamente bajas con documento, sin documento y con ruta vacía', async (t) => {
  const fetchMock = storage(t, async (url) => ({
    ok: true, json: async () => ({ signedURL: '/storage/v1/firmado/' + url.split('/object/sign/')[1] }),
  }));
  const rows = [
    { id: 1, foto_frontal_url: '1/frontal', foto_lateral_url: '1/lateral', documento_sustentatorio: null },
    { id: 2, foto_frontal_url: '2/frontal', foto_lateral_url: '2/lateral', documento_sustentatorio: '2/documento' },
    { id: 3, foto_frontal_url: '3/frontal', foto_lateral_url: '3/lateral', documento_sustentatorio: '' },
  ];
  const res = response();
  await getBajas({}, res, async () => rows);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.map((row) => row.id), [1, 2, 3]);
  assert.equal(res.body[0].documento_sustentatorio, null);
  assert.match(res.body[1].documento_sustentatorio, /\/2\/documento$/);
  assert.equal(res.body[2].documento_sustentatorio, null);
  assert.ok(res.body.every((row) => row.foto_frontal_url && row.foto_lateral_url));
  assert.equal(fetchMock.mock.callCount(), 7);
});

test('H10: rutas ausentes devuelven null sin consultar Storage ni exigir configuración', async (t) => {
  for (const key of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    const previous = process.env[key];
    delete process.env[key];
    t.after(() => {
      if (previous !== undefined) process.env[key] = previous;
    });
  }
  t.mock.method(globalThis, 'fetch', async () => assert.fail('No debe firmar una ruta ausente'));
  for (const path of [null, undefined, '']) assert.equal(await createEvidenceUrl(path), null);
});

test('H10: un error de firma para una ruta existente sigue propagándose', async (t) => {
  storage(t, async () => ({ ok: false, status: 503, text: async () => 'Servicio no disponible' }));
  await assert.rejects(createEvidenceUrl('1/documento'), /Storage respondió 503/);
});

test('configuración: la depreciación anual debe ser un porcentaje mayor que 0 y hasta 100', async () => {
  const saved = [];
  const tx = async (parts, ...values) => {
    if (parts.join('').includes('INSERT INTO configuracion_sistema')) saved.push(values[1]);
    return [];
  };
  tx.json = (value) => value;
  const sql = { begin: (callback) => callback(tx) };
  for (const depreciacionAnual of [0, -5, 101, 'abc', '', null, 12.345]) {
    const res = response();
    await saveConfiguracion({ user: { sub: 7 }, body: { settings: { inventory: { moneda: 'PEN', depreciacionAnual } } } }, res, sql);
    assert.equal(res.statusCode, 400, `Debe rechazar ${String(depreciacionAnual)}`);
  }
  assert.equal(saved.length, 0);
  const res = response();
  await saveConfiguracion({ user: { sub: 7 }, body: { settings: { inventory: { moneda: 'PEN', depreciacionAnual: '30' } } } }, res, sql);
  assert.equal(res.statusCode, 200);
  assert.equal(saved[0].depreciacionAnual, 30, 'Se guarda como número');
});
