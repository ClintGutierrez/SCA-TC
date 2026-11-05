export const ESTADOS_BIEN = [
  { key: 'activo', label: 'Disponibles', color: '#10b981' },
  { key: 'asignado', label: 'Asignados', color: '#3b82f6' },
  { key: 'mantenimiento', label: 'En mantenimiento', color: '#f59e0b' },
  { key: 'baja', label: 'Dados de baja', color: '#94a3b8' },
  { key: 'otros', label: 'Otros estados', color: '#8b5cf6' },
];

export const fechaLimaDashboard = (value = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(value);
export const categoriaBien = (bien) => String(bien.tipo || '').trim().toLocaleLowerCase('es') || 'sin-categoria';
export const nombreCategoria = (key) => ({ 'sin-categoria': 'Sin categoría', pc: 'PC', all_in_one: 'All in One', switch_: 'Switch de red', nas: 'NAS', escaner: 'Escáner', camara: 'Cámara' }[key]
  || key.replaceAll('_', ' ').replace(/^./, (letter) => letter.toLocaleUpperCase('es')).trim());

export function resumirInventario(bienes = []) {
  const counts = Object.fromEntries(ESTADOS_BIEN.map((e) => [e.key, 0]));
  const categories = new Map();
  let costo = 0; let sinCosto = 0;
  bienes.forEach((bien) => {
    const state = ESTADOS_BIEN.some((e) => e.key !== 'otros' && e.key === bien.estado) ? bien.estado : 'otros';
    counts[state]++;
    const key = categoriaBien(bien); categories.set(key, (categories.get(key) || 0) + 1);
    const value = Number(bien.costo);
    if (bien.costo === null || bien.costo === undefined || bien.costo === '' || !Number.isFinite(value) || value < 0) sinCosto++;
    else costo += value;
  });
  return {
    total: bienes.length, costo, sinCosto,
    estados: ESTADOS_BIEN.map((e) => ({ ...e, count: counts[e.key], percent: bienes.length ? counts[e.key] / bienes.length * 100 : 0 })),
    categorias: [...categories].map(([key, count]) => ({ key, label: nombreCategoria(key), count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es')),
  };
}

export function contarVinculosPendientes(personal = [], hoy = fechaLimaDashboard()) {
  return personal.filter((p) => {
    if (p.estado !== 'activo' || !['CAS', 'CAP'].includes(p.regimen_laboral)) return false;
    const v = p.vinculo_laboral;
    return !v || v.vigente !== true || !v.fecha_inicio || String(v.fecha_inicio).slice(0, 10) > hoy
      || Boolean(v.fecha_fin && String(v.fecha_fin).slice(0, 10) < hoy);
  }).length;
}

const ESTADOS = {
  recibida: 'Recibida', asignada: 'Asignada', en_atencion: 'En atención', atendida: 'Atendida', cerrada: 'Cerrada',
  observada: 'Observada', rechazada: 'Rechazada', solicitado: 'Solicitado', aprobado: 'Aprobado',
  en_almacen: 'En almacén', recepcionado: 'Recepcionado', pendiente: 'Pendiente', rechazado: 'Rechazado', ejecutado: 'Ejecutado',
};
export const estadoDashboard = (value) => ESTADOS[value] || String(value || 'Sin estado').replaceAll('_', ' ');

const ultimaFecha = (row) => {
  for (const value of [row.updated_at, row.created_at]) {
    if (!value) continue;
    const time = Date.parse(value);
    if (Number.isFinite(time)) return time;
  }
  return null;
};
export function actividadDashboard({ movimientos = [], solicitudes = [], pedidos = [] }, now = Date.now()) {
  const movementNames = { asignacion: 'Asignación de equipo', cambio: 'Reemplazo de equipo', retiro: 'Retiro de equipo', prestamo: 'Préstamo de equipo' };
  const rows = [
    ...movimientos.map((m) => ({ id: 'movimiento-' + m.id, entityId: m.id, view: 'movimientos', icon: 'equipo',
      title: movementNames[m.tipo] || 'Movimiento patrimonial', detail: [m.bien_nombre, m.personal_nombre].filter(Boolean).join(' · '),
      estado: m.estado, time: ultimaFecha(m) })),
    ...solicitudes.map((s) => ({ id: 'solicitud-' + s.id, entityId: s.id, view: 'solicitudes_ti', icon: 'documento',
      title: s.codigo || 'Solicitud TI', detail: s.responsable ? 'Responsable: ' + s.responsable : 'Sin responsable asignado',
      estado: s.estado, time: ultimaFecha(s) })),
    ...pedidos.map((p) => ({ id: 'pedido-' + p.id, entityId: p.id, view: 'almacen_ti', icon: 'pedido',
      title: 'Pedido ' + p.numero, detail: p.descripcion || 'Pedido de equipos', estado: p.estado, time: ultimaFecha(p) })),
  ];
  return rows.filter((row) => row.time !== null && row.time <= now + 60000).sort((a, b) => b.time - a.time || a.id.localeCompare(b.id));
}
