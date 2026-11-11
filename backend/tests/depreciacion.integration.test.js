import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import postgres from 'postgres';
import { actualizarDepreciacion, crearDepreciacion } from '../controllers/depreciacionController.js';
import { getReporteDepreciacion } from '../controllers/reportesController.js';

dotenv.config({ quiet: true });
const response = () => ({ statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const today = new Date('2026-11-05T12:00:00Z');

test('H05 en PostgreSQL aislado: migración, repetición, concurrencia y reporte con costo cero', {
  skip: process.env.TEST_DEPRECIACION_DATABASE !== '1', timeout: 60000,
}, async (t) => {
  const schema = `sca_depreciacion_test_${crypto.randomBytes(8).toString('hex')}`;
  const options = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'false' ? false : process.env.DB_SSL, connect_timeout: 5, onnotice: () => {} };
  const admin = postgres({ ...options, max: 1 });
  let sql;
  try {
    await admin.unsafe(`CREATE SCHEMA ${schema}`);
    sql = postgres({ ...options, connection: { search_path: schema }, max: 3 });
    await sql.unsafe(`CREATE TABLE bienes_informaticos (id SERIAL PRIMARY KEY, nombre TEXT, tipo TEXT,
        fecha_adquisicion DATE NOT NULL DEFAULT '2024-01-01');
      CREATE TABLE audit_log (id SERIAL PRIMARY KEY, usuario_id INTEGER, tabla_afectada TEXT NOT NULL, operacion TEXT,
        registro_id INTEGER, datos_anteriores JSONB, datos_nuevos JSONB, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE depreciacion (id SERIAL PRIMARY KEY, bien_id INTEGER NOT NULL REFERENCES bienes_informaticos(id),
        valor_inicial NUMERIC(12,2), porcentaje_anual NUMERIC(5,2), valor_actual NUMERIC(12,2), ano_actual INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
    const asset = async () => (await sql`INSERT INTO bienes_informaticos (nombre,tipo) VALUES ('Equipo de prueba','otro') RETURNING id`)[0].id;
    const legacyId = await asset();
    const missingDateId = await asset();
    await sql`INSERT INTO depreciacion (bien_id,valor_inicial,porcentaje_anual,valor_actual,ano_actual,created_at)
      VALUES (${legacyId},1000,20,1000,2026,'2024-03-15'),(${missingDateId},1000,20,1000,2026,NULL)`;
    const migration = await fs.readFile(new URL('../migrations/20261105_depreciacion_base.sql', import.meta.url), 'utf8');

    await t.test('migrar dos veces conserva importes y recupera la base desde la creación', async () => {
      await sql.begin((tx) => tx.unsafe(migration));
      await sql.begin((tx) => tx.unsafe(migration));
      const [row] = await sql`SELECT * FROM depreciacion WHERE bien_id=${legacyId}`;
      assert.equal(row.ano_base, 2024);
      assert.equal(row.ano_actual, 2026);
      assert.equal(Number(row.valor_actual), 1000);
      const [unknown] = await sql`SELECT * FROM depreciacion WHERE bien_id=${missingDateId}`;
      assert.equal(unknown.ano_base, null);
      const res = response();
      await actualizarDepreciacion({ params: { bienId: missingDateId } }, res, sql, today);
      assert.equal(res.statusCode, 409);
    });

    await t.test('tres actualizaciones concurrentes dejan S/ 640 y la base original', async () => {
      const responses = await Promise.all(Array.from({ length: 3 }, async () => {
        const res = response();
        await actualizarDepreciacion({ params: { bienId: legacyId } }, res, sql, today);
        return res;
      }));
      responses.forEach((res) => { assert.equal(res.statusCode, 200); assert.equal(Number(res.body.valor_actual), 640); });
      const [row] = await sql`SELECT * FROM depreciacion WHERE bien_id=${legacyId}`;
      assert.equal(row.ano_base, 2024);
      assert.equal(row.ano_actual, 2026);
      assert.equal(Number(row.valor_actual), 640);
    });

    let zeroAssetId;
    await t.test('dos altas concurrentes crean una depreciación y conservan la tasa 0 %', async () => {
      zeroAssetId = await asset();
      const results = await Promise.all([0, 1].map(async () => {
        const res = response();
        await crearDepreciacion({ body: { bienId: zeroAssetId, valorInicial: 0, porcentajeAnual: 0 } }, res, sql, today);
        return res.statusCode;
      }));
      assert.deepEqual(results.sort(), [201, 409]);
      const rows = await sql`SELECT * FROM depreciacion WHERE bien_id=${zeroAssetId}`;
      assert.equal(rows.length, 1);
      assert.equal(Number(rows[0].porcentaje_anual), 0);
    });

    await t.test('PostgreSQL impide cambiar la base y guardar importes o tasas inválidos', async () => {
      await assert.rejects(sql`UPDATE depreciacion SET ano_base=2023 WHERE bien_id=${legacyId}`, { code: '23514' });
      for (const [amount, rate, current] of [[-1,20,0],[100,101,100],[100,20,-1],[100,20,101],['NaN',20,0],[100,'NaN',0],[100,20,'NaN']]) {
        const id = await asset();
        await assert.rejects(sql`INSERT INTO depreciacion (bien_id,valor_inicial,porcentaje_anual,valor_actual,ano_base,ano_actual)
          VALUES (${id},${amount},${rate},${current},2026,2026)`, { code: '23514' });
      }
      const id = await asset();
      await assert.rejects(sql`INSERT INTO depreciacion (bien_id,valor_inicial,porcentaje_anual,valor_actual,ano_base,ano_actual)
        VALUES (${id},100,20,100,NULL,2026)`, { code: '23514' });
    });

    await t.test('no sobrescribe registros duplicados anteriores', async () => {
      const id = await asset();
      await sql`INSERT INTO depreciacion (bien_id,valor_inicial,porcentaje_anual,valor_actual,ano_base,ano_actual)
        VALUES (${id},1000,20,1000,2024,2024),(${id},500,20,500,2024,2024)`;
      const res = response();
      await actualizarDepreciacion({ params: { bienId: id } }, res, sql, today);
      assert.equal(res.statusCode, 409);
      const rows = await sql`SELECT valor_actual FROM depreciacion WHERE bien_id=${id} ORDER BY id`;
      assert.deepEqual(rows.map((row) => Number(row.valor_actual)), [1000,500]);
    });

    await t.test('la conciliación lleva el año base a la adquisición, es repetible y queda auditada', async () => {
      const [{ id }] = await sql`INSERT INTO bienes_informaticos (nombre,tipo,fecha_adquisicion)
        VALUES ('Equipo antiguo','otro','2022-06-30') RETURNING id`;
      // Registro creado con la regla anterior: base en el año de registro (2026).
      await sql`INSERT INTO depreciacion (bien_id,valor_inicial,porcentaje_anual,valor_actual,ano_base,ano_actual)
        VALUES (${id},1000,20,1000,2026,2026)`;
      const stale = response();
      await actualizarDepreciacion({ params: { bienId: id } }, stale, sql, today);
      assert.equal(stale.statusCode, 409, 'Antes de conciliar no debe recalcular con la base antigua');

      const conciliation = await fs.readFile(new URL('../migrations/20261110_depreciacion_ano_adquisicion.sql', import.meta.url), 'utf8');
      await sql.begin((tx) => tx.unsafe(conciliation));
      await sql.begin((tx) => tx.unsafe(conciliation));
      const [row] = await sql`SELECT * FROM depreciacion WHERE bien_id=${id}`;
      assert.equal(row.ano_base, 2022);
      assert.equal(row.ano_actual, 2026);
      assert.equal(Number(row.valor_actual), 409.6);
      const audit = await sql`SELECT * FROM audit_log WHERE tabla_afectada='depreciacion' AND registro_id=${row.id}`;
      assert.equal(audit.length, 1, 'Repetir la conciliación no duplica cambios ni auditoría');
      assert.equal(audit[0].datos_anteriores.ano_base, 2026);
      assert.equal(audit[0].datos_nuevos.ano_base, 2022);

      const res = response();
      await actualizarDepreciacion({ params: { bienId: id } }, res, sql, today);
      assert.equal(res.statusCode, 200);
      assert.equal(Number(res.body.valor_actual), 409.6);
      // Fuera de la conciliación el año base sigue protegido.
      await assert.rejects(sql`UPDATE depreciacion SET ano_base=2023 WHERE bien_id=${id}`, { code: '23514' });
    });

    await t.test('el reporte admite costo cero sin dividir entre cero', async () => {
      const res = response();
      await getReporteDepreciacion({}, res, sql);
      assert.equal(res.statusCode, 200);
      const zero = res.body.find((row) => row.id === zeroAssetId);
      assert.equal(Number(zero.porcentaje_depreciacion), 0);
      assert.equal(Number(zero.depreciacion_total), 0);
    });
  } finally {
    if (sql) await sql.end({ timeout: 5 });
    if (!/^sca_depreciacion_test_[0-9a-f]{16}$/.test(schema)) throw new Error('Esquema de prueba inválido');
    await admin.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end({ timeout: 5 });
  }
});
