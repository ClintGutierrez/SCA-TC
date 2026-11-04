import { establecerActor, errorVinculo, estadoVinculo, fechaLima, prepararVinculo } from '../utils/vinculoLaboral.js';

const positiveId = (value) => /^\d+$/.test(String(value)) && Number(value) <= 2147483647 && Number(value) > 0;
const serialize = (v) => ({ ...v, estado: v.vigente ? 'vigente' : 'finalizado', estado_vigencia: estadoVinculo(v) });
const respondError = (res, error) => {
  if (error.status) return res.status(error.status).json({ error: error.message });
  if (['23514', '23503', '23505'].includes(error.code)) return res.status(409).json({ error: 'El vínculo entra en conflicto con los datos registrados' });
  console.error('Error de vínculo laboral:', error);
  return res.status(500).json({ error: 'No se pudo guardar o consultar el vínculo laboral' });
};

export const getVinculos = async (req, res, sql) => {
  if (!positiveId(req.params.id)) return res.status(400).json({ error: 'Identificador de personal inválido' });
  try {
    const [personal] = await sql`SELECT id, nombre, apellido, dni, area, cargo, estado, regimen_laboral FROM personal WHERE id=${req.params.id}`;
    if (!personal) return res.status(404).json({ error: 'Personal no encontrado' });
    const vinculos = await sql`SELECT * FROM vinculo_laboral WHERE personal_id=${personal.id} ORDER BY fecha_inicio DESC, id DESC`;
    const current = vinculos.find((v) => estadoVinculo(v) === 'vigente');
    if (current) personal.regimen_laboral = current.tipo_vinculo;
    const historial = await sql`SELECT h.*, u.nombre AS usuario_nombre FROM historial_vinculo_laboral h
      LEFT JOIN usuarios u ON u.id=h.usuario_id WHERE h.personal_id=${personal.id} ORDER BY h.id DESC`;
    return res.json({ personal, vinculos: vinculos.map(serialize), historial, fecha_consulta: fechaLima() });
  } catch (error) { return respondError(res, error); }
};

export const saveVinculo = async (req, res, sql) => {
  const updating = req.params.vinculoId !== undefined;
  if (!positiveId(req.params.id) || (updating && !positiveId(req.params.vinculoId))) return res.status(400).json({ error: 'Identificador inválido' });
  const { data, error } = prepararVinculo(req.body, updating);
  if (error) return res.status(400).json({ error });
  try {
    const result = await sql.begin(async (tx) => {
      await establecerActor(tx, req.user);
      const [personal] = await tx`SELECT id, estado FROM personal WHERE id=${req.params.id} FOR UPDATE`;
      if (!personal) throw errorVinculo('Personal no encontrado', 404);
      if (personal.estado !== 'activo' && data.vigente) throw errorVinculo('Activa al trabajador antes de registrar un vínculo habilitado');
      const [existing] = updating ? await tx`SELECT * FROM vinculo_laboral WHERE id=${req.params.vinculoId} AND personal_id=${personal.id} FOR UPDATE` : [];
      if (updating && !existing) throw errorVinculo('Vínculo laboral no encontrado', 404);
      if (existing && existing.version !== data.version) throw errorVinculo('Otro usuario modificó este vínculo. Recarga los datos antes de guardar.');
      const [overlap] = data.vigente ? await tx`SELECT id FROM vinculo_laboral
        WHERE personal_id=${personal.id} AND vigente=TRUE AND id<>${existing?.id || 0}
          AND fecha_inicio <= COALESCE(${data.fecha_fin}::date, 'infinity'::date)
          AND COALESCE(fecha_fin, 'infinity'::date) >= ${data.fecha_inicio}::date LIMIT 1` : [];
      if (overlap) throw errorVinculo('Las fechas se superponen con otro vínculo habilitado. Ajusta su fecha de término primero.');
      if (existing) {
        const [used] = await tx`SELECT id FROM asignaciones WHERE vinculo_laboral_id=${existing.id}
          AND (fecha_asignacion < ${data.fecha_inicio}::date OR fecha_asignacion > COALESCE(${data.fecha_fin}::date, 'infinity'::date)
            OR ${existing.tipo_vinculo} <> ${data.tipo_vinculo}) LIMIT 1`;
        if (used) throw errorVinculo('El cambio invalidaría una asignación registrada. Conserva ese período y registra un nuevo vínculo.');
      }
      const actor = Number(req.user.sub);
      const [row] = existing ? await tx`UPDATE vinculo_laboral SET tipo_vinculo=${data.tipo_vinculo},
        fecha_inicio=${data.fecha_inicio}, fecha_fin=${data.fecha_fin}, vigente=${data.vigente}, observaciones=${data.observaciones || null},
        motivo_cambio=${data.motivo_cambio}, actualizado_por=${actor}, updated_at=CURRENT_TIMESTAMP, version=version+1
        WHERE id=${existing.id} RETURNING *`
        : await tx`INSERT INTO vinculo_laboral(personal_id, tipo_vinculo, fecha_inicio, fecha_fin, vigente, observaciones, motivo_cambio, creado_por, actualizado_por)
          VALUES (${personal.id}, ${data.tipo_vinculo}, ${data.fecha_inicio}, ${data.fecha_fin}, ${data.vigente}, ${data.observaciones || null},
            ${data.motivo_cambio || 'Registro de vínculo laboral'}, ${actor}, ${actor}) RETURNING *`;
      // Mantener compatibilidad con los módulos que todavía muestran regimen_laboral.
      const today = fechaLima();
      const [current] = await tx`SELECT tipo_vinculo FROM vinculo_laboral WHERE personal_id=${personal.id} AND vigente=TRUE
        AND fecha_inicio<=${today}::date AND (fecha_fin IS NULL OR fecha_fin>=${today}::date) LIMIT 1`;
      if (current) await tx`UPDATE personal SET regimen_laboral=${current.tipo_vinculo}, updated_at=CURRENT_TIMESTAMP
        WHERE id=${personal.id} AND regimen_laboral IS DISTINCT FROM ${current.tipo_vinculo}`;
      return serialize(row);
    });
    return res.status(updating ? 200 : 201).json(result);
  } catch (error) { return respondError(res, error); }
};
