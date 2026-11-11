-- NOT VALID conserva los registros anteriores para su conciliación.
-- Las inserciones y actualizaciones nuevas sí deben cumplir la restricción.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_bienes_costo_valido'
      AND conrelid = 'bienes_informaticos'::regclass
  ) THEN
    ALTER TABLE bienes_informaticos ADD CONSTRAINT chk_bienes_costo_valido
      CHECK (costo >= 0 AND costo::text NOT IN ('NaN', 'Infinity', '-Infinity')) NOT VALID;
  END IF;
END;
$$;
