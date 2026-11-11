-- La depreciación se calcula desde el año de adquisición del bien, no desde el año
-- en que se registró la depreciación. Esta migración concilia los registros existentes
-- y puede repetirse (por ejemplo, después de corregir la fecha de adquisición de un bien).

-- ano_base sigue protegido: solo puede cambiar dentro de una conciliación explícita,
-- que activa app.conciliar_ano_base únicamente durante su propia transacción.
CREATE OR REPLACE FUNCTION preservar_ano_base_depreciacion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.ano_base IS NOT NULL AND NEW.ano_base IS DISTINCT FROM OLD.ano_base
     AND current_setting('app.conciliar_ano_base', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'El año base de depreciación no se puede modificar' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

SELECT set_config('app.conciliar_ano_base', 'on', true);

-- Solo se concilian registros con datos válidos; los demás quedan para revisión manual.
-- El valor actual se recalcula al mismo ano_actual (o al año de adquisición si es posterior),
-- y cada cambio queda registrado en audit_log con los valores anteriores y nuevos.
WITH previos AS (
  SELECT d.id, d.bien_id, d.ano_base, d.ano_actual, d.valor_actual,
         EXTRACT(YEAR FROM b.fecha_adquisicion)::integer AS ano_adquisicion
  FROM depreciacion d
  JOIN bienes_informaticos b ON b.id = d.bien_id
  WHERE b.fecha_adquisicion IS NOT NULL
    AND d.ano_base IS DISTINCT FROM EXTRACT(YEAR FROM b.fecha_adquisicion)::integer
    AND EXTRACT(YEAR FROM b.fecha_adquisicion) <= EXTRACT(YEAR FROM NOW() AT TIME ZONE 'America/Lima')
    AND d.ano_actual IS NOT NULL
    AND d.ano_actual <= EXTRACT(YEAR FROM NOW() AT TIME ZONE 'America/Lima')
    AND d.valor_inicial IS NOT NULL AND d.valor_inicial >= 0
    AND d.valor_inicial::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND d.porcentaje_anual IS NOT NULL AND d.porcentaje_anual BETWEEN 0 AND 100
  FOR UPDATE OF d
),
cambios AS (
  UPDATE depreciacion d
  SET ano_base = p.ano_adquisicion,
      ano_actual = GREATEST(d.ano_actual, p.ano_adquisicion),
      -- Línea recta, igual que calcularDepreciacion en utils/depreciacion.js.
      valor_actual = GREATEST(0, d.valor_inicial - ROUND(
        d.valor_inicial * d.porcentaje_anual * (GREATEST(d.ano_actual, p.ano_adquisicion) - p.ano_adquisicion) / 100, 2)),
      updated_at = CURRENT_TIMESTAMP
  FROM previos p
  WHERE d.id = p.id
  RETURNING d.id, d.ano_base, d.ano_actual, d.valor_actual
)
INSERT INTO audit_log (usuario_id, tabla_afectada, operacion, registro_id, datos_anteriores, datos_nuevos)
SELECT NULL, 'depreciacion', 'CONCILIAR_ANO_ADQUISICION', p.id,
       jsonb_build_object('bien_id', p.bien_id, 'ano_base', p.ano_base, 'ano_actual', p.ano_actual, 'valor_actual', p.valor_actual),
       jsonb_build_object('bien_id', p.bien_id, 'ano_base', c.ano_base, 'ano_actual', c.ano_actual, 'valor_actual', c.valor_actual)
FROM previos p
JOIN cambios c ON c.id = p.id;

SELECT set_config('app.conciliar_ano_base', 'off', true);
