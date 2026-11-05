import test from 'node:test';
import assert from 'node:assert/strict';
import { resumirInventario, contarVinculosPendientes, actividadDashboard } from '../src/utils/dashboard.js';

test('el resumen separa asignados y mantenimiento y mantiene todos los bienes en la distribución', () => {
  const r = resumirInventario([
    { estado: 'activo', tipo: 'Laptop', costo: '1000.50' }, { estado: 'asignado', tipo: 'laptop', costo: 1500 },
    { estado: 'mantenimiento', tipo: 'Impresora', costo: 800 }, { estado: 'baja', costo: null },
    { estado: 'antiguo', tipo: 'Laptop', costo: 'sin dato' },
  ]);
  assert.equal(r.total, 5); assert.equal(r.costo, 3300.5); assert.equal(r.sinCosto, 2);
  assert.deepEqual(r.estados.map((e) => e.count), [1, 1, 1, 1, 1]);
  assert.equal(r.estados.reduce((sum, e) => sum + e.percent, 0), 100);
  assert.equal(r.categorias[0].count, 3); assert.equal(r.categorias.reduce((sum, c) => sum + c.count, 0), 5);
  const empty = resumirInventario([]); assert.equal(empty.total, 0); assert.equal(empty.costo, 0);
  assert.ok(empty.estados.every((e) => e.percent === 0));
});

test('pendientes CAS/CAP distingue el estado del trabajador y los extremos inclusivos del período', () => {
  const person = { estado: 'activo', regimen_laboral: 'CAS' };
  const valid = { vigente: true, fecha_inicio: '2026-11-03', fecha_fin: '2026-11-03' };
  const rows = [person, { ...person, vinculo_laboral: valid }, { ...person, estado: 'inactivo' },
    { ...person, regimen_laboral: 'Servir' }, { ...person, vinculo_laboral: { ...valid, vigente: false } },
    { ...person, vinculo_laboral: { ...valid, fecha_inicio: '2026-11-04', fecha_fin: null } },
    { ...person, vinculo_laboral: { ...valid, fecha_inicio: '2026-10-01', fecha_fin: '2026-11-02' } }];
  assert.equal(contarVinculosPendientes(rows, '2026-11-03'), 4);
});

test('actividad usa fechas reales, la actualización más reciente y omite fechas inválidas o futuras', () => {
  const now = Date.parse('2026-11-03T18:00:00Z');
  const rows = actividadDashboard({
    movimientos: [{ id: 1, tipo: 'asignacion', created_at: '2026-11-01T12:00:00Z', updated_at: '2026-11-03T17:00:00Z' }],
    solicitudes: [{ id: 1, codigo: 'SOL-1', created_at: '2026-11-02T12:00:00Z' }, { id: 2, created_at: 'inválida' }],
    pedidos: [{ id: 1, numero: 'OC-1', created_at: '2026-11-04T00:00:00Z' }],
  }, now);
  assert.deepEqual(rows.map((r) => r.id), ['movimiento-1', 'solicitud-1']);
  assert.equal(rows[1].view, 'solicitudes_ti'); assert.equal(actividadDashboard({}, now).length, 0);
});
