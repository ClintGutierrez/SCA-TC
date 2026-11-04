import { isSmtpConfigured, sendEmail } from '../utils/emailService.js';

const PEDIDO_STATES = new Set(['solicitado', 'en_almacen', 'recepcionado', 'cancelado']);
const CONFORMITIES = new Set(['conforme', 'observado', 'no_conforme']);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

const requestError = (status, message) => Object.assign(new Error(message), { status });
const getId = (value) => {
  if (!/^\d+$/.test(String(value))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const pedidoColumns = `p.*,
  almacen.nombre AS registrado_por_almacen_nombre,
  derivador.nombre AS derivado_por_nombre,
  asignado.nombre AS derivado_a_usuario_nombre,
  receptor.nombre AS recepcionado_por_nombre`;

const setAuditUser = async (tx, user) => {
  const candidateId = Number(user?.sub ?? user?.id);
  const [validUser] = Number.isSafeInteger(candidateId) && candidateId > 0
    ? await tx`SELECT id FROM usuarios WHERE id = ${candidateId} LIMIT 1`
    : [];
  await tx`SELECT set_config('app.audit_user_id', ${validUser ? String(validUser.id) : ''}, TRUE)`;
};

const generatePedidoNumber = async (tx, year = new Date().getFullYear()) => {
  const prefix = `OC-${year}-`;
  await tx`SELECT pg_advisory_xact_lock(hashtext(${prefix}))`;

  const rows = await tx`
    SELECT numero_pedido
    FROM pedidos
    WHERE numero_pedido LIKE ${`${prefix}%`}
  `;

  let lastSequence = 0;
  for (const row of rows) {
    const match = /^OC-\d{4}-(\d{4})$/.exec(String(row.numero_pedido || '').trim());
    if (match?.[1] && match[0].startsWith(prefix)) {
      lastSequence = Math.max(lastSequence, Number(match[1]));
    }
  }

  return `${prefix}${String(lastSequence + 1).padStart(4, '0')}`;
};

export const siguienteNumero = async (req, res, sql) => {
  try {
    const numeroPedido = await sql.begin((tx) => generatePedidoNumber(tx));
    return res.json({ numero_pedido: numeroPedido });
  } catch (error) {
    console.error('Error al generar el número de pedido:', error);
    return res.status(500).json({ error: 'No se pudo generar el número de pedido' });
  }
};

const fetchPedido = async (sql, id) => {
  const [pedido] = await sql`
    SELECT ${sql.unsafe(pedidoColumns)}
    FROM pedidos p
    LEFT JOIN usuarios almacen ON almacen.id = p.registrado_por_almacen_id
    LEFT JOIN usuarios derivador ON derivador.id = p.derivado_por_id
    LEFT JOIN usuarios asignado ON asignado.id = p.derivado_a_usuario_id
    LEFT JOIN usuarios receptor ON receptor.id = p.recepcionado_por_id
    WHERE p.id = ${id}
    LIMIT 1
  `;
  return pedido;
};

const makeArrivalEmail = (pedido, almacenName) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;color:#172033">
  <h2>Pedido en almacén pendiente de recepción</h2>
  <p><strong>N.º de pedido:</strong> ${esc(pedido.numero_pedido)}</p>
  <p><strong>Descripción:</strong> ${esc(pedido.descripcion)}</p>
  <p><strong>Cantidad:</strong> ${esc(pedido.cantidad)}</p>
  <p><strong>Fecha y hora de llegada:</strong> ${esc(pedido.fecha_llegada)}</p>
  <p><strong>Registrado por:</strong> ${esc(almacenName || 'Personal de almacén')}</p>
  <p><strong>Observaciones:</strong> ${esc(pedido.observaciones_almacen || 'Sin observaciones')}</p>
</body></html>`;

export const listar = async (req, res, sql) => {
  const { estado, search, numero_pedido: numeroPedido } = req.query;
  if (estado && !PEDIDO_STATES.has(String(estado))) {
    return res.status(400).json({ error: 'El estado del pedido no es válido' });
  }

  const stateFilter = estado ? String(estado) : null;
  const searchFilter = String(numeroPedido || search || '').trim() || null;

  try {
    const rows = await sql`
      SELECT ${sql.unsafe(pedidoColumns)}
      FROM pedidos p
      LEFT JOIN usuarios almacen ON almacen.id = p.registrado_por_almacen_id
      LEFT JOIN usuarios derivador ON derivador.id = p.derivado_por_id
      LEFT JOIN usuarios asignado ON asignado.id = p.derivado_a_usuario_id
      LEFT JOIN usuarios receptor ON receptor.id = p.recepcionado_por_id
      WHERE (${stateFilter}::text IS NULL OR p.estado = ${stateFilter})
        AND (${searchFilter}::text IS NULL OR p.numero_pedido ILIKE ${searchFilter ? `%${searchFilter}%` : null})
      ORDER BY p.created_at DESC NULLS LAST, p.id DESC
    `;
    return res.json(rows);
  } catch (error) {
    console.error('Error al listar pedidos:', error);
    return res.status(500).json({ error: 'No se pudieron obtener los pedidos' });
  }
};

export const obtenerPorId = async (req, res, sql) => {
  const id = getId(req.params.id);
  if (!id) return res.status(400).json({ error: 'El identificador del pedido no es válido' });

  try {
    const pedido = await fetchPedido(sql, id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    return res.json(pedido);
  } catch (error) {
    console.error('Error al obtener pedido:', error);
    return res.status(500).json({ error: 'No se pudo obtener el pedido' });
  }
};

export const crear = async (req, res, sql) => {
  const descripcion = String(req.body?.descripcion || '').trim();
  const cantidad = Number(req.body?.cantidad);
  if (!descripcion || !Number.isSafeInteger(cantidad) || cantidad < 1) {
    return res.status(400).json({ error: 'Descripción y cantidad positiva son obligatorios' });
  }

  try {
    const pedido = await sql.begin(async (tx) => {
      await setAuditUser(tx, req.user);
      const numeroPedido = await generatePedidoNumber(tx);
      const [created] = await tx`
        INSERT INTO pedidos (numero_pedido, descripcion, cantidad, estado)
        VALUES (${numeroPedido}, ${descripcion}, ${cantidad}, 'solicitado')
        RETURNING *
      `;

      const almacenUsers = await tx`
        SELECT id
        FROM usuarios
        WHERE LOWER(rol) = 'almacen'
          AND COALESCE(estado, 'activo') = 'activo'
          AND COALESCE(activo_login, TRUE) = TRUE
      `;
      for (const almacenUser of almacenUsers) {
        await tx`
          INSERT INTO notificaciones
            (usuario_id, pedido_id, tipo, titulo, mensaje, canal, estado_correo, intentos_correo)
          VALUES (
            ${almacenUser.id}, ${created.id}, 'nuevo_pedido',
            ${`Nuevo pedido ${numeroPedido}`},
            ${`Nuevo pedido ${numeroPedido} registrado, pendiente de llegada física a almacén.`},
            'sistema', 'pendiente', 0
          )
        `;
      }
      return created;
    });
    return res.status(201).json(pedido);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un pedido con ese número' });
    console.error('Error al crear pedido:', error);
    return res.status(500).json({ error: 'No se pudo crear el pedido' });
  }
};

export const cancelar = async (req, res, sql) => {
  const id = getId(req.params.id);
  if (!id) return res.status(400).json({ error: 'El identificador del pedido no es válido' });

  try {
    const deleted = await sql.begin(async (tx) => {
      const [current] = await tx`
        SELECT id, numero_pedido, estado
        FROM pedidos
        WHERE id = ${id}
        FOR UPDATE
      `;
      if (!current) throw requestError(404, 'Pedido no encontrado');
      if (current.estado !== 'solicitado') {
        throw requestError(409, 'Solo se pueden cancelar pedidos en estado Solicitado');
      }

      await tx`DELETE FROM notificaciones WHERE pedido_id = ${id}`;
      await setAuditUser(tx, req.user);
      const [removed] = await tx`
        DELETE FROM pedidos
        WHERE id = ${id}
        RETURNING id, numero_pedido
      `;
      return removed;
    });

    return res.json({ message: 'Pedido cancelado correctamente', pedido: deleted });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error al cancelar pedido:', error);
    return res.status(500).json({ error: 'No se pudo cancelar el pedido' });
  }
};

export const registrarLlegada = async (req, res, sql) => {
  const id = getId(req.params.id);
  if (!id) return res.status(400).json({ error: 'El identificador del pedido no es válido' });

  const dateInput = req.body?.fecha_llegada;
  const arrivalDate = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(arrivalDate.getTime())) {
    return res.status(400).json({ error: 'La fecha de llegada no es válida' });
  }
  const observations = String(req.body?.observaciones_almacen || '').trim() || null;

  let transition;
  try {
    transition = await sql.begin(async (tx) => {
      const [current] = await tx`SELECT * FROM pedidos WHERE id = ${id} FOR UPDATE`;
      if (!current) throw requestError(404, 'Pedido no encontrado');
      if (current.estado !== 'solicitado') {
        throw requestError(409, 'El pedido ya fue registrado en almacén o ya no está solicitado');
      }

      const managers = await tx`
        SELECT id, nombre, email
        FROM usuarios
        WHERE LOWER(rol) = 'jefatura'
          AND COALESCE(estado, 'activo') = 'activo'
          AND COALESCE(activo_login, TRUE) = TRUE
        ORDER BY id
      `;
      await setAuditUser(tx, req.user);
      const [updated] = await tx`
        UPDATE pedidos
        SET estado = 'en_almacen',
            fecha_llegada = ${arrivalDate.toISOString()},
            registrado_por_almacen_id = ${req.user.sub},
            observaciones_almacen = ${observations},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;

      const notifications = [];
      for (const manager of managers) {
        const hasEmail = Boolean(manager.email);
        const emailAvailable = hasEmail && isSmtpConfigured();
        const [notification] = await tx`
          INSERT INTO notificaciones
            (usuario_id, pedido_id, tipo, titulo, mensaje, canal, estado_correo, intentos_correo, ultimo_error)
          VALUES (
            ${manager.id}, ${id}, 'llegada_almacen',
            ${`Pedido ${updated.numero_pedido} recibido en almacén`},
            ${`El pedido ${updated.numero_pedido} llegó y está pendiente de recepción.`},
            ${emailAvailable ? 'ambos' : 'sistema'},
            'pendiente', 0,
            ${hasEmail ? (emailAvailable ? null : 'SMTP no configurado') : 'No hay correo registrado para la jefatura'}
          )
          RETURNING id, usuario_id
        `;
        notifications.push({ ...notification, email: manager.email, nombre: manager.nombre });
      }

      return { pedido: updated, notifications };
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error al registrar llegada del pedido:', error);
    return res.status(500).json({ error: 'No se pudo registrar la llegada del pedido' });
  }

  const mailResults = [];
  for (const notification of transition.notifications) {
    if (!notification.email || !isSmtpConfigured()) {
      mailResults.push({
        notification_id: notification.id,
        status: 'not_configured',
        reason: notification.email ? 'SMTP no configurado' : 'No hay correo registrado para la jefatura',
      });
      continue;
    }

    let status = 'enviado';
    let errorMessage = null;
    try {
      await sendEmail({
        to: notification.email,
        subject: `Pedido en almacén pendiente de recepción – N.º ${transition.pedido.numero_pedido}`,
        html: makeArrivalEmail(transition.pedido, req.user.nombre),
      });
    } catch (error) {
      status = 'fallido';
      errorMessage = error.message || 'No se pudo enviar el correo';
      console.error(`Error al enviar correo para notificación ${notification.id}:`, error);
    }

    try {
      await sql`
        UPDATE notificaciones
        SET estado_correo = ${status},
            intentos_correo = intentos_correo + 1,
            ultimo_error = ${errorMessage}
        WHERE id = ${notification.id} AND usuario_id = ${notification.usuario_id}
      `;
    } catch (error) {
      status = 'error_registro';
      errorMessage = 'No se pudo guardar el resultado del correo';
      console.error(`Error al actualizar estado de correo de notificación ${notification.id}:`, error);
    }
    mailResults.push({ notification_id: notification.id, status, reason: errorMessage });
  }

  return res.json({
    message: transition.notifications.length
      ? 'Llegada registrada y notificación generada para Jefatura de TI'
      : 'Llegada registrada; no hay usuarios activos de Jefatura para notificar',
    pedido: transition.pedido,
    notificaciones: transition.notifications.map(({ id: notificationId, usuario_id }) => ({
      id: notificationId,
      usuario_id,
    })),
    correo: mailResults,
  });
};

export const derivar = async (req, res, sql) => {
  const id = getId(req.params.id);
  const targetId = getId(req.body?.derivado_a_usuario_id);
  const observations = String(req.body?.observaciones_derivacion || '').trim() || null;
  if (!id || !targetId) return res.status(400).json({ error: 'Pedido y usuario destinatario son obligatorios' });

  try {
    const pedido = await sql.begin(async (tx) => {
      const [current] = await tx`SELECT * FROM pedidos WHERE id = ${id} FOR UPDATE`;
      if (!current) throw requestError(404, 'Pedido no encontrado');
      if (current.estado !== 'en_almacen') {
        throw requestError(409, 'Solo se pueden derivar pedidos que estén en almacén');
      }
      if (current.derivado_a_usuario_id || current.fecha_derivacion) {
        throw requestError(409, 'El pedido ya fue derivado');
      }
      const [target] = await tx`
        SELECT id, rol
        FROM usuarios
        WHERE id = ${targetId}
          AND LOWER(rol) = 'tecnico'
          AND COALESCE(estado, 'activo') = 'activo'
          AND COALESCE(activo_login, TRUE) = TRUE
        LIMIT 1
      `;
      if (!target) throw requestError(400, 'Selecciona un usuario activo de Tecnología de la Información');

      await setAuditUser(tx, req.user);
      const [updated] = await tx`
        UPDATE pedidos
        SET derivado_a_usuario_id = ${targetId},
            derivado_por_id = ${req.user.sub},
            fecha_derivacion = CURRENT_TIMESTAMP,
            observaciones_derivacion = ${observations},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
      await tx`
        INSERT INTO notificaciones
          (usuario_id, pedido_id, tipo, titulo, mensaje, canal, estado_correo, intentos_correo)
        VALUES (
          ${targetId}, ${id}, 'pedido_derivado',
          ${`Pedido ${updated.numero_pedido} derivado para recepción`},
          ${`Jefatura te asignó la recepción del pedido ${updated.numero_pedido}.`},
          'sistema', 'pendiente', 0
        )
      `;
      return updated;
    });
    return res.json({ message: 'Pedido derivado correctamente', pedido });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error al derivar pedido:', error);
    return res.status(500).json({ error: 'No se pudo derivar el pedido' });
  }
};

export const recepcionar = async (req, res, sql) => {
  const id = getId(req.params.id);
  const conformidad = String(req.body?.conformidad || '').trim();
  const observations = String(req.body?.observaciones_recepcion || '').trim() || null;
  if (!id || !CONFORMITIES.has(conformidad)) {
    return res.status(400).json({ error: 'Pedido y conformidad válida son obligatorios' });
  }

  try {
    const pedido = await sql.begin(async (tx) => {
      const [current] = await tx`SELECT * FROM pedidos WHERE id = ${id} FOR UPDATE`;
      if (!current) throw requestError(404, 'Pedido no encontrado');
      if (current.estado === 'recepcionado') throw requestError(409, 'El pedido ya fue recepcionado');
      if (current.estado !== 'en_almacen') {
        throw requestError(409, 'Solo se pueden recepcionar pedidos que estén en almacén');
      }
      if (!current.derivado_a_usuario_id || !current.fecha_derivacion) {
        throw requestError(409, 'El pedido debe estar derivado antes de la recepción técnica');
      }
      if (Number(current.derivado_a_usuario_id) !== Number(req.user.sub)) {
        throw requestError(403, 'Solo el técnico asignado puede registrar la recepción');
      }

      await setAuditUser(tx, req.user);
      const [updated] = await tx`
        UPDATE pedidos
        SET estado = 'recepcionado',
            recepcionado_por_id = ${req.user.sub},
            fecha_recepcion = CURRENT_TIMESTAMP,
            conformidad = ${conformidad},
            observaciones_recepcion = ${observations},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
      return updated;
    });
    return res.json({ message: 'Recepción del pedido registrada', pedido });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error al recepcionar pedido:', error);
    return res.status(500).json({ error: 'No se pudo registrar la recepción del pedido' });
  }
};
