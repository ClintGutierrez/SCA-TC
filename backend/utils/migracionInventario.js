import ExcelJS from 'exceljs';

export const PLANTILLA_INVENTARIO = [
  { key: 'codigo_patrimonial', header: 'Código Patrimonial' },
  { key: 'numero_serie', header: 'Nº Serie' },
  { key: 'tipo', header: 'Tipo' },
  { key: 'marca', header: 'Marca' },
  { key: 'modelo', header: 'Modelo' },
  { key: 'direccion_mac', header: 'Dirección MAC' },
  { key: 'ubicacion', header: 'Sede / Ubicación' },
  { key: 'fecha_adquisicion', header: 'Fecha de Compra (AAAA-MM-DD)' },
  { key: 'costo', header: 'Valor (S/)' },
  { key: 'garantia_anios', header: 'Garantía (años)' },
  { key: 'orden_compra', header: 'Orden de Compra' },
  { key: 'descripcion', header: 'Especificaciones' },
  { key: 'detalles', header: 'Detalles técnicos (JSON)' },
];

export const MENSAJE_ESTRUCTURA_INVALIDA =
  'Estructura del archivo no válida. Descargue la plantilla oficial e intente nuevamente';

const TIPOS_DETALLES_REQUERIDOS = {
  laptop: ['procesador', 'ram', 'almacenamiento'],
  computadora: ['procesador', 'ram', 'almacenamiento'],
  servidor: ['procesador', 'ram', 'almacenamiento'],
  switch: ['numPuertos'],
  router: [],
  nas: ['bahias', 'capacidadTotal'],
  camara: ['tipoCamara', 'resolucion'],
  escaner: ['clasificacion'],
  monitor: ['tamano', 'resolucion'],
  impresora: ['tecnologia'],
  teclado: ['conexion'],
  mouse: ['conexion'],
  otro: [],
};

const CAMPOS_NUMERICOS = new Set(['numPuertos', 'bahias', 'velocidadPpm', 'cicloDiario', 'capacidadAdf']);
const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;
const TIPOS = new Set(Object.keys(TIPOS_DETALLES_REQUERIDOS));
const plainText = (value) => String(value ?? '').trim();
const normalizeUniqueKey = (value) => plainText(value).toLocaleUpperCase('es-PE');

export class ImportacionInventarioError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ImportacionInventarioError';
    this.status = status;
  }
}

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  let line = 1;
  let rowLine = 1;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
        if (character === '\n') line += 1;
      }
      continue;
    }

    if (character === '"' && value.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(value);
      value = '';
    } else if (character === '\n' || character === '\r') {
      row.push(value);
      if (row.some((cell) => plainText(cell))) rows.push({ line: rowLine, values: row });
      if (rows.length > 5001) {
        throw new ImportacionInventarioError('El archivo supera el límite de 5,000 registros por importación.', 413);
      }
      row = [];
      value = '';
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      line += 1;
      rowLine = line;
    } else {
      value += character;
    }
  }

  if (quoted) throw new ImportacionInventarioError(MENSAJE_ESTRUCTURA_INVALIDA);
  row.push(value);
  if (row.some((cell) => plainText(cell))) rows.push({ line: rowLine, values: row });
  if (rows.length > 5001) {
    throw new ImportacionInventarioError('El archivo supera el límite de 5,000 registros por importación.', 413);
  }
  return rows;
};

const cellValue = (cell) => {
  const value = cell?.value;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    if ('result' in value) return value.result;
    if (Array.isArray(value.richText)) return value.richText.map((item) => item.text).join('');
    if ('text' in value) return value.text;
  }
  return value;
};

const readWorkbook = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ImportacionInventarioError(MENSAJE_ESTRUCTURA_INVALIDA);
  if (sheet.rowCount > 5001) {
    throw new ImportacionInventarioError('El archivo supera el límite de 5,000 registros por importación.', 413);
  }

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = [];
    for (let index = 1; index <= Math.max(row.cellCount, PLANTILLA_INVENTARIO.length); index += 1) {
      values.push(cellValue(row.getCell(index)));
    }
    if (values.some((value) => plainText(value))) rows.push({ line: rowNumber, values });
  });
  return rows;
};

export const parseImportFile = async (file) => {
  if (!file?.buffer || !file.originalname) {
    throw new ImportacionInventarioError('Seleccione un archivo Excel (.xlsx) o CSV.');
  }

  const extension = file.originalname.split('.').pop().toLowerCase();
  let rows;
  try {
    if (extension === 'csv') {
      rows = parseCsv(file.buffer.toString('utf8').replace(/^\uFEFF/, ''));
    } else if (extension === 'xlsx') {
      rows = await readWorkbook(file.buffer);
    } else {
      throw new ImportacionInventarioError('Formato no admitido. Use un archivo .xlsx o .csv.');
    }
  } catch (error) {
    if (error instanceof ImportacionInventarioError) throw error;
    throw new ImportacionInventarioError(MENSAJE_ESTRUCTURA_INVALIDA);
  }

  const headers = rows[0]?.values?.map(plainText) || [];
  const expectedHeaders = PLANTILLA_INVENTARIO.map(({ header }) => header);
  if (
    headers.length !== expectedHeaders.length
    || headers.some((header, index) => header !== expectedHeaders[index])
  ) {
    throw new ImportacionInventarioError(MENSAJE_ESTRUCTURA_INVALIDA);
  }
  if (rows.length === 1) {
    throw new ImportacionInventarioError('El archivo no contiene registros para importar.');
  }
  if (rows.length - 1 > 5000) {
    throw new ImportacionInventarioError('El archivo supera el límite de 5,000 registros por importación.', 413);
  }

  return rows.slice(1).map(({ line, values }) => ({
    fila: line,
    valores: Object.fromEntries(PLANTILLA_INVENTARIO.map(({ key }, index) => [key, values[index]])),
  }));
};

const normalizeDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = plainText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : null;
  }
  const localized = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (localized) {
    const candidate = `${localized[3]}-${localized[2]}-${localized[1]}`;
    return normalizeDate(candidate);
  }
  return null;
};

const parseDetails = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  const text = plainText(value);
  if (!text) return {};
  const details = JSON.parse(text);
  if (!details || typeof details !== 'object' || Array.isArray(details)) throw new Error('Detalles técnicos deben ser un objeto JSON');
  return details;
};

const normalizeRecord = ({ fila, valores }) => {
  const record = {
    fila,
    codigo_patrimonial: plainText(valores.codigo_patrimonial),
    numero_serie: plainText(valores.numero_serie),
    tipo: plainText(valores.tipo).toLowerCase(),
    marca: plainText(valores.marca),
    modelo: plainText(valores.modelo),
    direccion_mac: plainText(valores.direccion_mac),
    ubicacion: plainText(valores.ubicacion),
    fecha_adquisicion: normalizeDate(valores.fecha_adquisicion),
    orden_compra: plainText(valores.orden_compra) || null,
    descripcion: plainText(valores.descripcion) || null,
    detalles: {},
    costo: 0,
    garantia_anios: null,
    errores: [],
  };
  const required = [
    ['codigo_patrimonial', 'Código patrimonial obligatorio'],
    ['numero_serie', 'Número de serie obligatorio'],
    ['tipo', 'Tipo de equipo obligatorio'],
    ['marca', 'Marca obligatoria'],
    ['modelo', 'Modelo obligatorio'],
    ['ubicacion', 'Sede / ubicación obligatoria'],
  ];
  required.forEach(([field, message]) => {
    if (!record[field]) record.errores.push(message);
  });
  if (record.codigo_patrimonial.length > 100) record.errores.push('Código patrimonial supera 100 caracteres');
  if (record.numero_serie.length > 100) record.errores.push('Número de serie supera 100 caracteres');
  if (record.tipo && !TIPOS.has(record.tipo)) record.errores.push('Tipo de equipo no válido');
  if (record.tipo.length > 100) record.errores.push('Tipo de equipo supera 100 caracteres');
  if (record.marca.length > 100) record.errores.push('Marca supera 100 caracteres');
  if (record.modelo.length > 100) record.errores.push('Modelo supera 100 caracteres');
  if (record.ubicacion.length > 255) record.errores.push('Sede / ubicación supera 255 caracteres');
  if (record.orden_compra?.length > 100) record.errores.push('Orden de compra supera 100 caracteres');
  if (!record.fecha_adquisicion) record.errores.push('Fecha de compra no válida (use AAAA-MM-DD)');
  else if (record.fecha_adquisicion > new Date().toISOString().slice(0, 10)) record.errores.push('La fecha de compra no puede ser futura');

  const costoText = plainText(valores.costo);
  if (costoText) {
    const costo = Number(costoText);
    if (!/^\d+(?:\.\d{1,2})?$/.test(costoText) || !Number.isFinite(costo) || costo < 0 || costo > 9999999999.99) {
      record.errores.push('Valor debe ser un número mayor o igual a 0 con máximo 2 decimales');
    } else {
      record.costo = costo;
    }
  }

  const garantiaText = plainText(valores.garantia_anios);
  const garantia = Number(garantiaText);
  if (!garantiaText || !Number.isInteger(garantia) || garantia < 0 || garantia > 10) {
    record.errores.push('Garantía debe ser un número entero entre 0 y 10');
  } else {
    record.garantia_anios = garantia;
  }

  if (record.direccion_mac && !MAC_REGEX.test(record.direccion_mac)) {
    record.errores.push('Formato de dirección MAC inválido');
  } else if (record.direccion_mac) {
    record.direccion_mac = record.direccion_mac.toUpperCase().replace(/-/g, ':');
  }

  try {
    record.detalles = parseDetails(valores.detalles);
  } catch (error) {
    record.errores.push(error.message);
  }
  for (const [key, value] of Object.entries(record.detalles)) {
    if (CAMPOS_NUMERICOS.has(key) && value !== '' && value != null && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
      record.errores.push(`El detalle técnico ${key} debe ser un número mayor o igual a 0`);
    } else if (!CAMPOS_NUMERICOS.has(key) && plainText(value).length > 100) {
      record.errores.push(`El detalle técnico ${key} supera 100 caracteres`);
    }
  }
  record.nombre = `${record.tipo} ${record.marca} ${record.modelo}`.trim();
  if (record.nombre.length > 255) record.errores.push('La combinación tipo, marca y modelo supera 255 caracteres');
  return record;
};

export const validarRegistrosInventario = (rows, existing = []) => {
  const records = rows.map(normalizeRecord);
  const codeRows = new Map();
  const serialRows = new Map();
  const existingCodes = new Set(existing.map((row) => normalizeUniqueKey(row.codigo_patrimonial)));
  const existingSerials = new Set(existing.map((row) => normalizeUniqueKey(row.numero_serie)));

  records.forEach((record) => {
    const code = normalizeUniqueKey(record.codigo_patrimonial);
    const serial = normalizeUniqueKey(record.numero_serie);
    if (code) {
      const matches = codeRows.get(code) || [];
      matches.push(record);
      codeRows.set(code, matches);
    }
    if (serial) {
      const matches = serialRows.get(serial) || [];
      matches.push(record);
      serialRows.set(serial, matches);
    }
    if (code && existingCodes.has(code)) record.errores.push('Código patrimonial duplicado en sistema');
    if (serial && existingSerials.has(serial)) record.errores.push('Serie duplicada en sistema');
  });

  codeRows.forEach((matches) => {
    if (matches.length > 1) matches.forEach((record) => record.errores.push('Código patrimonial duplicado en el archivo'));
  });
  serialRows.forEach((matches) => {
    if (matches.length > 1) matches.forEach((record) => record.errores.push('Serie duplicada en el archivo'));
  });

  const registros = records.map((record) => ({
    fila: record.fila,
    codigoPatrimonial: record.codigo_patrimonial,
    tipoEquipo: [record.tipo, record.marca, record.modelo].filter(Boolean).join(' '),
    numeroSerie: record.numero_serie,
    ubicacion: record.ubicacion,
    valido: record.errores.length === 0,
    detalleValidacion: record.errores.length ? [...new Set(record.errores)].join('; ') : 'Listo para importar',
    datos: record,
  }));
  const validos = registros.filter((record) => record.valido);
  return {
    total: registros.length,
    validos: validos.length,
    errores: registros.length - validos.length,
    registros,
    registrosValidos: validos.map(({ datos }) => datos),
  };
};

export const crearPlantillaInventario = async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Inventario SCA-TC';
  const sheet = workbook.addWorksheet('Inventario');
  sheet.columns = PLANTILLA_INVENTARIO.map(({ header }, index) => ({
    header,
    key: PLANTILLA_INVENTARIO[index].key,
    width: Math.max(header.length + 4, 20),
  }));
  sheet.getRow(1).height = 30;
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + PLANTILLA_INVENTARIO.length)}1` };
  const instructions = workbook.addWorksheet('Instrucciones');
  instructions.addRows([
    ['Plantilla oficial para migrar inventario'],
    ['No cambie, quite ni reordene los encabezados de la hoja Inventario.'],
    ['Complete los campos obligatorios: código patrimonial, número de serie, tipo, marca, modelo, sede/ubicación, fecha de compra y garantía.'],
    ['Use tipos: laptop, computadora, servidor, router, switch, nas, camara, escaner, monitor, impresora, teclado, mouse u otro.'],
    ['Fecha: AAAA-MM-DD. MAC: AA:BB:CC:DD:EE:FF (cuando corresponda). Valor: número con máximo 2 decimales.'],
    ['Los detalles técnicos son opcionales; cuando los incluya, use un objeto JSON válido. Ejemplo laptop: {"procesador":"Core i7","ram":"16 GB","almacenamiento":"512 GB SSD"}.'],
    ['El estado inicial se asigna automáticamente como Disponible / En Almacén.'],
  ]);
  instructions.getColumn(1).width = 110;
  instructions.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF1D4ED8' } };
  instructions.eachRow((row) => row.getCell(1).alignment = { wrapText: true, vertical: 'middle' });
  return workbook.xlsx.writeBuffer();
};

export const crearPlantillaCsv = () => `\uFEFF${PLANTILLA_INVENTARIO.map(({ header }) => `"${header.replace(/"/g, '""')}"`).join(',')}\r\n`;
