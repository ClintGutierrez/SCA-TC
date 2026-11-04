const getId = (value) => /^\d+$/.test(String(value)) && Number(value) > 0 ? Number(value) : null;

export const listarMias = async (req, res, sql) => {
  const unreadOnly = req.query.leida === 'false';
  try {
    const notifications = unreadOnly
      ? await sql`
        SELECT id, usuario_id, pedido_id, tipo, titulo, mensaje, leida, fecha_lectura,
               canal, estado_correo, created_at
        FROM notificaciones
        WHERE usuario_id = ${req.user.sub} AND leida = FALSE
        ORDER BY created_at DESC NULLS LAST, id DESC
        LIMIT 50
      `
      : await sql`
        SELECT id, usuario_id, pedido_id, tipo, titulo, mensaje, leida, fecha_lectura,
               canal, estado_correo, created_at
        FROM notificaciones
        WHERE usuario_id = ${req.user.sub}
        ORDER BY created_at DESC NULLS LAST, id DESC
        LIMIT 50
      `;
    return res.json(notifications);
  } catch (error) {
    console.error('Error al listar notificaciones:', error);
    return res.status(500).json({ error: 'No se pudieron obtener las notificaciones' });
  }
};

export const contarNoLeidas = async (req, res, sql) => {
  try {
    const [result] = await sql`
      SELECT COUNT(*)::INTEGER AS count
      FROM notificaciones
      WHERE usuario_id = ${req.user.sub} AND leida = FALSE
    `;
    return res.json(result);
  } catch (error) {
    console.error('Error al contar notificaciones no leídas:', error);
    return res.status(500).json({ error: 'No se pudo obtener el contador de notificaciones' });
  }
};

export const marcarLeida = async (req, res, sql) => {
  const id = getId(req.params.id);
  if (!id) return res.status(400).json({ error: 'El identificador de la notificación no es válido' });

  try {
    const [notification] = await sql`
      UPDATE notificaciones
      SET leida = TRUE, fecha_lectura = COALESCE(fecha_lectura, CURRENT_TIMESTAMP)
      WHERE id = ${id} AND usuario_id = ${req.user.sub}
      RETURNING id, usuario_id, pedido_id, leida, fecha_lectura
    `;
    if (!notification) return res.status(404).json({ error: 'Notificación no encontrada' });
    return res.json(notification);
  } catch (error) {
    console.error('Error al marcar notificación como leída:', error);
    return res.status(500).json({ error: 'No se pudo marcar la notificación como leída' });
  }
};

export const marcarTodasLeidas = async (req, res, sql) => {
  try {
    const notifications = await sql`
      UPDATE notificaciones
      SET leida = TRUE, fecha_lectura = COALESCE(fecha_lectura, CURRENT_TIMESTAMP)
      WHERE usuario_id = ${req.user.sub} AND leida = FALSE
      RETURNING id
    `;
    return res.json({ updated: notifications.length });
  } catch (error) {
    console.error('Error al marcar notificaciones como leídas:', error);
    return res.status(500).json({ error: 'No se pudieron marcar todas las notificaciones como leídas' });
  }
};
