import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import {
  crearPlantillaCsv,
  crearPlantillaInventario,
  MENSAJE_ESTRUCTURA_INVALIDA,
  parseImportFile,
  PLANTILLA_INVENTARIO,
  validarRegistrosInventario,
} from '../utils/migracionInventario.js';
import { getExisting } from '../controllers/migracionInventarioController.js';

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const csvFile = (records, headers = PLANTILLA_INVENTARIO.map(({ header }) => header)) => ({
  originalname: 'inventario.csv',
  buffer: Buffer.from([headers, ...records].map((row) => row.map(csvCell).join(',')).join('\r\n')),
});
const validRow = (overrides = {}) => ({
  codigo_patrimonial: 'PAT-001',
  numero_serie: 'SERIE-001',
  tipo: 'teclado',
  marca: 'Logitech',
  modelo: 'K120',
  direccion_mac: '',
  ubicacion: 'Sede Central - Almacén',
  fecha_adquisicion: '2024-03-15',
  costo: '125.50',
  garantia_anios: '2',
  orden_compra: 'OC-2024-1',
  descripcion: 'Teclado USB',
  detalles: '{"conexion":"USB"}',
  ...overrides,
});
const asCsvRow = (record) => PLANTILLA_INVENTARIO.map(({ key }) => record[key]);

test('descarga una plantilla Excel con los encabezados oficiales y CSV en el mismo orden', async () => {
  const buffer = await crearPlantillaInventario();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.deepEqual(
    workbook.worksheets[0].getRow(1).values.slice(1),
    PLANTILLA_INVENTARIO.map(({ header }) => header),
  );
  assert.match(crearPlantillaCsv(), /^﻿"Código Patrimonial"/);
  assert.ok(crearPlantillaCsv().includes('"Detalles técnicos (JSON)"'));
});

test('lee filas CSV respetando comas, comillas y el número de fila original', async () => {
  const row = validRow({ descripcion: 'Equipo, con "detalles" incluidos' });
  const parsed = await parseImportFile(csvFile([asCsvRow(row)]));
  assert.equal(parsed[0].fila, 2);
  assert.equal(parsed[0].valores.descripcion, row.descripcion);
});

test('lee filas del archivo Excel oficial', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Inventario');
  sheet.addRow(PLANTILLA_INVENTARIO.map(({ header }) => header));
  sheet.addRow(asCsvRow(validRow()));
  const parsed = await parseImportFile({
    originalname: 'inventario.xlsx',
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  });
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].valores.codigo_patrimonial, 'PAT-001');
});

test('acepta los cinco activos del Excel compartido, incluidos Router y detalles técnicos incompletos', async () => {
  const rows = [
    ['PAT-2026-8001', 'SN-1001A-2026', 'Laptop', 'Dell', 'Latitude 5440', '00:1A:2B:3C:4D:5E', 'Sede Central - Piso 1', '2024-01-15', 3500.5, 3, 'OC-2026-001', 'RAM 16GB, 512GB SSD', '{"cpu":"Core i5"}'],
    ['PAT-2026-8002', 'SN-1002B-2026', 'Monitor', 'LG', '27 UltraGear', '', 'Sede Norte - Piso 1', '2023-11-20', 850, 2, 'OC-2026-002', '27 pulgadas 144Hz', '{"resolucion":"1440p"}'],
    ['PAT-2026-8003', 'SN-1003C-2026', 'Router', 'MikroTik', 'CCR2004', '00:1A:2B:3C:4D:5F', 'Data Center - Rack 04', '2022-08-05', 1200, 5, 'OC-2026-003', '12x Gigabit Ethernet', '{"puertos":12}'],
    ['PAT-2026-8004', 'SN-1004D-2026', 'Teclado', 'Logitech', 'MX Keys', '', 'Sede Sur - Almacén', '2024-03-10', 350, 1, 'OC-2026-004', 'Inalámbrico, Español', '{}'],
    ['PAT-2026-8005', 'SN-1005E-2026', 'Impresora', 'HP', 'LaserJet M404', '00:1A:2B:3C:4D:6A', 'Sede Central - Piso 2', '2023-06-25', 900, 2, 'OC-2026-005', 'Láser monocromo', '{"ppm":40}'],
  ];
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Inventario');
  sheet.addRow(PLANTILLA_INVENTARIO.map(({ header }) => header));
  rows.forEach((row) => sheet.addRow(row));
  workbook.addWorksheet('Instrucciones').addRow(['Hoja adicional de instrucciones']);
  const file = {
    originalname: 'inventario_valido_oficial.xlsx',
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  };
  const parsed = await parseImportFile(file);
  const validation = validarRegistrosInventario(parsed);
  assert.equal(validation.total, 5);
  assert.equal(validation.validos, 5);
  assert.equal(validation.errores, 0);
  assert.equal(validation.registrosValidos[2].tipo, 'router');
  assert.deepEqual(validation.registrosValidos[3].detalles, {});
});

test('rechaza encabezados distintos a la plantilla oficial', async () => {
  const file = csvFile([asCsvRow(validRow())], ['Código', ...PLANTILLA_INVENTARIO.slice(1).map(({ header }) => header)]);
  await assert.rejects(parseImportFile(file), { message: MENSAJE_ESTRUCTURA_INVALIDA });
});

test('valida campos requeridos, sintaxis MAC y valores numéricos', () => {
  const result = validarRegistrosInventario([
    { fila: 2, valores: validRow({ direccion_mac: '00:11:22:GG:44:55', garantia_anios: '-1' }) },
    { fila: 3, valores: validRow({ codigo_patrimonial: '', tipo: 'desconocido', costo: '-3' }) },
  ]);
  assert.equal(result.total, 2);
  assert.equal(result.validos, 0);
  assert.match(result.registros[0].detalleValidacion, /MAC inválido/);
  assert.match(result.registros[1].detalleValidacion, /Código patrimonial obligatorio/);
  assert.match(result.registros[1].detalleValidacion, /Tipo de equipo no válido/);
});

test('marca ambos registros con códigos o series repetidos en el archivo y detecta duplicados existentes', () => {
  const first = validRow();
  const second = validRow({ codigo_patrimonial: 'PAT-001', numero_serie: 'SERIE-002' });
  const third = validRow({ codigo_patrimonial: 'PAT-003', numero_serie: 'SERIE-001' });
  const result = validarRegistrosInventario(
    [first, second, third].map((valores, index) => ({ fila: index + 2, valores })),
    [{ codigo_patrimonial: 'PAT-EXISTE', numero_serie: 'SERIE-003' }],
  );
  assert.equal(result.validos, 0);
  assert.match(result.registros[0].detalleValidacion, /Código patrimonial duplicado en el archivo/);
  assert.match(result.registros[1].detalleValidacion, /Código patrimonial duplicado en el archivo/);
  assert.match(result.registros[2].detalleValidacion, /Serie duplicada en el archivo/);

  const existing = validarRegistrosInventario(
    [{ fila: 2, valores: validRow({ numero_serie: 'SERIE-003' }) }],
    [{ codigo_patrimonial: 'PAT-EXISTE', numero_serie: 'SERIE-003' }],
  );
  assert.match(existing.registros[0].detalleValidacion, /Serie duplicada en sistema/);
});

test('normaliza direcciones MAC y fechas válidas para almacenar los bienes disponibles', () => {
  const result = validarRegistrosInventario([{
    fila: 2,
    valores: validRow({
      tipo: 'laptop',
      direccion_mac: 'aa-bb-cc-dd-ee-ff',
      detalles: '{"procesador":"Core i7","ram":"16 GB","almacenamiento":"512 GB SSD"}',
    }),
  }]);
  assert.equal(result.validos, 1);
  assert.equal(result.registrosValidos[0].direccion_mac, 'AA:BB:CC:DD:EE:FF');
  assert.equal(result.registrosValidos[0].fecha_adquisicion, '2024-03-15');
});

test('consulta códigos y series existentes usando arreglos PostgreSQL de tipo text', async () => {
  const arrays = [];
  const sql = Object.assign(async (strings, ...values) => {
    assert.match(strings.join('?'), /UPPER\(codigo_patrimonial\) = ANY\(\?\)/);
    assert.match(strings.join('?'), /UPPER\(numero_serie\) = ANY\(\?\)/);
    return [];
  }, {
    array: (values, type) => {
      arrays.push({ values, type });
      return values;
    },
  });
  await getExisting(sql, [
    { valores: { codigo_patrimonial: ' pat-001 ', numero_serie: 'serie-001' } },
    { valores: { codigo_patrimonial: 'PAT-002', numero_serie: '' } },
  ]);
  assert.deepEqual(arrays, [
    { values: ['PAT-001', 'PAT-002'], type: 25 },
    { values: ['SERIE-001'], type: 25 },
  ]);
});
