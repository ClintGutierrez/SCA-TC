export const getAuditoria = async (req, res, sql) => {
  const { desde, hasta, usuario, modulo, accion } = req.query;

  try {
    const logs = await sql`
      SELECT * FROM log_auditoria
      WHERE 
        (${desde || null}::timestamp IS NULL OR fecha_hora >= ${desde}) AND
        (${hasta || null}::timestamp IS NULL OR fecha_hora <= ${hasta}) AND
        (${usuario || null}::text IS NULL OR usuario ILIKE ${'%' + usuario + '%'}) AND
        (${modulo || null}::text IS NULL OR modulo = ${modulo}) AND
        (${accion || null}::text IS NULL OR accion = ${accion})
      ORDER BY fecha_hora DESC
      LIMIT 50
    `.timeout(3000);

    res.status(200).json(logs);
  } catch (error) {
    if (error.code === 'TIMEOUT') {
      return res.status(408).json({ 
        error: "La consulta excede el limite de procesamiento. Por favor refine los filtros aplicados" 
      });
    }
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};