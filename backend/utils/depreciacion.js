export const depreciationError = (status, message) => Object.assign(new Error(message), { status });

const decimal = (value, max, label) => {
  if (!['number', 'string'].includes(typeof value) || !/^\d+(?:\.\d{1,2})?$/.test(String(value).trim())) {
    throw depreciationError(400, `${label} debe ser un número válido con hasta dos decimales`);
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > max) {
    throw depreciationError(400, `${label} debe estar entre 0 y ${max}`);
  }
  return number;
};

export const validarValorInicial = (value) => decimal(value, 9999999999.99, 'El valor inicial');
export const validarPorcentajeAnual = (value) => decimal(value, 100, 'El porcentaje anual');

export const validarBienId = (value) => {
  if (!['number', 'string'].includes(typeof value) || !/^\d+$/.test(String(value))) {
    throw depreciationError(400, 'El identificador del bien no es válido');
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) {
    throw depreciationError(400, 'El identificador del bien no es válido');
  }
  return id;
};

export const anoLima = (date = new Date()) => Number(new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Lima', year: 'numeric',
}).format(date));

// Año de adquisición del bien como año base; no puede ser posterior al año de cálculo.
export const anoAdquisicion = (asset, targetYear) => {
  const year = Number(asset?.ano_adquisicion);
  if (asset?.ano_adquisicion == null || !Number.isInteger(year) || year < 1 || year > targetYear) {
    throw depreciationError(409, 'La fecha de adquisición del bien no es válida para calcular la depreciación');
  }
  return year;
};

export const calcularDepreciacion = (valorInicial, porcentajeAnual, anios) => {
  const initial = validarValorInicial(valorInicial);
  const rate = validarPorcentajeAnual(porcentajeAnual);
  if (!Number.isInteger(anios) || anios < 0 || anios > 9998) {
    throw depreciationError(400, 'Los años transcurridos deben ser un entero mayor o igual a cero');
  }
  // Redondear una sola vez, siempre desde el importe y el año base originales.
  const initialCents = Math.round(initial * 100);
  const result = initialCents * Math.pow(1 - rate / 100, anios);
  const cents = Math.round(result + Number.EPSILON * Math.max(1, result));
  return Math.min(initialCents, Math.max(0, cents)) / 100;
};

export const calcularAlAno = (row, targetYear) => {
  const base = Number(row.ano_base);
  const last = Number(row.ano_actual);
  if (row.ano_base == null || row.ano_actual == null || !Number.isInteger(base) || base < 1 || base > 9999
      || !Number.isInteger(last) || last < base || last > 9999 || !Number.isInteger(targetYear)
      || targetYear < base || targetYear < last || targetYear > 9999) {
    throw depreciationError(409, 'La depreciación requiere revisar su año base o la fecha del último cálculo');
  }
  try {
    return calcularDepreciacion(row.valor_inicial, row.porcentaje_anual, targetYear - base);
  } catch (error) {
    if (error.status !== 400) throw error;
    throw depreciationError(409, 'La depreciación contiene un importe o porcentaje inválido; revise el registro');
  }
};
