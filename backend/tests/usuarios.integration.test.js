import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import express from 'express';
import postgres from 'postgres';
import dotenv from 'dotenv';
import { createUsuariosRouter } from '../routes/usuarios.js';
import { createAuthToken, comparePassword } from '../utils/auth.js';

dotenv.config();
test('usuarios HTTP y PostgreSQL aislado: altas, roles, acceso, contraseñas y conflictos concurrentes', {
  skip: process.env.TEST_USUARIOS_DATABASE !== '1', timeout: 120000,
}, async (t) => {
  const schema = `sca_usuarios_test_${crypto.randomBytes(8).toString('hex')}`;
  const options = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'false' ? false : process.env.DB_SSL, connect_timeout: 10, onnotice: () => {} };
  const admin = postgres(options);
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  let sql; let server;
  try {
    await admin.unsafe(`CREATE SCHEMA ${schema}`);
    sql = postgres({ ...options, connection: { search_path: schema }, max: 5 });
    await sql.unsafe(`CREATE TABLE usuarios(id SERIAL PRIMARY KEY,nombre TEXT,email TEXT UNIQUE,departamento TEXT,
      rol TEXT,es_ti BOOLEAN DEFAULT FALSE,estado TEXT DEFAULT 'activo',activo_login BOOLEAN DEFAULT TRUE,
      password_hash TEXT,last_login TIMESTAMP,created_at TIMESTAMP DEFAULT now());
      CREATE TABLE auth_sessions(id SERIAL PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,expires_at TIMESTAMP NOT NULL,revoked_at TIMESTAMP,last_used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT now());`);
    const admins = await sql`INSERT INTO usuarios(nombre,email,rol,password_hash) VALUES
      ('Administrador uno','admin1@example.test','administrador','hash-inicial'),
      ('Administrador dos','admin2@example.test','administrador','hash-inicial') RETURNING *`;
    const [tech] = await sql`INSERT INTO usuarios(nombre,email,rol) VALUES ('Técnico','ti@example.test','tecnico') RETURNING *`;
    const tokens = [...admins, tech].map(createAuthToken);
    const app = express(); app.use(express.json()); app.use('/usuarios', createUsuariosRouter(sql));
    server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}/usuarios`;
    const request = async (path = '', { actor = 0, method = 'GET', body } = {}) => {
      const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${tokens[actor]}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, data: await response.json() };
    };
    let created;
    await t.test('solo administradores crean y el correo repetido se informa junto al campo', async () => {
      const body = { nombre: 'Cuenta nueva', email: 'NUEVA@example.test', rol: 'almacen', password: 'ClaveDePrueba123!' };
      assert.equal((await request('', { actor: 2, method: 'POST', body })).status, 403);
      const result = await request('', { method: 'POST', body });
      assert.equal(result.status, 201, JSON.stringify(result.data)); created = result.data;
      assert.equal(created.email, 'nueva@example.test'); assert.equal(created.password_hash, undefined);
      const duplicate = await request('', { method: 'POST', body });
      assert.equal(duplicate.status, 409); assert.ok(duplicate.data.campos.email);
    });
    await t.test('editar, bloquear, desactivar y reactivar conserva o cambia la contraseña expresamente', async () => {
      const [before] = await sql`SELECT password_hash FROM usuarios WHERE id=${created.id}`;
      await sql`INSERT INTO auth_sessions(user_id,token_hash,expires_at) VALUES (${created.id},'sesion-abierta',now() + interval '7 days')`;
      assert.equal((await request(`/${created.id}`, { method: 'PUT', body: { nombre: 'Nombre editado', activoLogin: false } })).status, 200);
      const [after] = await sql`SELECT * FROM usuarios WHERE id=${created.id}`;
      assert.equal(after.password_hash, before.password_hash); assert.equal(after.activo_login, false); assert.equal(after.estado, 'activo');
      const [session] = await sql`SELECT revoked_at FROM auth_sessions WHERE token_hash='sesion-abierta'`;
      assert.ok(session.revoked_at, 'Bloquear el acceso revoca las sesiones abiertas de la cuenta');
      const disabled = await request(`/${created.id}`, { method: 'DELETE' });
      assert.equal(disabled.status, 200); assert.equal(disabled.data.user.estado, 'inactivo');
      const restored = await request(`/${created.id}`, { method: 'PUT', body: { estado: 'activo', activoLogin: true, rol: 'tecnico', password: 'OtraClaveDePrueba!' } });
      assert.equal(restored.status, 200); assert.equal(restored.data.es_ti, true); assert.equal(restored.data.activo_login, true);
      const [password] = await sql`SELECT password_hash FROM usuarios WHERE id=${created.id}`;
      assert.ok(await comparePassword('OtraClaveDePrueba!', password.password_hash));
      assert.equal(await comparePassword('ClaveDePrueba123!', password.password_hash), false);
    });
    await t.test('la propia cuenta rechaza bloqueo, desactivación y cambio de rol', async () => {
      assert.equal((await request(`/${admins[0].id}`, { method: 'DELETE' })).status, 409);
      for (const body of [{ activoLogin: false }, { estado: 'inactivo' }, { rol: 'auditor' }]) {
        assert.equal((await request(`/${admins[0].id}`, { method: 'PUT', body })).status, 409);
      }
      assert.equal((await request(`/${admins[0].id}`, { method: 'PUT', body: { nombre: 'Mi nombre corregido' } })).status, 200);
    });
    await t.test('operaciones concurrentes no pueden retirar el acceso de ambos administradores', async () => {
      const results = await Promise.all([
        request(`/${admins[1].id}`, { actor: 0, method: 'PUT', body: { rol: 'auditor' } }),
        request(`/${admins[0].id}`, { actor: 1, method: 'DELETE' }),
      ]);
      assert.equal(results.filter((result) => result.status === 200).length, 1, JSON.stringify(results));
      assert.ok(results.some((result) => [403, 409].includes(result.status)));
      const [count] = await sql`SELECT count(*)::int AS total FROM usuarios WHERE rol='administrador' AND estado='activo' AND activo_login=TRUE`;
      assert.equal(count.total, 1);
    });
    await t.test('la migración normaliza estados nulos, es repetible y rechaza estados desconocidos', async () => {
      // Columnas sin restricciones, como en bases anteriores a la migración.
      await sql`ALTER TABLE usuarios ALTER COLUMN estado DROP NOT NULL`.catch(() => {});
      const [legacy] = await sql`INSERT INTO usuarios(nombre,email,rol,estado,activo_login)
        VALUES ('Cuenta antigua','antigua@example.test','tecnico',NULL,NULL) RETURNING id`;
      const migration = await fs.readFile(new URL('../migrations/20261110_usuarios_estado.sql', import.meta.url), 'utf8');
      await sql.begin((tx) => tx.unsafe(migration));
      await sql.begin((tx) => tx.unsafe(migration));
      const [row] = await sql`SELECT estado, activo_login FROM usuarios WHERE id=${legacy.id}`;
      assert.deepEqual({ ...row }, { estado: 'activo', activo_login: true });
      const [check] = await sql`SELECT convalidated FROM pg_constraint WHERE conname='chk_usuarios_estado'`;
      assert.equal(check.convalidated, true, 'Sin estados desconocidos la restricción queda validada');
      await assert.rejects(sql`UPDATE usuarios SET estado='suspendido' WHERE id=${legacy.id}`, { code: '23514' });
      await assert.rejects(sql`UPDATE usuarios SET estado=NULL WHERE id=${legacy.id}`, { code: '23502' });
      await assert.rejects(sql`UPDATE usuarios SET activo_login=NULL WHERE id=${legacy.id}`, { code: '23502' });
    });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (sql) await sql.end({ timeout: 5 });
    if (/^sca_usuarios_test_[a-f0-9]{16}$/.test(schema)) await admin.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end({ timeout: 5 });
    if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
  }
});
