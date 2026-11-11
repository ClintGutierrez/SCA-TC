ALTER TABLE depreciacion ADD COLUMN IF NOT EXISTS ano_base INTEGER;

-- Recuperar el año de creación, nunca el año mutable del último cálculo.
-- No se recalculan ni se sobrescriben importes históricos en esta migración.
UPDATE depreciacion
SET ano_base = EXTRACT(YEAR FROM created_at)::INTEGER
WHERE ano_base IS NULL AND created_at IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_depreciacion_valores_validos'
      AND conrelid = 'depreciacion'::regclass
  ) THEN
    ALTER TABLE depreciacion ADD CONSTRAINT chk_depreciacion_valores_validos CHECK (
      ano_base IS NOT NULL AND ano_base BETWEEN 1 AND 9999
      AND ano_actual IS NOT NULL AND ano_actual BETWEEN ano_base AND 9999
      AND valor_inicial IS NOT NULL AND valor_inicial >= 0
      AND valor_inicial::text NOT IN ('NaN', 'Infinity', '-Infinity')
      AND porcentaje_anual IS NOT NULL AND porcentaje_anual BETWEEN 0 AND 100
      AND valor_actual IS NOT NULL AND valor_actual BETWEEN 0 AND valor_inicial
      AND valor_actual::text NOT IN ('NaN', 'Infinity', '-Infinity')
    ) NOT VALID;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION preservar_ano_base_depreciacion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.ano_base IS NOT NULL AND NEW.ano_base IS DISTINCT FROM OLD.ano_base THEN
    RAISE EXCEPTION 'El año base de depreciación no se puede modificar' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_depreciacion_ano_base ON depreciacion;
CREATE TRIGGER trg_depreciacion_ano_base
BEFORE UPDATE ON depreciacion
FOR EACH ROW EXECUTE FUNCTION preservar_ano_base_depreciacion();
