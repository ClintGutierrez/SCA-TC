import test from 'node:test';
import assert from 'node:assert/strict';
import { esFecha, estadoVinculo, prepararVinculo } from '../utils/vinculoLaboral.js';

test('CUS12 valida fechas de calendario y años bisiestos', () => {
  assert.equal(esFecha('2024-02-29'), true);
  for (const value of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-04-31', '0000-01-01', '29/10/2026', '', null]) assert.equal(esFecha(value), false);
});

test('vigencia incluye ambos extremos, distingue futuros, vencidos y cierre manual', () => {
  const v = { vigente: true, fecha_inicio: '2026-01-01', fecha_fin: '2026-10-29' };
  assert.equal(estadoVinculo(v, '2025-12-31'), 'programado');
  assert.equal(estadoVinculo(v, '2026-01-01'), 'vigente');
  assert.equal(estadoVinculo(v, '2026-10-29'), 'vigente');
  assert.equal(estadoVinculo(v, '2026-10-30'), 'vencido');
  assert.equal(estadoVinculo({ ...v, vigente: false }, '2026-01-01'), 'finalizado');
  assert.equal(estadoVinculo({ ...v, fecha_fin: null }, '2030-01-01'), 'vigente');
});

test('los cambios exigen motivo y versión y no admiten fechas incoherentes', () => {
  const v = { tipo_vinculo: 'CAS', estado: 'vigente', fecha_inicio: '2026-01-01', fecha_fin: '' };
  assert.equal(prepararVinculo(v).error, undefined);
  assert.equal(prepararVinculo(v).data.fecha_fin, null);
  assert.ok(prepararVinculo({ ...v, fecha_fin: '2025-12-31' }).error);
  assert.ok(prepararVinculo({ ...v, estado: 'finalizado' }).error);
  assert.ok(prepararVinculo({ ...v, estado: 'cualquiera' }).error);
  assert.ok(prepararVinculo({ ...v, version: 1 }, true).error);
  assert.ok(prepararVinculo({ ...v, motivo_cambio: 'Corrección' }, true).error);
  assert.equal(prepararVinculo({ ...v, version: 1, motivo_cambio: 'Corrección' }, true).error, undefined);
});
