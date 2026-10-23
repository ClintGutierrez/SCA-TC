export const getAuditoria = async (req, res, sql) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const { desde, hasta, usuario, modulo, accion, tipo } = req.query;

    let whereClause = sql``;
    let hasFilters = false;

    const addFilter = (condition) => {
      if (!condition) {
        return;
      }

      if (!hasFilters) {
        whereClause = sql`WHERE ${condition}`;
        hasFilters = true;
        return;
      }

      whereClause = sql`${whereClause} AND ${condition}`;
    };

    if (tipo === 'acciones') {
      addFilter(sql`LOWER(COALESCE(a.tabla_afectada, '')) <> 'autenticacion'`);
    } else if (tipo === 'sesiones') {
      addFilter(sql`LOWER(a.tabla_afectada) = 'autenticacion'`);
    }

    if (desde) {
      addFilter(sql`DATE(a.created_at) >= ${desde}`);
    }

    if (hasta) {
      addFilter(sql`DATE(a.created_at) <= ${hasta}`);
    }

    if (usuario) {
      const usuarioId = Number(usuario);
      addFilter(sql`a.usuario_id = ${Number.isInteger(usuarioId) && usuarioId > 0 ? usuarioId : 0}`);
    }

    if (modulo && modulo !== 'Todos' && modulo !== 'todos') {
      const moduloNormalizado = String(modulo).trim().toLowerCase();
      const moduloLike = `${moduloNormalizado}%`;
      addFilter(sql`(LOWER(a.tabla_afectada) = LOWER(${moduloNormalizado}) OR LOWER(a.tabla_afectada) LIKE LOWER(${moduloLike}))`);
    }

    if (accion && accion !== 'Todas' && accion !== 'todas') {
      const accionNormalizada = String(accion).trim().toUpperCase();
      const accionAlternativas = {
        CREAR: ['CREAR', 'INSERT'],
        INSERT: ['CREAR', 'INSERT'],
        ACTUALIZAR: ['ACTUALIZAR', 'UPDATE'],
        UPDATE: ['ACTUALIZAR', 'UPDATE'],
        ELIMINAR: ['ELIMINAR', 'DELETE'],
        DELETE: ['ELIMINAR', 'DELETE'],
      };

      const alternativos = accionAlternativas[accionNormalizada] || [accionNormalizada];
      const condicion = alternativos
        .map((valor) => sql`UPPER(a.operacion) = ${valor}`)
        .reduce((acc, condition) => (acc ? sql`${acc} OR ${condition}` : condition), null);

      addFilter(sql`(${condicion})`);
    }

    const logs = await sql`
      SELECT a.id,
             a.usuario_id,
             a.tabla_afectada,
             a.operacion,
             a.registro_id,
             a.datos_anteriores,
             a.datos_nuevos,
             a.created_at,
             u.nombre AS usuario,
             u.email
      FROM audit_log a
      INNER JOIN usuarios u ON u.id = a.usuario_id
        AND u.nombre IS NOT NULL
        AND COALESCE(u.estado, 'activo') <> 'inactivo'
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ${limit}
    `;

    return res.json(logs);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
