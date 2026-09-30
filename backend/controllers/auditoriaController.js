export const getAuditoria = async (req, res, sql) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const logs = await sql`
          SELECT a.id,
            a.usuario_id,
            a.tabla_afectada,
            a.operacion,
            a.registro_id,
            a.datos_anteriores,
            a.datos_nuevos,
            a.created_at,
             u.nombre AS usuario, u.email
      FROM audit_log a
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.usuario_id IS NOT NULL
      ORDER BY a.created_at DESC
      LIMIT ${limit}
    `;

    return res.json(logs);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
