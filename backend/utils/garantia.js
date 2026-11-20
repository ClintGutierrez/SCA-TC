export const GARANTIA_PREDETERMINADA = 1;

export const aniosGarantiaValidos = (value) => Number.isInteger(value) && value >= 0 && value <= 10;

export function normalizarAniosGarantia(value) {
  const number = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : value;
  return aniosGarantiaValidos(number) ? number : null;
}
