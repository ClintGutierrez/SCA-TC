export const getAuditoria = async (req, res, sql) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const logs = await sql`
      SELECT a.id, a.accion, a.recurso, a.metodo, a.estado_http, a.ip, a.created_at,
             u.nombre AS usuario, u.email
      FROM auditoria a
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      ORDER BY a.created_at DESC
      LIMIT ${limit}
    `;

    return res.json(logs);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
