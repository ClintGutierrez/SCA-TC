import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararInventario, filtrarInventario, paginarInventario } from '../src/utils/inventario.js';

const assets = [
  { id: 1, nombre: 'Laptop administración', codigo_patrimonial: 'PAT-001', numero_serie: 'SER-01', tipo: 'laptop', marca: 'Dell', modelo: 'Latitude', orden_compra: 'OC-2024', direccion_mac: 'AA:BB:CC:DD:EE:FF', ubicacion: 'Central', estado: 'asignado', usuario_asignado: 'Persona', costo: '2500', fecha_adquisicion: '2024-02-15', garantia_anios: 3,
    especificaciones: '{"ram":"8 GB","procesador":"Intel"}', detalles: { ram: '16 GB', almacenamiento: '512 GB' } },
  { id: 2, nombre: 'Monitor', codigo_patrimonial: 'PAT-002', numero_serie: 'SER-02', tipo: 'monitor', marca: 'LG', modelo: '24 pulgadas', orden_compra: 'OC-2025', ubicacion: 'Arequipa', estado: 'activo', costo: '800', fecha_adquisicion: '2025-05-10', garantia_anios: 0, especificaciones: 'malformado', detalles: null },
  { id: 3, nombre: 'Laptop soporte', codigo_patrimonial: 'PAT-003', tipo: 'laptop', marca: 'Lenovo', modelo: 'ThinkPad', ubicacion: 'Central', estado: 'mantenimiento', costo: 0, fecha_adquisicion: '2023-01-01', garantia_anios: null, detalles: '{"ram":"8 GB"}' },
];
const ids = (rows) => rows.map((row) => row.id);

test('inventario: búsqueda general y filtros de texto se combinan sin perder campos', () => {
  const index = prepararInventario(assets);
  for (const [key, value] of Object.entries({ busqueda: ' LATITUDE ', codigo: 'pat-001', serie: 'ser-01', marca: 'DELL', modelo: 'latitude', ordenCompra: '2024', mac: 'aa:bb', ubicacion: 'central' })) {
    assert.ok(ids(filtrarInventario(index, { [key]: value })).includes(1));
  }
  assert.deepEqual(ids(filtrarInventario(index, { busqueda: 'laptop', tipo: 'laptop', estado: 'asignado', ubicacion: 'Central' })), [1]);
  assert.equal(filtrarInventario(index, { busqueda: 'no existe' }).length, 0);
});

test('inventario: costo cero, límites inclusivos, fechas, asignación y garantía conservan los resultados', () => {
  const index = prepararInventario(assets);
  assert.deepEqual(ids(filtrarInventario(index, { costoMin: '800', costoMax: '2500', fechaDesde: '2024-02-15', fechaHasta: '2025-05-10' })), [1, 2]);
  assert.deepEqual(ids(filtrarInventario(index, { costoMax: '0', asignacion: 'disponible' })), [3]);
  assert.deepEqual(ids(filtrarInventario(index, { asignacion: 'asignado', garantia: 'con_garantia' })), [1]);
  assert.deepEqual(ids(filtrarInventario(index, { garantia: 'sin_garantia' })), [2, 3]);
  assert.deepEqual(filtrarInventario(index, { costoMin: 'inválido' }), []);
});

test('inventario: consulta especificaciones solo al filtrar por ellas y reutiliza su lectura', () => {
  let reads = 0;
  const asset = { id: 1, nombre: 'Equipo', tipo: 'laptop', get especificaciones() { reads++; return '{"ram":"8 GB"}'; }, detalles: { ram: '16 GB' } };
  const index = prepararInventario([asset]);
  assert.deepEqual(ids(filtrarInventario(index)), [1]);
  assert.deepEqual(ids(filtrarInventario(index, { tipo: 'monitor', tecnicos: { ram: '16 GB' } })), []);
  assert.equal(reads, 0);
  assert.deepEqual(ids(filtrarInventario(index, { tecnicos: { ram: '16 GB' } })), [1]);
  assert.deepEqual(ids(filtrarInventario(index, { especificacion: 'ram 16 gb' })), [1]);
  assert.equal(reads, 1);
  assert.deepEqual(filtrarInventario(index, { tecnicos: { ram: '8 GB' } }), []);
});

test('inventario: especificaciones malformadas no rompen la búsqueda técnica', () => {
  const index = prepararInventario(assets);
  assert.deepEqual(ids(filtrarInventario(index, { tecnicos: { ram: '8 GB' } })), [3]);
  assert.deepEqual(ids(filtrarInventario(index, { especificacion: '512 GB' })), [1]);
});

test('inventario: paginación acotada, sin duplicados y con rango válido al cambiar resultados', () => {
  const rows = Array.from({ length: 1815 }, (_, index) => ({ id: index + 1 }));
  const first = paginarInventario(rows);
  assert.equal(first.rows.length, 25); assert.equal(first.total, 1815); assert.equal(first.totalPages, 73);
  assert.equal(first.start, 1); assert.equal(first.end, 25);
  const last = paginarInventario(rows, 1000);
  assert.equal(last.page, 73); assert.equal(last.rows.length, 15); assert.equal(last.end, 1815);
  assert.equal(new Set([...first.rows, ...paginarInventario(rows, 2).rows].map((row) => row.id)).size, 50);
  assert.equal(paginarInventario(rows, 1, 50).rows.length, 50);
  assert.equal(paginarInventario(rows, 1, 100).rows.length, 100);
  assert.equal(paginarInventario(rows, 1, 10000).rows.length, 25);
  assert.deepEqual(paginarInventario([], 20).rows, []);
  assert.equal(paginarInventario([], 20).start, 0);
});

test('inventario: los filtros buscan en todos los bienes antes de paginar', () => {
  const rows = Array.from({ length: 200 }, (_, index) => ({ id: index + 1, codigo_patrimonial: `PAT-${index + 1}` }));
  const filtered = filtrarInventario(prepararInventario(rows), { codigo: 'PAT-199' });
  assert.deepEqual(ids(paginarInventario(filtered, 1).rows), [199]);
});
