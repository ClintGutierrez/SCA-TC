export const getMantenimiento = async (req, res, sql) => {
  try {
    const mantenimiento = await sql`SELECT * FROM mantenimiento ORDER BY fecha DESC`;
    res.json(mantenimiento);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getMantenimientoPorBien = async (req, res, sql) => {
  try {
    const { bienId } = req.params;
    const mantenimiento = await sql`SELECT * FROM mantenimiento WHERE bien_id = ${bienId} ORDER BY fecha DESC`;
    res.json(mantenimiento);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createMantenimiento = async (req, res, sql) => {
  try {
    const { bienId, tipo, descripcion, fecha, costo, responsable } = req.body;
    
    const mantenimiento = await sql`
      INSERT INTO mantenimiento (bien_id, tipo, descripcion, fecha, costo, responsable)
      VALUES (${bienId}, ${tipo}, ${descripcion}, ${fecha}, ${costo}, ${responsable})
      RETURNING *
    `;
    res.status(201).json(mantenimiento[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteMantenimiento = async (req, res, sql) => {
  try {
    const { id } = req.params;
    const result = await sql`DELETE FROM mantenimiento WHERE id = ${id}`;
    if (result.count === 0) {
      return res.status(404).json({ error: 'Registro de mantenimiento no encontrado' });
    }
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
