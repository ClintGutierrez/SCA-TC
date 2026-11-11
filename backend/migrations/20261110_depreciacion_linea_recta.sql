-- Cambia el método de depreciación de saldo decreciente a línea recta:
-- cada año se deprecia el mismo porcentaje del valor inicial hasta llegar a cero.
--   valor_actual = MAX(0, valor_inicial - ROUND(valor_inicial * porcentaje_anual * años / 100, 2))
-- Es la misma fórmula que calcularDepreciacion en utils/depreciacion.js.
-- Recalcula cada registro válido a su ano_actual y audita los importes que cambian.
-- Puede repetirse: los registros ya calculados con línea recta no se modifican.

WITH previos AS (
  SELECT d.id, d.bien_id, d.valor_actual,
         GREATEST(0, d.valor_inicial - ROUND(d.valor_inicial * d.porcentaje_anual * (d.ano_actual - d.ano_base) / 100, 2)) AS nuevo_valor
  FROM depreciacion d
  WHERE d.ano_base IS NOT NULL AND d.ano_actual IS NOT NULL AND d.ano_actual >= d.ano_base
    AND d.valor_inicial IS NOT NULL AND d.valor_inicial >= 0
    AND d.valor_inicial::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND d.porcentaje_anual IS NOT NULL AND d.porcentaje_anual BETWEEN 0 AND 100
  FOR UPDATE OF d
),
cambios AS (
  UPDATE depreciacion d
  SET valor_actual = p.nuevo_valor, updated_at = CURRENT_TIMESTAMP
  FROM previos p
  WHERE d.id = p.id AND d.valor_actual IS DISTINCT FROM p.nuevo_valor
  RETURNING d.id, d.valor_actual
)
INSERT INTO audit_log (usuario_id, tabla_afectada, operacion, registro_id, datos_anteriores, datos_nuevos)
SELECT NULL, 'depreciacion', 'RECALCULAR_LINEA_RECTA', p.id,
       jsonb_build_object('bien_id', p.bien_id, 'valor_actual', p.valor_actual, 'metodo', 'saldo_decreciente'),
       jsonb_build_object('bien_id', p.bien_id, 'valor_actual', c.valor_actual, 'metodo', 'linea_recta')
FROM previos p
JOIN cambios c ON c.id = p.id;
