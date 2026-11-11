import { anoAdquisicion, anoLima, calcularAlAno, calcularDepreciacion, depreciationError, validarBienId, validarPorcentajeAnual, validarValorInicial } from '../utils/depreciacion.js';
export { calcularDepreciacion } from '../utils/depreciacion.js';

const respondError = (res, error) => {
  if (error.status) return res.status(error.status).json({ error: error.message });
  if (error.code === '23503') return res.status(404).json({ error: 'Bien no encontrado' });
  if (error.code === '23514' || error.code === '22003') return res.status(400).json({ error: 'Los valores de depreciación no son válidos' });
  console.error('Error en depreciación:', error);
  return res.status(500).json({ error: 'No se pudo procesar la depreciación' });
};

export const getDepreciacion = async (req, res, sql) => {
  try {
    const depreciacion = await sql`SELECT * FROM depreciacion`;
    res.json(depreciacion);
  } catch (error) {
    respondError(res, error);
  }
};

export const getDepreciacionPorBien = async (req, res, sql) => {
  try {
    const bienId = validarBienId(req.params.bienId);
    const depreciacion = await sql`SELECT * FROM depreciacion WHERE bien_id = ${bienId}`;
    if (depreciacion.length === 0) {
      return res.status(404).json({ error: 'Depreciación no encontrada' });
    }
    if (depreciacion.length > 1) throw depreciationError(409, 'El bien tiene varias depreciaciones; concilie sus registros antes de continuar');
    res.json(depreciacion[0]);
  } catch (error) {
    respondError(res, error);
  }
};

export const crearDepreciacion = async (req, res, sql, now = new Date()) => {
  try {
    const bienId = validarBienId(req.body?.bienId);
    const valorInicial = validarValorInicial(req.body?.valorInicial);
    const porcentajeAnual = req.body?.porcentajeAnual === undefined ? 20 : validarPorcentajeAnual(req.body.porcentajeAnual);
    const year = anoLima(now);
    const depreciacion = await sql.begin(async (tx) => {
      const [asset] = await tx`
        SELECT id, EXTRACT(YEAR FROM fecha_adquisicion)::integer AS ano_adquisicion
        FROM bienes_informaticos WHERE id = ${bienId} FOR UPDATE
      `;
      if (!asset) throw depreciationError(404, 'Bien no encontrado');
      // La depreciación empieza en el año de adquisición del bien, no en el de su registro.
      const base = anoAdquisicion(asset, year);
      const valorActual = calcularDepreciacion(valorInicial, porcentajeAnual, year - base);
      const existing = await tx`SELECT id FROM depreciacion WHERE bien_id = ${bienId}`;
      if (existing.length) throw depreciationError(409, 'El bien ya tiene una depreciación registrada');
      const [created] = await tx`
        INSERT INTO depreciacion (bien_id, valor_inicial, porcentaje_anual, valor_actual, ano_base, ano_actual)
        VALUES (${bienId}, ${valorInicial}, ${porcentajeAnual}, ${valorActual}, ${base}, ${year}) RETURNING *
      `;
      return created;
    });
    res.status(201).json(depreciacion);
  } catch (error) {
    respondError(res, error);
  }
};

export const actualizarDepreciacion = async (req, res, sql, now = new Date()) => {
  try {
    const bienId = validarBienId(req.params.bienId);
    const year = anoLima(now);
    const result = await sql.begin(async (tx) => {
      const rows = await tx`SELECT * FROM depreciacion WHERE bien_id = ${bienId} ORDER BY id FOR UPDATE`;
      if (!rows.length) throw depreciationError(404, 'Depreciación no encontrada');
      if (rows.length > 1) throw depreciationError(409, 'El bien tiene varias depreciaciones; concilie sus registros antes de continuar');
      const current = rows[0];
      const [asset] = await tx`
        SELECT EXTRACT(YEAR FROM fecha_adquisicion)::integer AS ano_adquisicion
        FROM bienes_informaticos WHERE id = ${bienId}
      `;
      if (!asset) throw depreciationError(404, 'Bien no encontrado');
      if (anoAdquisicion(asset, year) !== Number(current.ano_base)) {
        throw depreciationError(409, 'El año base no coincide con la fecha de adquisición del bien; ejecute la conciliación de depreciación');
      }
      const value = calcularAlAno(current, year);
      const [updated] = await tx`
        UPDATE depreciacion SET valor_actual = ${value}, ano_actual = ${year}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${current.id} RETURNING *
      `;
      return updated;
    });
    res.json(result);
  } catch (error) {
    respondError(res, error);
  }
};
