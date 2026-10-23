-- Migración segura para asignaciones: el personal es el responsable físico.
DO $migration$
BEGIN
  ALTER TABLE asignaciones ALTER COLUMN usuario_id DROP NOT NULL;
  ALTER TABLE asignaciones ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'activa';
  ALTER TABLE asignaciones ADD COLUMN IF NOT EXISTS personal_id INTEGER REFERENCES personal(id) ON DELETE RESTRICT;
  CREATE INDEX IF NOT EXISTS idx_asignaciones_personal ON asignaciones(personal_id);
  CREATE UNIQUE INDEX IF NOT EXISTS uq_asignaciones_bien_activa
    ON asignaciones (bien_id) WHERE fecha_devolucion IS NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_asignaciones_estado'
      AND conrelid = 'asignaciones'::regclass
  ) THEN
    ALTER TABLE asignaciones ADD CONSTRAINT chk_asignaciones_estado
      CHECK (estado IN ('activa', 'devuelta'));
  END IF;
END;
$migration$;
