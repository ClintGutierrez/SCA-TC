import { esFecha, establecerActor, fechaISO, validarPersonalAsignable } from '../utils/vinculoLaboral.js';

const assignmentFields = `
  a.id, a.bien_id, a.personal_id, a.usuario_id, a.fecha_asignacion,
  a.fecha_devolucion, a.observaciones, a.estado, a.created_at, a.vinculo_laboral_id,
  b.nombre AS bien_nombre, b.tipo AS bien_tipo, b.numero_serie,
  p.nombre AS personal_nombre, p.apellido AS personal_apellido, p.dni AS personal_dni,
  u.nombre AS usuario_registro, u.email AS usuario_registro_email
`;

const isDate = esFecha;

export const listAsignaciones = async (req, res, sql) => {
  try {
    const active = req.query.active;
    const filter = active === 'true'
      ? sql`WHERE a.fecha_devolucion IS NULL`
      : active === 'false' ? sql`WHERE a.fecha_devolucion IS NOT NULL` : sql``;
    const rows = await sql`
      SELECT ${sql.unsafe(assignmentFields)}
      FROM asignaciones a
      JOIN bienes_informaticos b ON b.id = a.bien_id
      LEFT JOIN personal p ON p.id = a.personal_id
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      ${filter}
      ORDER BY a.fecha_devolucion IS NULL DESC, a.fecha_asignacion DESC, a.id DESC
    `;
    res.json(rows);
  } catch (error) {
    console.error('Error al listar asignaciones:', error);
    res.status(500).json({ error: 'No se pudieron obtener las asignaciones' });
  }
};

export const createAsignacion = async (req, res, sql) => {
  const { bien_id: bienId, personal_id: personalId, fecha_asignacion: date, observaciones } = req.body || {};
  // usuario_id identifica al operador que registró el movimiento (compatibilidad/auditoría).
  const usuarioId = req.user?.sub || req.user?.id || null;
  if (!Number.isInteger(Number(bienId)) || !Number.isInteger(Number(personalId))) {
    return res.status(400).json({ error: 'bien_id y personal_id son obligatorios' });
  }
  if (!date || !isDate(date)) return res.status(400).json({ error: 'La fecha de asignación no es válida' });
  try {
    const created = await sql.begin(async (tx) => {
      await establecerActor(tx, req.user);
      const [bien] = await tx`
        SELECT id, estado FROM bienes_informaticos WHERE id = ${bienId} FOR UPDATE
      `;
      if (!bien) {
        const error = new Error('El bien no existe'); error.status = 404; throw error;
      }
      if (bien.estado !== 'activo') {
        const error = new Error(bien.estado === 'baja'
          ? 'No se puede asignar un bien dado de baja'
          : 'El bien no está disponible para asignación'); error.status = 409; throw error;
      }
      const [active] = await tx`
        SELECT id FROM asignaciones WHERE bien_id = ${bienId} AND fecha_devolucion IS NULL LIMIT 1
      `;
      if (active) { const error = new Error('El bien ya tiene una asignación activa'); error.status = 409; throw error; }
      const personal = await validarPersonalAsignable(tx, personalId, date);
      const [row] = await tx`
        INSERT INTO asignaciones (bien_id, personal_id, usuario_id, fecha_asignacion, observaciones, estado, vinculo_laboral_id)
        VALUES (${bienId}, ${personalId}, ${usuarioId || null}, ${date}, ${observaciones?.trim() || null}, 'activa', ${personal.vinculo_laboral_id})
        RETURNING id
      `;
      await tx`UPDATE bienes_informaticos SET estado = 'asignado', updated_at = CURRENT_TIMESTAMP WHERE id = ${bienId}`;
      return row;
    });
    const [result] = await sql`
      SELECT ${sql.unsafe(assignmentFields)}
      FROM asignaciones a JOIN bienes_informaticos b ON b.id = a.bien_id
      LEFT JOIN personal p ON p.id = a.personal_id LEFT JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.id = ${created.id}
    `;
    res.status(201).json(result);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    if (error.code === '23505') return res.status(409).json({ error: 'El bien ya tiene una asignación activa' });
    if (error.code === '23503') return res.status(400).json({ error: 'El usuario de registro no existe' });
    console.error('Error al crear asignación:', error);
    res.status(500).json({ error: 'No se pudo registrar la asignación' });
  }
};

export const returnAsignacion = async (req, res, sql) => {
  const { fecha_devolucion: date, observaciones } = req.body || {};
  if (!date || !isDate(date)) return res.status(400).json({ error: 'La fecha de devolución no es válida' });
  try {
    const result = await sql.begin(async (tx) => {
      await establecerActor(tx, req.user);
      const [assignment] = await tx`
        SELECT id, bien_id, fecha_asignacion, fecha_devolucion
        FROM asignaciones WHERE id = ${req.params.id} FOR UPDATE
      `;
      if (!assignment) { const error = new Error('Asignación no encontrada'); error.status = 404; throw error; }
      if (assignment.fecha_devolucion) { const error = new Error('La asignación ya fue devuelta'); error.status = 409; throw error; }
      if (date < fechaISO(assignment.fecha_asignacion)) {
        const error = new Error('La devolución no puede ser anterior a la asignación'); error.status = 400; throw error;
      }
      const [row] = await tx`
        UPDATE asignaciones
        SET fecha_devolucion = ${date}, estado = 'devuelta',
            observaciones = COALESCE(${observaciones?.trim() || null}, observaciones)
        WHERE id = ${req.params.id}
        RETURNING bien_id
      `;
      await tx`
        UPDATE bienes_informaticos SET estado = 'activo', updated_at = CURRENT_TIMESTAMP
        WHERE id = ${row.bien_id} AND estado = 'asignado'
      `;
      return row;
    });
    res.json({ message: 'Devolución registrada correctamente', bien_id: result.bien_id });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error al registrar devolución:', error);
    res.status(500).json({ error: 'No se pudo registrar la devolución' });
  }
};
