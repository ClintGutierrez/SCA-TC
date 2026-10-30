import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import express from 'express';
import postgres from 'postgres';
import dotenv from 'dotenv';
import { createPersonalRouter } from '../routes/personal.js';
import { createAsignacionesRouter } from '../routes/asignaciones.js';
import { createMovimientosRouter } from '../routes/movimientos.js';
import { createAuditoriaRouter } from '../routes/auditoria.js';
import { createAuthToken } from '../utils/auth.js';
import { fechaLima } from '../utils/vinculoLaboral.js';

dotenv.config();

test('CUS12: períodos, concurrencia, asignaciones y auditoría en PostgreSQL aislado', {
  skip: process.env.TEST_CUS12_DATABASE !== '1', timeout: 120000,
}, async (t) => {
  const schema = `sca_cus12_test_${crypto.randomBytes(8).toString('hex')}`;
  const options = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: process.env.DB_SSL === 'false' ? false : process.env.DB_SSL,
    connect_timeout: 10, onnotice: () => {} };
  const admin = postgres(options);
  const priorSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  let sql; let server;
  try {
    await admin.unsafe(`CREATE SCHEMA ${schema}`);
    sql = postgres({ ...options, connection: { search_path: schema }, max: 5 });
    for (const file of ['schema.sql', '20261013_asignaciones.sql', '20261013_movimientos_patrimoniales.sql']) {
      await sql.unsafe((await fs.readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8')).replace(/^\uFEFF/, ''));
    }
    const users = await sql`INSERT INTO usuarios(nombre,email,rol) VALUES
      ('Administrador','admin@example.test','administrador'), ('Jefatura','jefe@example.test','jefatura'),
      ('Técnico','ti@example.test','tecnico'), ('Logística','almacen@example.test','almacen'),
      ('Auditor','auditor@example.test','auditor'), ('Sin permiso','externo@example.test','externo') RETURNING *`;
    const [legacy] = await sql`INSERT INTO vinculo_laboral(usuario_id,tipo_vinculo,fecha_inicio) VALUES (${users[0].id},'locador','2020-01-01') RETURNING id`;
    const migration = await fs.readFile(new URL('../migrations/20261029_vinculo_laboral.sql', import.meta.url), 'utf8');
    await sql.begin((tx) => tx.unsafe(migration));
    await sql.begin((tx) => tx.unsafe(migration));
    const [preserved] = await sql`SELECT * FROM vinculo_laboral WHERE id=${legacy.id}`;
    assert.equal(preserved.personal_id, null); assert.equal(preserved.usuario_id, users[0].id);
    assert.equal(preserved.tipo_vinculo, 'Locador de servicios');

    const tokens = users.map(createAuthToken);
    const app = express(); app.use(express.json());
    app.use('/personal', createPersonalRouter(sql)); app.use('/asignaciones', createAsignacionesRouter(sql));
    app.use('/movimientos', createMovimientosRouter(sql)); app.use('/auditoria', createAuditoriaRouter(sql));
    server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (path, { user = 0, method = 'GET', body } = {}) => {
      const response = await fetch(base + path, { method, headers: { ...(user === null ? {} : { Authorization: `Bearer ${tokens[user]}` }), 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, data: await response.json() };
    };
    const today = fechaLima();
    const relative = (days) => new Date(Date.parse(`${today}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
    let sequence = 0;
    const person = async (regimen = 'CAS', overrides = {}) => {
      sequence++;
      const body = { nombre: 'Persona', apellido: `Prueba ${sequence}`, dni: String(80000000 + sequence),
        correo_institucional: `persona${sequence}@example.test`, regimen_laboral: regimen, cargo: 'Analista', estado: 'activo', ...overrides };
      const r = await request('/personal', { method: 'POST', body }); assert.equal(r.status, 201, JSON.stringify(r.data)); return r.data;
    };
    const asset = async () => (await sql`INSERT INTO bienes_informaticos(nombre,fecha_adquisicion,costo) VALUES ('Equipo prueba',${today},100) RETURNING id`)[0].id;
    const valid = { tipo_vinculo: 'CAS', fecha_inicio: relative(-5), fecha_fin: relative(30), estado: 'vigente' };
    const worker = await person();
    let vinculo; let assignedAsset; let assignment;

    await t.test('autenticación, roles y validación sin escrituras parciales', async () => {
      const path = `/personal/${worker.id}/vinculos`;
      assert.equal((await request(path, { user: null })).status, 401);
      assert.equal((await request(path, { user: 5 })).status, 403);
      assert.equal((await request(path, { user: 4, method: 'POST', body: valid })).status, 403);
      assert.equal((await request(path, { method: 'POST', body: { ...valid, fecha_inicio: '2026-02-30' } })).status, 400);
      assert.equal((await request(path, { method: 'POST', body: { ...valid, fecha_fin: relative(-10) } })).status, 400);
      assert.equal((await sql`SELECT * FROM vinculo_laboral WHERE personal_id=${worker.id}`).length, 0);
      const r = await request(path, { user: 2, method: 'POST', body: valid }); assert.equal(r.status, 201, JSON.stringify(r.data)); vinculo = r.data;
      assert.equal(vinculo.estado_vigencia, 'vigente');
      const read = (await request(path, { user: 4 })).data;
      assert.equal(read.historial.length, 1); assert.equal(read.historial[0].usuario_id, users[2].id);
      assert.equal(read.personal.cargo, 'Analista');
      const list = await request('/personal'); assert.equal(list.status, 200, JSON.stringify(list.data));
      assert.equal(list.data.find((p) => p.id === worker.id).vinculo_laboral.id, vinculo.id);
    });

    await t.test('períodos superpuestos y actualizaciones concurrentes se rechazan', async () => {
      const path = `/personal/${worker.id}/vinculos`;
      assert.equal((await request(path, { method: 'POST', body: valid })).status, 409);
      const body = { ...valid, version: vinculo.version, motivo_cambio: 'Corrección de observaciones', observaciones: 'Dato actualizado' };
      const results = await Promise.all([request(`${path}/${vinculo.id}`, { user: 3, method: 'PUT', body }), request(`${path}/${vinculo.id}`, { user: 2, method: 'PUT', body })]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]); vinculo = results.find((r) => r.status === 200).data;
      assert.equal((await request(path)).data.historial.length, 2);
      const other = await person('CAP');
      assert.equal((await request(`/personal/${other.id}/vinculos/${vinculo.id}`, { method: 'PUT', body: { ...body, version: vinculo.version } })).status, 404);
      const simultaneous = await Promise.all([request(`/personal/${other.id}/vinculos`, { method: 'POST', body: { ...valid, tipo_vinculo: 'CAP' } }), request(`/personal/${other.id}/vinculos`, { method: 'POST', body: { ...valid, tipo_vinculo: 'CAP' } })]);
      assert.deepEqual(simultaneous.map((r) => r.status).sort(), [201, 409]);
    });

    await t.test('CAS/CAP sin vínculo, vencidos o futuros no reciben equipos', async () => {
      for (const [regimen, period] of [['CAS', null], ['CAP', { fecha_inicio: relative(-30), fecha_fin: relative(-1) }], ['CAS', { fecha_inicio: relative(1), fecha_fin: relative(30) }]]) {
        const p = await person(regimen);
        if (period) assert.equal((await request(`/personal/${p.id}/vinculos`, { method: 'POST', body: { ...valid, tipo_vinculo: regimen, ...period } })).status, 201);
        const bien = await asset();
        const body = { bien_id: bien, personal_id: p.id, fecha_asignacion: today };
        assert.equal((await request('/asignaciones', { method: 'POST', body })).status, 409);
        assert.equal((await request('/movimientos', { method: 'POST', body: { ...body, tipo: 'asignacion', fecha_movimiento: today, motivo: 'Incorporación' } })).status, 409);
        assert.equal((await sql`SELECT estado FROM bienes_informaticos WHERE id=${bien}`)[0].estado, 'activo');
      }
    });

    await t.test('asigna con el vínculo, protege historia y evita cambios de régimen por el CRUD', async () => {
      assignedAsset = await asset();
      const r = await request('/asignaciones', { method: 'POST', body: { bien_id: assignedAsset, personal_id: worker.id, fecha_asignacion: today } });
      assert.equal(r.status, 201, JSON.stringify(r.data)); assignment = r.data;
      assert.equal(assignment.vinculo_laboral_id, vinculo.id);
      const invalid = await request(`/personal/${worker.id}/vinculos/${vinculo.id}`, { method: 'PUT', body: { ...valid, tipo_vinculo: 'CAP', version: vinculo.version, motivo_cambio: 'Cambiar régimen histórico' } });
      assert.equal(invalid.status, 409);
      const update = await request(`/personal/${worker.id}`, { method: 'PUT', body: { ...worker, regimen_laboral: 'Servir' } });
      assert.equal(update.status, 409);
      assert.equal((await request(`/personal/${worker.id}`, { method: 'PUT', body: { ...worker, cargo: 'Especialista' } })).status, 200);
    });

    await t.test('renovación futura no cambia el régimen actual y se consulta según la fecha', async () => {
      const next = { tipo_vinculo: 'CAP', estado: 'vigente', fecha_inicio: relative(31), fecha_fin: '' };
      assert.equal((await request(`/personal/${worker.id}/vinculos`, { method: 'POST', body: next })).status, 201);
      assert.equal((await request(`/personal/${worker.id}`)).data.regimen_laboral, 'CAS');
      const bien = await asset();
      const r = await request('/asignaciones', { method: 'POST', body: { bien_id: bien, personal_id: worker.id, fecha_asignacion: relative(31) } });
      assert.equal(r.status, 201, JSON.stringify(r.data)); assert.notEqual(r.data.vinculo_laboral_id, vinculo.id);
    });

    await t.test('se permite devolver equipos de personal inactivo y con vínculo finalizado', async () => {
      const r = await request(`/personal/${worker.id}/vinculos/${vinculo.id}`, { method: 'PUT', body: { ...valid, fecha_fin: today, estado: 'finalizado', version: vinculo.version, motivo_cambio: 'Fin del vínculo' } });
      assert.equal(r.status, 200, JSON.stringify(r.data)); vinculo = r.data;
      assert.equal((await request(`/personal/${worker.id}`, { method: 'DELETE' })).status, 200);
      const returned = await request('/movimientos', { method: 'POST', body: { tipo: 'retiro', bien_id: assignedAsset, personal_id: worker.id, fecha_movimiento: today, motivo: 'Devolución por cese' } });
      assert.equal(returned.status, 201, JSON.stringify(returned.data)); assert.equal(returned.data.estado, 'aprobado');
      assert.equal((await sql`SELECT estado FROM bienes_informaticos WHERE id=${assignedAsset}`)[0].estado, 'activo');
      assert.equal((await sql`SELECT estado FROM asignaciones WHERE id=${assignment.id}`)[0].estado, 'devuelta');
    });

    await t.test('revalida vínculos al aprobar y conserva el flujo previo de otros regímenes', async () => {
      const boss = await person('Servir', { correo_institucional: users[1].email });
      const p = await person('Practicante', { jefe_inmediato: boss.id, correo_jefe: users[1].email });
      const period = { ...valid, tipo_vinculo: 'Practicante' };
      const link = (await request(`/personal/${p.id}/vinculos`, { method: 'POST', body: period })).data;
      const pending = await request('/movimientos', { method: 'POST', body: { tipo: 'asignacion', bien_id: await asset(), personal_id: p.id, fecha_movimiento: today, motivo: 'Prácticas' } });
      assert.equal(pending.status, 201, JSON.stringify(pending.data)); assert.equal(pending.data.estado, 'pendiente');
      assert.equal((await request(`/personal/${p.id}/vinculos/${link.id}`, { method: 'PUT', body: { ...period, fecha_fin: today, estado: 'finalizado', version: link.version, motivo_cambio: 'Cese antes de aprobar' } })).status, 200);
      assert.equal((await request(`/movimientos/${pending.data.id}/aprobacion`, { user: 1, method: 'POST', body: { aprobado: true } })).status, 409);
      assert.equal((await request(`/movimientos/${pending.data.id}/aprobacion`, { user: 1, method: 'POST', body: { aprobado: false } })).status, 200);
      const previous = await person('Personal de confianza');
      const accepted = await request('/movimientos', { method: 'POST', body: { tipo: 'asignacion', bien_id: await asset(), personal_id: previous.id, fecha_movimiento: today, motivo: 'Asignación' } });
      assert.equal(accepted.status, 201, JSON.stringify(accepted.data)); assert.equal(accepted.data.estado, 'aprobado');
    });

    await t.test('auditoría sobrevive a deshabilitar operadores y el JWT no permite nuevos cambios', async () => {
      await sql`UPDATE usuarios SET estado='inactivo', activo_login=FALSE WHERE id IN (${users[2].id},${users[3].id})`;
      assert.equal((await request(`/personal/${worker.id}/vinculos`, { user: 2 })).status, 403);
      const logs = await request('/auditoria?modulo=vinculo_laboral', { user: 4 });
      assert.equal(logs.status, 200, JSON.stringify(logs.data));
      assert.ok(logs.data.some((r) => r.usuario_id === users[2].id));
      const history = (await request(`/personal/${worker.id}/vinculos`, { user: 4 })).data.historial;
      assert.ok(history.some((r) => r.usuario_id === users[2].id && r.usuario_nombre === 'Técnico'));
      const [counts] = await sql`SELECT (SELECT count(*) FROM historial_vinculo_laboral)::int AS historial,
        (SELECT count(*) FROM audit_log WHERE tabla_afectada='vinculo_laboral' AND datos_nuevos->>'personal_id' IS NOT NULL)::int AS auditados`;
      assert.equal(counts.historial, counts.auditados);
      assert.equal((await sql`SELECT * FROM historial_vinculo_laboral WHERE usuario_id IS NULL`).length, 0);
    });

    await t.test('movimientos y reemplazos conservan el vínculo; retorno tras el cese y aprobación válida funcionan', async () => {
      const p = await person();
      const period = (await request(`/personal/${p.id}/vinculos`, { method: 'POST', body: valid })).data;
      const oldAsset = await asset(); const replacement = await asset(); const loanAsset = await asset();
      const movement = async (body) => request('/movimientos', { method: 'POST', body: { personal_id: p.id, fecha_movimiento: today, motivo: 'Prueba CUS12', ...body } });
      const assigned = await movement({ tipo: 'asignacion', bien_id: oldAsset });
      assert.equal(assigned.status, 201, JSON.stringify(assigned.data)); assert.equal(assigned.data.vinculo_laboral_id, period.id);
      const changed = await movement({ tipo: 'cambio', bien_id: oldAsset, bien_reemplazo_id: replacement });
      assert.equal(changed.status, 201, JSON.stringify(changed.data)); assert.equal(changed.data.vinculo_laboral_id, period.id);
      assert.equal((await sql`SELECT vinculo_laboral_id FROM asignaciones WHERE bien_id=${replacement} AND fecha_devolucion IS NULL`)[0].vinculo_laboral_id, period.id);
      const loan = await movement({ tipo: 'prestamo', bien_id: loanAsset, fecha_fin: relative(1) });
      assert.equal(loan.status, 201, JSON.stringify(loan.data));
      assert.equal((await request(`/personal/${p.id}/vinculos/${period.id}`, { method: 'PUT', body: { ...valid, fecha_fin: today, estado: 'finalizado', version: period.version, motivo_cambio: 'Cese' } })).status, 200);
      assert.equal((await request(`/personal/${p.id}`, { method: 'DELETE' })).status, 200);
      assert.equal((await request(`/movimientos/${loan.data.id}/retorno`, { method: 'POST', body: { fecha_retorno: today } })).status, 200);

      const [boss] = await sql`SELECT * FROM personal WHERE correo_institucional=${users[1].email}`;
      const trainee = await person('Practicante', { jefe_inmediato: boss.id, correo_jefe: users[1].email });
      const link = (await request(`/personal/${trainee.id}/vinculos`, { method: 'POST', body: { ...valid, tipo_vinculo: 'Practicante' } })).data;
      const pending = await request('/movimientos', { method: 'POST', body: { tipo: 'asignacion', bien_id: await asset(), personal_id: trainee.id, fecha_movimiento: today, motivo: 'Incorporación' } });
      assert.equal(pending.data.estado, 'pendiente');
      const approved = await request(`/movimientos/${pending.data.id}/aprobacion`, { user: 1, method: 'POST', body: { aprobado: true } });
      assert.equal(approved.status, 200, JSON.stringify(approved.data)); assert.equal(approved.data.vinculo_laboral_id, link.id);
      assert.equal((await sql`SELECT vinculo_laboral_id FROM asignaciones WHERE bien_id=${pending.data.bien_id} AND fecha_devolucion IS NULL`)[0].vinculo_laboral_id, link.id);
    });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (sql) await sql.end({ timeout: 5 });
    // Únicamente el esquema efímero de esta prueba. Nunca elimina tablas reales.
    if (/^sca_cus12_test_[a-f0-9]{16}$/.test(schema)) await admin.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end({ timeout: 5 });
    if (priorSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = priorSecret;
  }
});
