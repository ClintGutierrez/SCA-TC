export const REGIMENES_LABORALES = ['Practicante', 'Locador de servicios', 'CAS', 'CAP', 'Personal de confianza', 'Servir'];
export const VINCULO_WRITE_ROLES = ['administrador', 'jefatura', 'tecnico', 'almacen'];
export const VINCULO_READ_ROLES = [...VINCULO_WRITE_ROLES, 'auditor'];

export const fechaLima = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

export const fechaISO = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10);
export const esFecha = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !value.startsWith('0000-')
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export const estadoVinculo = (vinculo, fecha = fechaLima()) => {
  if (!vinculo.vigente) return 'finalizado';
  if (fechaISO(vinculo.fecha_inicio) > fecha) return 'programado';
  if (vinculo.fecha_fin && fechaISO(vinculo.fecha_fin) < fecha) return 'vencido';
  return 'vigente';
};

export const prepararVinculo = (body = {}, updating = false) => {
  const data = {
    tipo_vinculo: String(body.tipo_vinculo || '').trim(),
    fecha_inicio: body.fecha_inicio,
    fecha_fin: body.fecha_fin || null,
    vigente: body.estado === 'vigente',
    observaciones: String(body.observaciones || '').trim(),
    motivo_cambio: String(body.motivo_cambio || '').trim(),
    version: body.version,
  };
  let error;
  if (!REGIMENES_LABORALES.includes(data.tipo_vinculo)) error = 'Selecciona un tipo de vínculo válido';
  else if (!['vigente', 'finalizado'].includes(body.estado)) error = 'El estado debe ser vigente o finalizado';
  else if (!esFecha(data.fecha_inicio) || (data.fecha_fin && !esFecha(data.fecha_fin))) error = 'Ingresa fechas válidas';
  else if (data.fecha_fin && data.fecha_fin < data.fecha_inicio) error = 'La fecha de término no puede ser anterior al inicio';
  else if (!data.vigente && (!data.fecha_fin || data.fecha_fin > fechaLima())) error = 'Para finalizar, indica una fecha de término que no sea futura';
  else if (data.observaciones.length > 2000 || data.motivo_cambio.length > 500) error = 'Observaciones: máximo 2000 caracteres; motivo: máximo 500';
  else if (updating && (!Number.isInteger(data.version) || data.version < 1)) error = 'Se requiere la versión del vínculo; vuelve a cargarlo';
  else if (updating && !data.motivo_cambio) error = 'Indica el motivo de la actualización';
  return { data, error };
};

export const errorVinculo = (message, status = 409) => Object.assign(new Error(message), { status });

export const establecerActor = (tx, user) => tx`SELECT set_config('app.audit_user_id', ${String(user.sub || user.id)}, true)`;

// Bloquear Personal serializa las asignaciones y los cambios de contrato del mismo trabajador.
export const validarPersonalAsignable = async (tx, personalId, fecha, { aprobacion = false } = {}) => {
  if (!esFecha(fecha)) throw errorVinculo('La fecha de asignación no es válida', 400);
  const [personal] = await tx`SELECT * FROM personal WHERE id = ${personalId} FOR UPDATE`;
  if (!personal || personal.estado !== 'activo') throw errorVinculo('El personal no existe o está inactivo');
  const vinculos = await tx`SELECT * FROM vinculo_laboral WHERE personal_id = ${personalId} ORDER BY fecha_inicio DESC, id DESC`;
  const vinculo = vinculos.find((v) => v.vigente && fechaISO(v.fecha_inicio) <= fecha
    && (!v.fecha_fin || fechaISO(v.fecha_fin) >= fecha));
  // Los otros regímenes conservan su flujo previo hasta que se registre su primer vínculo.
  if (!vinculo && (['CAS', 'CAP'].includes(personal.regimen_laboral) || vinculos.length)) {
    throw errorVinculo('El personal no tiene un vínculo laboral vigente para la fecha del movimiento. Regístralo en Personal.');
  }
  if (vinculo && aprobacion && estadoVinculo(vinculo) !== 'vigente') {
    throw errorVinculo('El vínculo laboral dejó de estar vigente; no se puede aprobar la asignación');
  }
  return { ...personal, regimen_laboral: vinculo?.tipo_vinculo || personal.regimen_laboral, vinculo_laboral_id: vinculo?.id || null };
};
