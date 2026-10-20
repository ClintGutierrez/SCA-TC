import nodemailer from 'nodemailer';

const TYPES = new Set(['asignacion', 'cambio', 'retiro', 'prestamo']);
const DIRECT_REGIMES = new Set(['CAP', 'CAS', 'Personal de confianza', 'Servir']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const fields = `m.*, b.nombre AS bien_nombre, b.numero_serie,
  b_reemplazo.nombre AS bien_reemplazo_nombre, b_reemplazo.numero_serie AS reemplazo_numero_serie,
  CONCAT(p.apellido, ', ', p.nombre) AS personal_nombre,
  p.regimen_laboral, p.correo_institucional, p.correo_jefe,
  CONCAT(pd.apellido, ', ', pd.nombre) AS personal_destino_nombre,
  pd.regimen_laboral AS regimen_destino, pd.correo_institucional AS correo_destino,
  pd.correo_jefe AS correo_jefe_destino`;

const emailConfig = () => process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
const sendNotification = async (movement) => {
  const to = DIRECT_REGIMES.has(movement.regimen_laboral)
    ? movement.correo_institucional
    : movement.correo_jefe;
  if (!to) return { status: 'not_configured', reason: 'No hay correo del destinatario registrado' };
  if (!emailConfig()) return { status: 'not_configured', reason: 'SMTP no configurado' };
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER, to,
    subject: `Movimiento patrimonial #${movement.id} - ${movement.tipo}`,
    html: buildDocument(movement),
  });
  return { status: 'sent', to };
};

export const buildDocument = (m) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Movimiento patrimonial #${escapeHtml(m.id)}</title>
<style>body{font-family:Arial,sans-serif;margin:40px;color:#172033}h1{color:#1d4ed8}table{border-collapse:collapse;width:100%;max-width:760px}td{border:1px solid #cbd5e1;padding:9px}td:first-child{font-weight:bold;background:#f1f5f9;width:30%}@media print{button{display:none}}</style></head>
<body><button onclick="window.print()">Imprimir</button><h1>Documento de movimiento patrimonial</h1>
<p><strong>N.°:</strong> ${escapeHtml(m.id)} &nbsp; <strong>Tipo:</strong> ${escapeHtml(m.tipo)} &nbsp; <strong>Estado:</strong> ${escapeHtml(m.estado)}</p>
<table><tr><td>Equipo averiado</td><td>${escapeHtml(m.bien_nombre)} (${escapeHtml(m.numero_serie || 'sin serie')})</td></tr>
<tr><td>Equipo de reemplazo</td><td>${escapeHtml(m.bien_reemplazo_nombre || 'No aplica')} (${escapeHtml(m.reemplazo_numero_serie || 'sin serie')})</td></tr>
<tr><td>Responsable</td><td>${escapeHtml(m.personal_nombre || 'No especificado')}</td></tr>
<tr><td>Destino</td><td>${escapeHtml(m.personal_destino_nombre || 'No especificado')}</td></tr>
<tr><td>Fecha</td><td>${escapeHtml(m.fecha_movimiento || '')}</td></tr><tr><td>Fecha fin</td><td>${escapeHtml(m.fecha_fin || '')}</td></tr>
<tr><td>Fecha de retorno</td><td>${escapeHtml(m.fecha_retorno || 'Pendiente')}</td></tr>
<tr><td>Motivo</td><td>${escapeHtml(m.motivo || '')}</td></tr><tr><td>Observaciones</td><td>${escapeHtml(m.observaciones || '')}</td></tr></table>
<p>Por medio del presente se deja constancia del movimiento patrimonial indicado.</p>
<div style="display:flex;gap:80px;margin-top:90px"><div style="border-top:1px solid #334155;padding-top:8px;width:260px;text-align:center">Responsable del bien</div><div style="border-top:1px solid #334155;padding-top:8px;width:260px;text-align:center">Jefatura / Patrimonio</div></div>
<p style="margin-top:40px">Documento generado por el Sistema de Inventario del Tribunal Constitucional del Perú.</p></body></html>`;

const list = async (req, res, sql) => {
  try {
    const filter = req.query.tipo && TYPES.has(req.query.tipo) ? sql`WHERE m.tipo = ${req.query.tipo}` : sql``;
    const rows = await sql`SELECT ${sql.unsafe(fields)} FROM movimientos_patrimoniales m
      JOIN bienes_informaticos b ON b.id = m.bien_id
      LEFT JOIN bienes_informaticos b_reemplazo ON b_reemplazo.id = m.bien_reemplazo_id
      LEFT JOIN personal p ON p.id = m.personal_id
      LEFT JOIN personal pd ON pd.id = m.personal_destino_id ${filter} ORDER BY m.created_at DESC`;
    res.json(rows);
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudieron obtener los movimientos' }); }
};

const create = async (req, res, sql) => {
  const body = req.body || {};
  const { tipo, bien_id, bien_reemplazo_id, personal_id, personal_destino_id, fecha_movimiento, fecha_fin, motivo, observaciones, datos = {} } = body;
  if (!TYPES.has(tipo) || !Number.isInteger(Number(bien_id))) return res.status(400).json({ error: 'Tipo y bien_id son obligatorios' });
  const movementDate = fecha_movimiento || new Date().toISOString().slice(0, 10);
  if (!DATE.test(movementDate) || (fecha_fin && !DATE.test(fecha_fin))) return res.status(400).json({ error: 'Fecha inválida' });
  if (tipo === 'prestamo' && (!fecha_fin || fecha_fin < movementDate)) return res.status(400).json({ error: 'El préstamo requiere una fecha fin igual o posterior al movimiento' });
  if (!String(motivo || '').trim()) return res.status(400).json({ error: 'El motivo es obligatorio' });
  try {
    const row = await sql.begin(async (tx) => {
      const [bien] = await tx`SELECT id, estado FROM bienes_informaticos WHERE id=${bien_id} FOR UPDATE`;
      if (!bien) { const e = new Error('El bien no existe'); e.status = 404; throw e; }
      if (tipo === 'cambio' && (!bien_reemplazo_id || !Number.isInteger(Number(bien_reemplazo_id)) || Number(bien_reemplazo_id) === Number(bien_id))) {
        const e = new Error('Selecciona un equipo de reemplazo diferente al equipo averiado');
        e.status = 400;
        throw e;
      }
      const [replacement] = tipo === 'cambio'
        ? await tx`SELECT id, estado FROM bienes_informaticos WHERE id=${bien_reemplazo_id} FOR UPDATE`
        : [null];
      if (tipo === 'cambio' && !replacement) {
        const e = new Error('El equipo de reemplazo no existe');
        e.status = 404;
        throw e;
      }
      const [person] = personal_id ? await tx`SELECT * FROM personal WHERE id=${personal_id} AND estado='activo'` : [null];
      const recipient = person;
      if (!person) { const e = new Error('El personal responsable es obligatorio y debe estar activo'); e.status = 400; throw e; }
      if (['asignacion', 'prestamo'].includes(tipo) && bien.estado !== 'activo') {
        const e = new Error('El bien debe estar disponible para asignarlo o prestarlo');
        e.status = 409;
        throw e;
      }
      if (['cambio', 'retiro'].includes(tipo) && bien.estado !== 'asignado') {
        const e = new Error('Solo se puede cambiar o retirar un bien actualmente asignado');
        e.status = 409;
        throw e;
      }
      if (tipo === 'cambio' && replacement.estado !== 'activo') {
        const e = new Error('El equipo de reemplazo debe estar disponible');
        e.status = 409;
        throw e;
      }
      if (tipo === 'cambio') {
        const [currentAssignment] = await tx`
          SELECT id, personal_id FROM asignaciones
          WHERE bien_id = ${bien_id} AND fecha_devolucion IS NULL FOR UPDATE
        `;
        if (!currentAssignment || Number(currentAssignment.personal_id) !== Number(personal_id)) {
          const e = new Error('El trabajador seleccionado no es el responsable actual del equipo averiado');
          e.status = 409;
          throw e;
        }
        const [replacementAssignment] = await tx`
          SELECT id FROM asignaciones
          WHERE bien_id = ${bien_reemplazo_id} AND fecha_devolucion IS NULL LIMIT 1
        `;
        if (replacementAssignment) {
          const e = new Error('El equipo de reemplazo ya está asignado');
          e.status = 409;
          throw e;
        }
        const [replacementReservation] = await tx`
          SELECT id FROM movimientos_patrimoniales
          WHERE bien_reemplazo_id = ${bien_reemplazo_id} AND estado = 'pendiente'
          LIMIT 1
        `;
        if (replacementReservation) {
          const e = new Error('El equipo de reemplazo ya está reservado para otro movimiento pendiente');
          e.status = 409;
          throw e;
        }
      }
      if (recipient && ![...DIRECT_REGIMES, 'Locador de servicios', 'Practicante'].includes(recipient.regimen_laboral)) {
        const e = new Error('El régimen laboral del responsable no admite este movimiento');
        e.status = 400;
        throw e;
      }
      const direct = recipient && DIRECT_REGIMES.has(recipient.regimen_laboral);
      if (recipient && !direct && (!recipient.jefe_inmediato || !recipient.correo_jefe)) {
        const e = new Error('Registra el jefe inmediato y su correo en el módulo Personal para solicitar autorización');
        e.status = 400;
        throw e;
      }
      const estado = direct ? 'aprobado' : 'pendiente';
      const [created] = await tx`INSERT INTO movimientos_patrimoniales
        (tipo,bien_id,bien_reemplazo_id,personal_id,personal_destino_id,estado,fecha_movimiento,fecha_fin,motivo,observaciones,creado_por,datos)
        VALUES (${tipo},${bien_id},${tipo === 'cambio' ? bien_reemplazo_id : null},${personal_id || null},${personal_destino_id || null},${estado},${movementDate},${fecha_fin || null},${motivo.trim()},${String(observaciones || '').trim() || null},${req.user?.sub || null},${tx.json(datos)})
        RETURNING id`;
      if (direct && ['asignacion', 'prestamo'].includes(tipo)) {
        const [active] = await tx`SELECT id FROM asignaciones WHERE bien_id = ${bien_id} AND fecha_devolucion IS NULL FOR UPDATE`;
        if (active) { const e = new Error('El bien ya tiene una asignación activa'); e.status = 409; throw e; }
        await tx`INSERT INTO asignaciones (bien_id, personal_id, usuario_id, fecha_asignacion, observaciones, estado)
          VALUES (${bien_id}, ${personal_id}, ${req.user?.sub || null}, ${movementDate}, ${observaciones || null}, 'activa')`;
        await tx`UPDATE bienes_informaticos SET estado='asignado', updated_at=CURRENT_TIMESTAMP WHERE id=${bien_id}`;
      } else if (direct && tipo === 'cambio') {
        await tx`UPDATE asignaciones SET fecha_devolucion = ${movementDate}, estado = 'devuelta'
          WHERE bien_id = ${bien_id} AND fecha_devolucion IS NULL`;
        await tx`INSERT INTO asignaciones (bien_id, personal_id, usuario_id, fecha_asignacion, observaciones, estado)
          VALUES (${bien_reemplazo_id}, ${personal_id}, ${req.user?.sub || null}, ${movementDate}, ${observaciones || null}, 'activa')`;
        await tx`UPDATE bienes_informaticos SET estado='mantenimiento', updated_at=CURRENT_TIMESTAMP WHERE id=${bien_id}`;
        await tx`UPDATE bienes_informaticos SET estado='asignado', updated_at=CURRENT_TIMESTAMP WHERE id=${bien_reemplazo_id}`;
      } else if (direct && tipo === 'retiro') {
        await tx`UPDATE asignaciones SET fecha_devolucion = ${movementDate}, estado = 'devuelta'
          WHERE bien_id = ${bien_id} AND fecha_devolucion IS NULL`;
        await tx`UPDATE bienes_informaticos SET estado='activo', updated_at=CURRENT_TIMESTAMP WHERE id=${bien_id}`;
      }
      return created;
    });
    const [movement] = await sql`SELECT ${sql.unsafe(fields)} FROM movimientos_patrimoniales m JOIN bienes_informaticos b ON b.id=m.bien_id LEFT JOIN bienes_informaticos b_reemplazo ON b_reemplazo.id=m.bien_reemplazo_id LEFT JOIN personal p ON p.id=m.personal_id LEFT JOIN personal pd ON pd.id=m.personal_destino_id WHERE m.id=${row.id}`;
    let email = { status: 'not_required' };
    if (movement.estado === 'pendiente' || movement.estado === 'aprobado') {
      try { email = await sendNotification(movement); } catch (error) { email = { status: 'error', reason: 'No se pudo enviar el correo' }; console.error(error); }
    }
    res.status(201).json({ ...movement, email });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    if (error.code === '23505') return res.status(409).json({ error: 'El bien o equipo de reemplazo ya tiene una asignación activa o una autorización pendiente' });
    console.error(error);
    res.status(500).json({ error: 'No se pudo registrar el movimiento' });
  }
};

const approve = async (req, res, sql) => {
  const approved = req.body?.aprobado !== false;
  try {
    const result = await sql.begin(async (tx) => {
      const [pending] = await tx`
        SELECT m.*, p.correo_jefe FROM movimientos_patrimoniales m
        LEFT JOIN personal p ON p.id = m.personal_id
        WHERE m.id = ${req.params.id} AND m.estado = 'pendiente' FOR UPDATE OF m
      `;
      if (!pending) { const e = new Error('Movimiento pendiente no encontrado'); e.status = 404; throw e; }
      const isAdmin = req.user?.rol === 'administrador';
      if (!isAdmin && String(req.user?.email || '').toLowerCase() !== String(pending.correo_jefe || '').toLowerCase()) {
        const e = new Error('Solo el jefe inmediato registrado o un administrador puede resolver esta autorización');
        e.status = 403;
        throw e;
      }
      if (approved && pending.tipo === 'cambio') {
        const assets = await tx`
          SELECT id, estado FROM bienes_informaticos
          WHERE id IN (${pending.bien_id}, ${pending.bien_reemplazo_id})
          ORDER BY id FOR UPDATE
        `;
        const oldAsset = assets.find((asset) => Number(asset.id) === Number(pending.bien_id));
        const replacement = assets.find((asset) => Number(asset.id) === Number(pending.bien_reemplazo_id));
        const [assignment] = await tx`
          SELECT id, personal_id FROM asignaciones
          WHERE bien_id = ${pending.bien_id} AND fecha_devolucion IS NULL FOR UPDATE
        `;
        const [replacementAssignment] = await tx`
          SELECT id FROM asignaciones
          WHERE bien_id = ${pending.bien_reemplazo_id} AND fecha_devolucion IS NULL
        `;
        if (!oldAsset || oldAsset.estado !== 'asignado' || !assignment || Number(assignment.personal_id) !== Number(pending.personal_id)) {
          const e = new Error('La asignación del equipo averiado cambió; no se puede aprobar este movimiento');
          e.status = 409;
          throw e;
        }
        if (!replacement || replacement.estado !== 'activo' || replacementAssignment) {
          const e = new Error('El equipo de reemplazo dejó de estar disponible; no se puede aprobar este movimiento');
          e.status = 409;
          throw e;
        }
      }
      const [updated] = await tx`
        UPDATE movimientos_patrimoniales
        SET estado=${approved ? 'aprobado' : 'rechazado'}, aprobado_por=${req.user?.sub || null},
            aprobado_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
        WHERE id=${req.params.id} RETURNING *
      `;
      if (approved && ['asignacion', 'prestamo'].includes(updated.tipo)) {
        await tx`UPDATE asignaciones SET fecha_devolucion = ${updated.fecha_movimiento}, estado = 'devuelta'
          WHERE bien_id = ${updated.bien_id} AND fecha_devolucion IS NULL`;
        await tx`INSERT INTO asignaciones (bien_id, personal_id, usuario_id, fecha_asignacion, observaciones, estado)
          VALUES (${updated.bien_id}, ${updated.personal_id}, ${req.user?.sub || null}, ${updated.fecha_movimiento}, ${updated.observaciones}, 'activa')`;
        await tx`UPDATE bienes_informaticos SET estado='asignado', updated_at=CURRENT_TIMESTAMP WHERE id=${updated.bien_id}`;
      } else if (approved && updated.tipo === 'cambio') {
        await tx`UPDATE asignaciones SET fecha_devolucion = ${updated.fecha_movimiento}, estado = 'devuelta'
          WHERE bien_id = ${updated.bien_id} AND fecha_devolucion IS NULL`;
        await tx`INSERT INTO asignaciones (bien_id, personal_id, usuario_id, fecha_asignacion, observaciones, estado)
          VALUES (${updated.bien_reemplazo_id}, ${updated.personal_id}, ${req.user?.sub || null}, ${updated.fecha_movimiento}, ${updated.observaciones}, 'activa')`;
        await tx`UPDATE bienes_informaticos SET estado='mantenimiento', updated_at=CURRENT_TIMESTAMP WHERE id=${updated.bien_id}`;
        await tx`UPDATE bienes_informaticos SET estado='asignado', updated_at=CURRENT_TIMESTAMP WHERE id=${updated.bien_reemplazo_id}`;
      } else if (approved && updated.tipo === 'retiro') {
        await tx`UPDATE asignaciones SET fecha_devolucion = ${updated.fecha_movimiento}, estado = 'devuelta'
          WHERE bien_id = ${updated.bien_id} AND fecha_devolucion IS NULL`;
        await tx`UPDATE bienes_informaticos SET estado='activo', updated_at=CURRENT_TIMESTAMP WHERE id=${updated.bien_id}`;
      }
      return updated;
    });
    res.json(result);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: 'No se pudo resolver la aprobación' });
  }
};

export const listMovimientos = list;
export const createMovimiento = create;
export const approveMovimiento = approve;
export const returnLoan = async (req, res, sql) => {
  const date = req.body?.fecha_retorno || new Date().toISOString().slice(0, 10);
  if (!DATE.test(date)) return res.status(400).json({ error: 'La fecha de retorno no es válida' });
  try {
    const result = await sql.begin(async (tx) => {
      const [loan] = await tx`SELECT * FROM movimientos_patrimoniales WHERE id=${req.params.id} FOR UPDATE`;
      if (!loan || loan.tipo !== 'prestamo' || loan.estado !== 'aprobado') {
        const e = new Error('No se encontró un préstamo aprobado pendiente de retorno');
        e.status = 404;
        throw e;
      }
      if (date < String(loan.fecha_movimiento).slice(0, 10)) {
        const e = new Error('La fecha de retorno no puede ser anterior al préstamo');
        e.status = 400;
        throw e;
      }
      const [updated] = await tx`UPDATE movimientos_patrimoniales
        SET fecha_retorno=${date}, estado='ejecutado', updated_at=CURRENT_TIMESTAMP
        WHERE id=${req.params.id} RETURNING *`;
      await tx`UPDATE asignaciones SET fecha_devolucion=${date}, estado='devuelta'
        WHERE bien_id=${loan.bien_id} AND fecha_devolucion IS NULL`;
      await tx`UPDATE bienes_informaticos SET estado='activo', updated_at=CURRENT_TIMESTAMP
        WHERE id=${loan.bien_id} AND estado='asignado'`;
      return updated;
    });
    res.json(result);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error al registrar retorno de préstamo:', error);
    res.status(500).json({ error: 'No se pudo registrar el retorno del préstamo' });
  }
};
export const documentMovimiento = async (req, res, sql) => {
  try {
    const rows = await sql`SELECT ${sql.unsafe(fields)} FROM movimientos_patrimoniales m JOIN bienes_informaticos b ON b.id=m.bien_id LEFT JOIN bienes_informaticos b_reemplazo ON b_reemplazo.id=m.bien_reemplazo_id LEFT JOIN personal p ON p.id=m.personal_id LEFT JOIN personal pd ON pd.id=m.personal_destino_id WHERE m.id=${req.params.id}`;
    if (!rows.length) return res.status(404).send('Movimiento no encontrado');
    res.type('html').send(buildDocument(rows[0]));
  } catch (error) {
    console.error('Error al generar documento de movimiento:', error);
    res.status(500).json({ error: 'No se pudo generar el documento' });
  }
};
