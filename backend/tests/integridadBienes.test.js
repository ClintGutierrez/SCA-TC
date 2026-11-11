import test from 'node:test';
import assert from 'node:assert/strict';
import { createBien, updateBien } from '../controllers/bienesController.js';

const response = () => ({
  statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});
const previous = {
  id: 1, nombre: 'Laptop de prueba', tipo: 'laptop', estado: 'activo',
  fecha_adquisicion: '2024-01-01', costo: '1000.00', usuario_asignado: null,
};
const validCreate = {
  codigoPatrimonial: 'PRUEBA-1', numeroSerie: 'SERIE-1', tipo: 'otro',
  marca: 'Prueba', modelo: 'Modelo', ubicacion: 'Central',
  fechaCompra: '2024-01-01', garantiaAnios: 0,
};

function database(row = previous) {
  const writes = [];
  const sql = async (parts, ...values) => {
    const query = parts.join('');
    if (query.includes('set_config')) return [];
    if (query.includes('SELECT * FROM bienes_informaticos')) return [{ ...row }];
    if (query.includes('UPDATE bienes_informaticos') || query.includes('INSERT INTO bienes_informaticos')) {
      writes.push({ query, values });
      return [{ ...row }];
    }
    assert.fail('Consulta inesperada en bienes');
  };
  sql.begin = (callback) => callback(sql);
  sql.json = (value) => value;
  return { sql, writes };
}

test('H04: la edición rechaza bajas, asignaciones y otros cambios de estado sin escribir', async () => {
  for (const estado of ['baja', 'asignado', 'mantenimiento', 'inactivo', '', null]) {
    const { sql, writes } = database();
    const res = response();
    await updateBien({ params: { id: 1 }, user: { sub: 7 }, body: { estado } }, res, sql);
    assert.equal(res.statusCode, 409, `Debe rechazar estado ${estado}`);
    assert.equal(writes.length, 0);
  }
});

test('H04: editar una ficha asignada no modifica su estado patrimonial', async () => {
  const { sql, writes } = database({ ...previous, estado: 'asignado' });
  const res = response();
  await updateBien({ params: { id: 1 }, user: { sub: 7 }, body: { nombre: 'Descripción corregida', estado: 'asignado' } }, res, sql);
  assert.equal(res.statusCode, 200);
  assert.equal(writes.length, 1);
  assert.doesNotMatch(writes[0].query, /\bestado\s*=/i);
  assert.equal(writes[0].values[0], 'Descripción corregida');
});

test('H04: rechaza costos negativos, no finitos y tipos inválidos al registrar y editar', async () => {
  for (const costo of [-1, '-0.01', Infinity, 'Infinity', 'NaN', 'sin dato', '   ', true, [], {}]) {
    const { sql, writes } = database();
    const edited = response();
    await updateBien({ params: { id: 1 }, user: { sub: 7 }, body: { costo } }, edited, sql);
    assert.equal(edited.statusCode, 400, `Debe rechazar costo ${String(costo)}`);
    const created = response();
    await createBien({ user: { sub: 7 }, body: { ...validCreate, valor: costo } }, created, sql);
    assert.equal(created.statusCode, 400);
    assert.equal(writes.length, 0);
  }
});

test('H04: admite costo cero y valores decimales al registrar y editar', async () => {
  for (const costo of [0, '0', '1250.50']) {
    const { sql, writes } = database();
    const edited = response();
    await updateBien({ params: { id: 1 }, user: { sub: 7 }, body: { costo } }, edited, sql);
    assert.equal(edited.statusCode, 200);
    assert.ok(writes[0].values.includes(Number(costo)));
    const created = response();
    await createBien({ user: { sub: 7 }, body: { ...validCreate, valor: costo } }, created, sql);
    assert.equal(created.statusCode, 201);
    assert.equal(writes.length, 2);
    assert.ok(writes[1].values.includes(Number(costo)));
  }
});

test('registrar un bien exige el valor: sin él responde 400 y no escribe', async () => {
  const sinValor = { ...validCreate };
  for (const body of [sinValor, { ...validCreate, valor: '' }, { ...validCreate, valor: null }]) {
    const { sql, writes } = database();
    const res = response();
    await createBien({ user: { sub: 7 }, body }, res, sql);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.campos.valor, /obligatorio/);
    assert.equal(writes.length, 0);
  }
});

test('H04: una ficha dada de baja sigue bloqueada para edición', async () => {
  const { sql, writes } = database({ ...previous, estado: 'baja' });
  const res = response();
  await updateBien({ params: { id: 1 }, user: { sub: 7 }, body: { estado: 'activo', costo: 0 } }, res, sql);
  assert.equal(res.statusCode, 403);
  assert.equal(writes.length, 0);
});
