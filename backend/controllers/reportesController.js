export const getReporteInventario = async (req, res, sql) => {
  try {
    const reporte = await sql`
      SELECT 
        COUNT(*) as total_bienes,
        SUM(CASE WHEN estado = 'activo' THEN 1 ELSE 0 END) as activos,
        SUM(CASE WHEN estado = 'inactivo' THEN 1 ELSE 0 END) as inactivos,
        SUM(CASE WHEN estado = 'reparacion' THEN 1 ELSE 0 END) as en_reparacion,
        SUM(costo) as valor_total
      FROM bienes_informaticos
    `;
    res.json(reporte[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getReporteDepreciacion = async (req, res, sql) => {
  try {
    const reporte = await sql`
      SELECT 
        b.id,
        b.nombre,
        b.tipo,
        d.valor_inicial,
        d.valor_actual,
        (d.valor_inicial - d.valor_actual) as depreciacion_total,
        ROUND(((d.valor_inicial - d.valor_actual) / d.valor_inicial * 100)::numeric, 2) as porcentaje_depreciacion
      FROM bienes_informaticos b
      LEFT JOIN depreciacion d ON b.id = d.bien_id
      ORDER BY b.nombre
    `;
    res.json(reporte);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getReporteAsignaciones = async (req, res, sql) => {
  try {
    const reporte = await sql`
      SELECT 
        u.nombre as usuario,
        COUNT(a.id) as cantidad_equipos,
        STRING_AGG(b.nombre, ', ') as equipos
      FROM usuarios u
      LEFT JOIN asignaciones a ON u.id = a.usuario_id AND a.fecha_devolucion IS NULL
      LEFT JOIN bienes_informaticos b ON a.bien_id = b.id
      GROUP BY u.id, u.nombre
      ORDER BY u.nombre
    `;
    res.json(reporte);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getReporteMantenimiento = async (req, res, sql) => {
  try {
    const reporte = await sql`
      SELECT 
        b.nombre,
        b.tipo,
        COUNT(m.id) as cantidad_mantenimientos,
        SUM(m.costo) as costo_total_mantenimiento,
        MAX(m.fecha) as ultimo_mantenimiento
      FROM bienes_informaticos b
      LEFT JOIN mantenimiento m ON b.id = m.bien_id
      GROUP BY b.id, b.nombre, b.tipo
      ORDER BY costo_total_mantenimiento DESC
    `;
    res.json(reporte);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
