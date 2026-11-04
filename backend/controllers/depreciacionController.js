import { getYear } from 'date-fns';

export const calcularDepreciacion = (valorInicial, porcentajeAnual, anios) => {
  return valorInicial * Math.pow(1 - porcentajeAnual / 100, anios);
};

export const getDepreciacion = async (req, res, sql) => {
  try {
    const depreciacion = await sql`SELECT * FROM depreciacion`;
    res.json(depreciacion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getDepreciacionPorBien = async (req, res, sql) => {
  try {
    const { bienId } = req.params;
    const depreciacion = await sql`SELECT * FROM depreciacion WHERE bien_id = ${bienId}`;
    if (depreciacion.length === 0) {
      return res.status(404).json({ error: 'Depreciación no encontrada' });
    }
    res.json(depreciacion[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const crearDepreciacion = async (req, res, sql) => {
  try {
    const { bienId, valorInicial, porcentajeAnual } = req.body;
    const anoActual = getYear(new Date());
    
    const depreciacion = await sql`
      INSERT INTO depreciacion (bien_id, valor_inicial, porcentaje_anual, valor_actual, ano_actual)
      VALUES (${bienId}, ${valorInicial}, ${porcentajeAnual || 20}, ${valorInicial}, ${anoActual})
      RETURNING *
    `;
    res.status(201).json(depreciacion[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const actualizarDepreciacion = async (req, res, sql) => {
  try {
    const { bienId } = req.params;
    
    // Obtener datos de depreciación
    const depreciacionData = await sql`SELECT * FROM depreciacion WHERE bien_id = ${bienId}`;
    if (depreciacionData.length === 0) {
      return res.status(404).json({ error: 'Depreciación no encontrada' });
    }
    
    const { valor_inicial, porcentaje_anual, ano_actual } = depreciacionData[0];
    const anoActual = getYear(new Date());
    const anios = anoActual - ano_actual;
    
    const nuevoValor = calcularDepreciacion(valor_inicial, porcentaje_anual, anios);
    
    const result = await sql`
      UPDATE depreciacion 
      SET valor_actual = ${nuevoValor}, ano_actual = ${anoActual}
      WHERE bien_id = ${bienId}
      RETURNING *
    `;
    
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
