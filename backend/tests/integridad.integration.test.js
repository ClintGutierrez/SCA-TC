import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import postgres from 'postgres';
import dotenv from 'dotenv';
import { seedUsers } from '../utils/seedUsers.js';

dotenv.config();

test('H04 y H08 en PostgreSQL aislado: costos protegidos y cuentas conservadas', {
  skip: process.env.TEST_INTEGRIDAD_DATABASE !== '1', timeout: 60000,
}, async () => {
  const schema = `sca_integridad_test_${crypto.randomBytes(8).toString('hex')}`;
  const options = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'false' ? false : process.env.DB_SSL, connect_timeout: 10, onnotice: () => {} };
  const admin = postgres(options);
  let sql;
  try {
    await admin.unsafe(`CREATE SCHEMA ${schema}`);
    sql = postgres({ ...options, connection: { search_path: schema } });
    await sql.unsafe(`CREATE TABLE bienes_informaticos (id SERIAL PRIMARY KEY, costo NUMERIC(12,2) NOT NULL);
      CREATE TABLE usuarios (id SERIAL PRIMARY KEY, nombre TEXT, email TEXT UNIQUE, departamento TEXT, rol TEXT,
        password_hash TEXT, activo_login BOOLEAN, estado TEXT, es_ti BOOLEAN);`);
    const [legacy] = await sql`INSERT INTO bienes_informaticos (costo) VALUES (-50) RETURNING id`;
    const migration = await fs.readFile(new URL('../migrations/20261105_bienes_costo_valido.sql', import.meta.url), 'utf8');
    await sql.unsafe(migration);
    await sql.unsafe(migration);
    assert.equal(Number((await sql`SELECT costo FROM bienes_informaticos WHERE id=${legacy.id}`)[0].costo), -50);
    await assert.rejects(sql`INSERT INTO bienes_informaticos (costo) VALUES (-1)`, { code: '23514' });
    await assert.rejects(sql`INSERT INTO bienes_informaticos (costo) VALUES ('NaN')`, { code: '23514' });
    const [valid] = await sql`INSERT INTO bienes_informaticos (costo) VALUES (0) RETURNING id`;
    await assert.rejects(sql`UPDATE bienes_informaticos SET costo=-1 WHERE id=${valid.id}`, { code: '23514' });
    await sql`UPDATE bienes_informaticos SET costo=1250.50 WHERE id=${valid.id}`;

    const [existing] = await sql`INSERT INTO usuarios (nombre,email,rol,password_hash,activo_login,estado)
      VALUES ('Personalizado','EXISTENTE@example.test','auditor','hash-original',FALSE,'inactivo') RETURNING *`;
    const accounts = [
      { nombre: 'Otro nombre', email: 'existente@example.test', rol: 'administrador', password: 'PruebaDeClaveNueva!' },
      { nombre: 'Nueva cuenta', email: 'nueva@example.test', rol: 'tecnico', password: 'PruebaDeClaveNueva!' },
    ];
    assert.deepEqual(await seedUsers(sql, accounts, 'test'), { created: 1, skipped: 1 });
    assert.deepEqual(await seedUsers(sql, accounts, 'test'), { created: 0, skipped: 2 });
    const [preserved] = await sql`SELECT * FROM usuarios WHERE id=${existing.id}`;
    assert.deepEqual(preserved, existing);
  } finally {
    if (sql) await sql.end({ timeout: 5 });
    if (/^sca_integridad_test_[a-f0-9]{16}$/.test(schema)) await admin.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end({ timeout: 5 });
  }
});
