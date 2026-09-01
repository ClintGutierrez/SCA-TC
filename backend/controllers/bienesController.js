import { v4 as uuidv4 } from 'uuid';

export const getBienes = async (req, res, sql) => {
  try {
    const bienes = await sql`SELECT * FROM bienes_informaticos ORDER BY created_at DESC`;
    res.json(bienes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getBienById = async (req, res, sql) => {
  try {
    const { id } = req.params;
    const bien = await sql`SELECT * FROM bienes_informaticos WHERE id = ${id}`;
    if (bien.length === 0) {
      return res.status(404).json({ error: 'Bien no encontrado' });
    }
    res.json(bien[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createBien = async (req, res, sql) => {
  try {
    const { nombre, descripcion, tipo, marca, modelo, numeroSerie, fechaAdquisicion, costo, usuarioAsignado, ubicacion } = req.body;
    
    const bien = await sql`
      INSERT INTO bienes_informaticos (nombre, descripcion, tipo, marca, modelo, numero_serie, fecha_adquisicion, costo, usuario_asignado, estado, ubicacion)
      VALUES (${nombre}, ${descripcion}, ${tipo}, ${marca}, ${modelo}, ${numeroSerie}, ${fechaAdquisicion}, ${costo}, ${usuarioAsignado}, 'activo', ${ubicacion})
      RETURNING *
    `;
    res.status(201).json(bien[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateBien = async (req, res, sql) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, tipo, marca, modelo, numeroSerie, costo, usuarioAsignado, estado, ubicacion } = req.body;
    
    const bien = await sql`
      UPDATE bienes_informaticos 
      SET nombre = ${nombre}, 
          descripcion = ${descripcion}, 
          tipo = ${tipo}, 
          marca = ${marca}, 
          modelo = ${modelo}, 
          numero_serie = ${numeroSerie}, 
          costo = ${costo}, 
          usuario_asignado = ${usuarioAsignado}, 
          estado = ${estado}, 
          ubicacion = ${ubicacion},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    
    if (bien.length === 0) {
      return res.status(404).json({ error: 'Bien no encontrado' });
    }
    res.json(bien[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteBien = async (req, res, sql) => {
  try {
    const { id } = req.params;
    const result = await sql`DELETE FROM bienes_informaticos WHERE id = ${id}`;
    if (result.count === 0) {
      return res.status(404).json({ error: 'Bien no encontrado' });
    }
    res.json({ message: 'Bien eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
