import test from 'node:test';
import assert from 'node:assert/strict';
import { actualizarDepreciacion, crearDepreciacion, getDepreciacionPorBien } from '../controllers/depreciacionController.js';
import { anoLima, calcularAlAno, calcularDepreciacion } from '../utils/depreciacion.js';

const response = () => ({ statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const original = { id: 3, bien_id: 7, valor_inicial: '1000.00', porcentaje_anual: '20.00',
  valor_actual: '800.00', ano_base: 2024, ano_actual: 2025 };
const today = new Date('2026-11-05T12:00:00Z');

function database({ rows = [original], assetExists = true, acquisitionYear = 2024 } = {}) {
  let records = rows.map((row) => ({ ...row }));
  const writes = [];
  const sql = async (parts, ...values) => {
    const query = parts.join('');
    if (query.includes('FROM bienes_informaticos')) return assetExists ? [{ id: 7, ano_adquisicion: acquisitionYear }] : [];
    if (query.includes('SELECT id FROM depreciacion')) return records.map(({ id }) => ({ id }));
    if (query.includes('SELECT * FROM depreciacion')) return records.map((row) => ({ ...row }));
    if (query.includes('UPDATE depreciacion')) {
      assert.match(query, /WHERE id =/);
      assert.doesNotMatch(query, /SET[\s\S]*ano_base\s*=/);
      writes.push({ query, values });
      records = records.map((row) => row.id === values[2] ? { ...row, valor_actual: values[0], ano_actual: values[1] } : row);
      return records.filter((row) => row.id === values[2]);
    }
    if (query.includes('INSERT INTO depreciacion')) {
      writes.push({ query, values });
      records = [{ id: 3, bien_id: values[0], valor_inicial: values[1], porcentaje_anual: values[2],
        valor_actual: values[3], ano_base: values[4], ano_actual: values[5] }];
      return records;
    }
    assert.fail('Consulta inesperada en depreciación');
  };
  sql.begin = (callback) => callback(sql);
  return { sql, writes };
}

test('H05: repetir el cálculo mantiene S/ 600 y conserva el año base', async () => {
  const { sql, writes } = database();
  for (let run = 0; run < 3; run++) {
    const res = response();
    await actualizarDepreciacion({ params: { bienId: 7 } }, res, sql, today);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.valor_actual, 600);
    assert.equal(res.body.ano_base, 2024);
    assert.equal(res.body.ano_actual, 2026);
  }
  assert.equal(writes.length, 3);
});

test('H05: calcular cada año o saltar años da el mismo importe sin acumular redondeos', async () => {
  const initial = { ...original, valor_inicial: '0.05', valor_actual: '0.05', ano_actual: 2024 };
  const scheduled = database({ rows: [initial] });
  let last;
  for (const year of [2025, 2026, 2027]) {
    last = response();
    await actualizarDepreciacion({ params: { bienId: 7 } }, last, scheduled.sql, new Date(`${year}-11-05T12:00:00Z`));
  }
  const direct = database({ rows: [initial] });
  const res = response();
  await actualizarDepreciacion({ params: { bienId: 7 } }, res, direct.sql, new Date('2027-11-05T12:00:00Z'));
  assert.equal(last.body.valor_actual, 0.02);
  assert.equal(res.body.valor_actual, last.body.valor_actual);
});

test('depreciación en línea recta: el mismo importe cada año hasta llegar a cero', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((anios) => calcularDepreciacion(1000, 20, anios)), [1000, 800, 600, 400, 200, 0, 0]);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((anios) => calcularDepreciacion(1000, 25, anios)), [1000, 750, 500, 250, 0, 0]);
  // Redondeo único de la depreciación acumulada (no de cada año).
  assert.equal(calcularDepreciacion('333.33', '33.33', 2), 111.13);
  assert.equal(calcularDepreciacion('9999999999.99', '99.99', 1), 1000000);
});

test('H05: el cambio de año usa Lima y admite tasa cero, 100 %, costo cero y límites', () => {
  assert.equal(anoLima(new Date('2027-01-01T04:59:59Z')), 2026);
  assert.equal(anoLima(new Date('2027-01-01T05:00:00Z')), 2027);
  assert.equal(calcularDepreciacion(1000, 0, 100), 1000);
  assert.equal(calcularDepreciacion(1000, 100, 0), 1000);
  assert.equal(calcularDepreciacion(1000, 100, 1), 0);
  assert.equal(calcularDepreciacion(0, 20, 100), 0);
  assert.equal(calcularDepreciacion('9999999999.99', 0, 1), 9999999999.99);
  assert.equal(calcularDepreciacion('100.01', '99.99', 1), 0.01);
});

test('H05: rechaza bases futuras, ausentes y cronología inválida sin escribir', async () => {
  for (const patch of [{ ano_base: null }, { ano_base: 2027 }, { ano_base: 0 }, { ano_base: 2025, ano_actual: 2024 },
    { ano_actual: 2027 }, { ano_actual: null }, { valor_inicial: '-1.00' }, { porcentaje_anual: 'NaN' }]) {
    const { sql, writes } = database({ rows: [{ ...original, ...patch }] });
    const res = response();
    await actualizarDepreciacion({ params: { bienId: 7 } }, res, sql, today);
    assert.equal(res.statusCode, 409, JSON.stringify(patch));
    assert.equal(writes.length, 0);
  }
  assert.throws(() => calcularAlAno(original, 2023), { status: 409 });
  assert.throws(() => calcularDepreciacion(1000, 20, -1), { status: 400 });
  assert.throws(() => calcularDepreciacion(1000, 20, 1.5), { status: 400 });
});

test('H05: registro conserva el 0 % explícito y usa 20 % solo cuando se omite', async () => {
  for (const rate of [0, '0', undefined, 100]) {
    const { sql } = database({ rows: [] });
    const res = response();
    await crearDepreciacion({ body: { bienId: 7, valorInicial: '1250.50', porcentajeAnual: rate } }, res, sql, today);
    assert.equal(res.statusCode, 201);
    const effective = rate === undefined ? 20 : Number(rate);
    assert.equal(res.body.porcentaje_anual, effective);
    assert.equal(res.body.valor_inicial, 1250.5);
    // Bien adquirido en 2024: en 2026 ya acumula dos años de depreciación.
    assert.equal(res.body.valor_actual, calcularDepreciacion(1250.5, effective, 2));
    assert.equal(res.body.ano_base, 2024);
    assert.equal(res.body.ano_actual, 2026);
  }
});

test('depreciación: el año base es el de adquisición del bien, no el del registro', async () => {
  const { sql } = database({ rows: [], acquisitionYear: 2022 });
  const res = response();
  await crearDepreciacion({ body: { bienId: 7, valorInicial: 1000 } }, res, sql, today);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.ano_base, 2022);
  assert.equal(res.body.ano_actual, 2026);
  assert.equal(res.body.valor_actual, 200);

  const sameYear = database({ rows: [], acquisitionYear: 2026 });
  const fresh = response();
  await crearDepreciacion({ body: { bienId: 7, valorInicial: 1000 } }, fresh, sameYear.sql, today);
  assert.equal(fresh.body.valor_actual, 1000, 'Adquirido este año: aún no se deprecia');
});

test('depreciación: una fecha de adquisición futura o ausente se rechaza sin escribir', async () => {
  for (const acquisitionYear of [2027, null, 0]) {
    const { sql, writes } = database({ rows: [], acquisitionYear });
    const res = response();
    await crearDepreciacion({ body: { bienId: 7, valorInicial: 1000 } }, res, sql, today);
    assert.equal(res.statusCode, 409, String(acquisitionYear));
    assert.equal(writes.length, 0);
  }
});

test('depreciación: recalcular exige que el año base coincida con la adquisición del bien', async () => {
  // Registro creado con la regla anterior (año de registro 2024) para un bien comprado en 2021.
  const { sql, writes } = database({ acquisitionYear: 2021 });
  const res = response();
  await actualizarDepreciacion({ params: { bienId: 7 } }, res, sql, today);
  assert.equal(res.statusCode, 409);
  assert.match(res.body.error, /conciliación/);
  assert.equal(writes.length, 0);
});

test('H05: valores y porcentajes inválidos se rechazan antes de consultar SQL', async () => {
  const sql = () => assert.fail('No debe consultar la base con datos inválidos');
  for (const amount of [-1, 'NaN', Infinity, null, undefined, true, [], {}, '', ' ', '0x10', '1e2', 0.001, 10000000000]) {
    const res = response();
    await crearDepreciacion({ body: { bienId: 7, valorInicial: amount } }, res, sql, today);
    assert.equal(res.statusCode, 400, `Importe ${String(amount)}`);
  }
  for (const rate of [-1, 100.01, Infinity, 'NaN', null, true, [], {}, '', ' ', 0.001]) {
    const res = response();
    await crearDepreciacion({ body: { bienId: 7, valorInicial: 1000, porcentajeAnual: rate } }, res, sql, today);
    assert.equal(res.statusCode, 400, `Porcentaje ${String(rate)}`);
  }
});

test('H05: bien ausente, registro duplicado y depreciación ausente no escriben', async () => {
  for (const [options, status] of [[{ rows: [], assetExists: false }, 404], [{}, 409]]) {
    const { sql, writes } = database(options);
    const res = response();
    await crearDepreciacion({ body: { bienId: 7, valorInicial: 1000 } }, res, sql, today);
    assert.equal(res.statusCode, status);
    assert.equal(writes.length, 0);
  }
  for (const [rows, status] of [[[], 404], [[original, { ...original, id: 4 }], 409]]) {
    const { sql, writes } = database({ rows });
    for (const controller of [actualizarDepreciacion, getDepreciacionPorBien]) {
      const res = response();
      await controller({ params: { bienId: 7 } }, res, sql, today);
      assert.equal(res.statusCode, status);
    }
    assert.equal(writes.length, 0);
  }
});

test('H05: IDs inválidos no alcanzan la base de datos', async () => {
  const sql = () => assert.fail('No debe consultar SQL');
  for (const id of [0, -1, '1.5', 'NaN', undefined, null, true, [], {}, 2147483648]) {
    for (const controller of [actualizarDepreciacion, getDepreciacionPorBien]) {
      const res = response();
      await controller({ params: { bienId: id } }, res, sql, today);
      assert.equal(res.statusCode, 400);
    }
  }
});
