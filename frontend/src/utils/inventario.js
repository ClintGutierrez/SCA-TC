const normalize = (value) => String(value || '').trim().toLowerCase();
const SEARCH_FIELDS = ['codigo_patrimonial', 'nombre', 'numero_serie', 'marca', 'modelo', 'orden_compra'];
const TEXT_FILTERS = {
  codigo: 'codigo_patrimonial', serie: 'numero_serie', marca: 'marca', modelo: 'modelo',
  ordenCompra: 'orden_compra', mac: 'direccion_mac', ubicacion: 'ubicacion',
};
const INDEX_FIELDS = [...new Set([...SEARCH_FIELDS, ...Object.values(TEXT_FILTERS)])];
const parseObject = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return Array.isArray(value) ? {} : value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
};

export const prepararInventario = (bienes) => bienes.map((bien) => {
  const text = Object.fromEntries(INDEX_FIELDS
    .map((field) => [field, normalize(bien[field])]));
  return { bien, text, search: SEARCH_FIELDS.map((field) => text[field]), specs: null, specText: null };
});

export function filtrarInventario(index, filters = {}) {
  const search = normalize(filters.busqueda);
  const textFilters = Object.entries(TEXT_FILTERS).map(([key, field]) => [field, normalize(filters[key])]).filter(([, query]) => query);
  const technical = Object.entries(filters.tecnicos || {}).map(([key, query]) => [key, normalize(query)]).filter(([, query]) => query);
  const specification = normalize(filters.especificacion);
  const hasMin = filters.costoMin !== '' && filters.costoMin != null;
  const hasMax = filters.costoMax !== '' && filters.costoMax != null;
  const min = Number(filters.costoMin); const max = Number(filters.costoMax);
  return index.filter((entry) => {
    const { bien } = entry;
    if (search && !entry.search.some((value) => value.includes(search))) return false;
    if (textFilters.some(([field, query]) => !entry.text[field].includes(query))) return false;
    if (filters.tipo && bien.tipo !== filters.tipo) return false;
    if (filters.estado && bien.estado !== filters.estado) return false;
    if (filters.asignacion === 'asignado' && !bien.usuario_asignado) return false;
    if (filters.asignacion === 'disponible' && bien.usuario_asignado) return false;
    if (hasMin || hasMax) {
      const cost = Number(bien.costo);
      if (Number.isNaN(cost) || (hasMin && !(cost >= min)) || (hasMax && !(cost <= max))) return false;
    }
    const date = String(bien.fecha_adquisicion || '').slice(0, 10);
    if (filters.fechaDesde && date < filters.fechaDesde) return false;
    if (filters.fechaHasta && date > filters.fechaHasta) return false;
    if (filters.garantia) {
      const years = Number(bien.garantia_anios);
      const covered = Number.isFinite(years) && years > 0;
      if ((filters.garantia === 'con_garantia' && !covered) || (filters.garantia === 'sin_garantia' && covered)) return false;
    }
    // Las especificaciones se leen solo si se filtra por ellas y se reutilizan
    // mientras no cambie el inventario recibido de la API.
    if (specification || technical.length) {
      if (entry.specs === null) entry.specs = { ...parseObject(bien.especificaciones), ...parseObject(bien.detalles) };
      if (technical.some(([key, query]) => !normalize(entry.specs[key]).includes(query))) return false;
      if (specification) {
        if (entry.specText === null) entry.specText = normalize(Object.entries(entry.specs).map(([key, value]) => `${key} ${value}`).join(' '));
        if (!entry.specText.includes(specification)) return false;
      }
    }
    return true;
  }).map((entry) => entry.bien);
}

export function paginarInventario(bienes, requestedPage = 1, requestedSize = 25) {
  const size = [25, 50, 100].includes(Number(requestedSize)) ? Number(requestedSize) : 25;
  const totalPages = Math.max(1, Math.ceil(bienes.length / size));
  const page = Math.min(totalPages, Math.max(1, Math.trunc(Number(requestedPage)) || 1));
  const start = (page - 1) * size;
  return { page, size, totalPages, total: bienes.length, start: bienes.length ? start + 1 : 0,
    end: Math.min(start + size, bienes.length), rows: bienes.slice(start, start + size) };
}
