import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { updateBien } from '../controllers/bienesController.js';
import { idValido } from '../utils/ids.js';
import { createBienesRouter } from '../routes/bienes.js';
import { createMovimientosRouter } from '../routes/movimientos.js';

const response = () => ({
  statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const previous = {
  id: 1, nombre: 'Laptop de prueba', tipo: 'laptop', estado: 'activo',
  fecha_adquisicion: new Date('2022-03-15T00:00:00Z'), costo: '1000.00', usuario_asignado: null,
  codigo_patrimonial: 'PAT-1', numero_serie: 'SERIE-1', direccion_mac: null, garantia_anios: 1,
  detalles: { procesador: 'i5', ram: '16 GB', almacenamiento: '512 GB', pantalla: '14"' },
};

// SQL simulado: registra escrituras y responde a la depreciación si se le pasa una fila.
function database({ row = previous, depreciacion = [] } = {}) {
  const log = [];
  const sql = async (parts, ...values) => {
    const query = parts.join('?');
    log.push({ query, values });
    if (query.includes('SELECT * FROM bienes_informaticos')) return [{ ...row }];
    if (query.includes('SELECT * FROM depreciacion')) return depreciacion.map((d) => ({ ...d }));
    if (query.includes('UPDATE bienes_informaticos')) return [{ ...row }];
    return [];
  };
  sql.begin = (callback) => callback(sql);
  sql.json = (value) => value;
  const find = (text) => log.filter((q) => q.query.includes(text));
  return { sql, log, find };
}

const editar = async (body, db = database()) => {
  const res = response();
  await updateBien({ params: { id: 1 }, user: { sub: 7 }, body }, res, db.sql);
  return { res, db };
};

test('edición: rechaza los mismos datos inválidos que el registro, sin escribir', async () => {
  for (const [body, campo] of [
    [{ tipo: 'router' }, 'tipo'],
    [{ tipo: 'tostadora' }, 'tipo'],
    [{ direccionMac: 'no-es-mac' }, 'direccionMac'],
    [{ garantiaAnios: 11 }, 'garantiaAnios'],
    [{ garantiaAnios: 1.5 }, 'garantiaAnios'],
    [{ garantiaAnios: '' }, 'garantiaAnios'],
    [{ fechaAdquisicion: '2024-02-30' }, 'fechaAdquisicion'],
    [{ fechaAdquisicion: '15/03/2022' }, 'fechaAdquisicion'],
    [{ fechaAdquisicion: '2999-01-01' }, 'fechaAdquisicion'],
    [{ imagenUrl: 'javascript:alert(1)' }, 'imagenUrl'],
    [{ especificaciones: ['no', 'objeto'] }, 'especificaciones'],
    [{ especificaciones: { ram: { anidado: true } } }, 'especificaciones'],
    [{ detalles: 'texto' }, 'detalles'],
    [{ detalles: { procesador: 'i7' } }, 'detalles.ram'],
    [{ codigoPatrimonial: '' }, 'codigoPatrimonial'],
    [{ numeroSerie: '   ' }, 'numeroSerie'],
  ]) {
    const { res, db } = await editar(body);
    assert.equal(res.statusCode, 400, `Debe rechazar ${JSON.stringify(body)}`);
    assert.ok(res.body.campos?.[campo], `Debe señalar ${campo} para ${JSON.stringify(body)}`);
    assert.equal(db.find('UPDATE bienes_informaticos').length, 0);
  }
});

test('edición: una ficha con tipo antiguo se sigue editando si no cambia el tipo', async () => {
  const db = database({ row: { ...previous, tipo: 'all_in_one', detalles: {} } });
  const { res } = await editar({ tipo: 'all_in_one', nombre: 'Equipo renombrado' }, db);
  assert.equal(res.statusCode, 200);
});

test('edición: normaliza la MAC y guarda la garantía como número', async () => {
  const { res, db } = await editar({ direccionMac: 'a1-b2-c3-d4-e5-f6', garantiaAnios: '3' });
  assert.equal(res.statusCode, 200);
  const [update] = db.find('UPDATE bienes_informaticos');
  assert.ok(update.values.includes('A1:B2:C3:D4:E5:F6'));
  assert.ok(update.values.includes(3));
});

test('edición: al cambiar de tipo sin enviar detalles solo se conservan los compatibles', async () => {
  const { res, db } = await editar({ tipo: 'computadora' });
  assert.equal(res.statusCode, 200);
  const [update] = db.find('UPDATE bienes_informaticos');
  const detalles = update.values.find((v) => v && typeof v === 'object' && 'procesador' in v);
  assert.deepEqual(detalles, { procesador: 'i5', ram: '16 GB', almacenamiento: '512 GB' });
});

test('edición: cambiar el año de adquisición concilia la depreciación en la misma transacción', async () => {
  const depreciacion = [{ id: 9, bien_id: 1, valor_inicial: '1000.00', porcentaje_anual: '25.00', valor_actual: '250.00', ano_base: 2022, ano_actual: 2025 }];
  const db = database({ depreciacion });
  const { res } = await editar({ fechaAdquisicion: '2024-06-01' }, db);
  assert.equal(res.statusCode, 200);
  const [conciliacion] = db.find('UPDATE depreciacion');
  // 2024 → 2025: un año al 25 % sobre 1000.
  assert.deepEqual(conciliacion.values.slice(0, 3), [2024, 2025, 750]);
  const flags = db.find('app.conciliar_ano_base').map((q) => q.query);
  assert.equal(flags.length, 2, 'Activa y desactiva la conciliación');
  const [audit] = db.find('INSERT INTO audit_log');
  assert.equal(audit.values[0], 7, 'La conciliación queda auditada a nombre de quien editó');
});

test('edición: el mismo año de adquisición no toca la depreciación', async () => {
  const db = database({ depreciacion: [{ id: 9, ano_base: 2022 }] });
  const { res } = await editar({ fechaAdquisicion: '2022-12-31' }, db);
  assert.equal(res.statusCode, 200);
  assert.equal(db.find('depreciacion').length, 0);
});

test('edición: varias depreciaciones del bien bloquean el cambio de fecha con 409', async () => {
  const db = database({ depreciacion: [{ id: 1, ano_base: 2022 }, { id: 2, ano_base: 2022 }] });
  const { res } = await editar({ fechaAdquisicion: '2023-01-01' }, db);
  assert.equal(res.statusCode, 409);
  assert.equal(db.find('UPDATE bienes_informaticos').length, 0);
});

test('ids: solo enteros positivos dentro del rango de INTEGER', () => {
  for (const ok of [1, '1', '2147483647', 42]) assert.equal(idValido(ok), true, String(ok));
  for (const bad of ['0', 0, '-1', '1.5', 'abc', '', ' 1', '2147483648', '1e3', null, undefined, [], {}]) {
    assert.equal(idValido(bad), false, String(bad));
  }
});

// Rutas reales: un id inválido responde 400 antes de llegar a la base de datos.
test('ids: bienes y movimientos responden 400 a un id inválido sin consultar el bien', async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'secreto-local-para-pruebas-de-ids';
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  const queries = [];
  const sql = async (parts, ...values) => {
    const query = parts.join('?');
    queries.push(query);
    if (query.includes('FROM usuarios')) {
      return [{ id: 1, nombre: 'Admin', email: 'admin@example.test', rol: 'administrador', estado: 'activo', activo_login: true }];
    }
    return [];
  };
  sql.begin = (callback) => callback(sql);
  const app = express();
  app.use(express.json());
  app.use('/api/bienes', createBienesRouter(sql));
  app.use('/api/movimientos', createMovimientosRouter(sql));
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise((resolve) => server.once('listening', resolve));
  const token = jwt.sign({ sub: 1, type: 'access' }, process.env.JWT_SECRET, { issuer: 'inventario-bienes', audience: 'inventario-web' });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = (method, path) => fetch(`${base}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : '{}',
  });

  for (const [method, path] of [
    ['GET', '/bienes/abc'], ['PUT', '/bienes/1.5'], ['DELETE', '/bienes/-1'], ['GET', '/bienes/0/historial'],
    ['POST', '/movimientos/abc/aprobacion'], ['POST', '/movimientos/9999999999/retorno'], ['GET', '/movimientos/x/documento'],
  ]) {
    queries.length = 0;
    const res = await call(method, path);
    assert.equal(res.status, 400, `${method} ${path}`);
    assert.equal(queries.some((q) => !q.includes('FROM usuarios')), false, `${method} ${path} no debe consultar más allá de la sesión`);
  }

  const sinToken = await fetch(`${base}/bienes/abc`);
  assert.equal(sinToken.status, 401, 'La autenticación se comprueba antes que el id');
});
