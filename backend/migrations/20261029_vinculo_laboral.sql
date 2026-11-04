-- CUS12. Conserva los vínculos antiguos asociados a cuentas sin inventar su trabajador o sus fechas.
ALTER TABLE personal ADD COLUMN IF NOT EXISTS cargo VARCHAR(150);
ALTER TABLE vinculo_laboral ALTER COLUMN usuario_id DROP NOT NULL;
ALTER TABLE vinculo_laboral
  ADD COLUMN IF NOT EXISTS personal_id INTEGER REFERENCES personal(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS observaciones TEXT,
  ADD COLUMN IF NOT EXISTS motivo_cambio TEXT,
  ADD COLUMN IF NOT EXISTS creado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actualizado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE vinculo_laboral DROP CONSTRAINT IF EXISTS vinculo_laboral_tipo_vinculo_check;
UPDATE vinculo_laboral SET tipo_vinculo = CASE tipo_vinculo
  WHEN 'locador' THEN 'Locador de servicios' WHEN 'practicante' THEN 'Practicante' ELSE tipo_vinculo END
WHERE tipo_vinculo IN ('locador', 'practicante');
ALTER TABLE vinculo_laboral ADD CONSTRAINT vinculo_laboral_tipo_vinculo_check
  CHECK (tipo_vinculo IN ('CAS', 'CAP', 'Locador de servicios', 'Practicante', 'Personal de confianza', 'Servir')) NOT VALID;

DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='vinculo_laboral_fechas_check' AND conrelid='vinculo_laboral'::regclass) THEN
    ALTER TABLE vinculo_laboral ADD CONSTRAINT vinculo_laboral_fechas_check CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio) NOT VALID;
    ALTER TABLE vinculo_laboral ADD CONSTRAINT vinculo_laboral_persona_check CHECK (personal_id IS NOT NULL OR usuario_id IS NOT NULL) NOT VALID;
  END IF;
END;
$migration$;
CREATE INDEX IF NOT EXISTS idx_vinculo_laboral_personal ON vinculo_laboral(personal_id, fecha_inicio DESC);

ALTER TABLE asignaciones ADD COLUMN IF NOT EXISTS vinculo_laboral_id INTEGER REFERENCES vinculo_laboral(id) ON DELETE RESTRICT;
ALTER TABLE movimientos_patrimoniales ADD COLUMN IF NOT EXISTS vinculo_laboral_id INTEGER REFERENCES vinculo_laboral(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS historial_vinculo_laboral (
  id BIGSERIAL PRIMARY KEY,
  vinculo_id INTEGER NOT NULL REFERENCES vinculo_laboral(id) ON DELETE RESTRICT,
  personal_id INTEGER NOT NULL REFERENCES personal(id) ON DELETE RESTRICT,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  operacion VARCHAR(10) NOT NULL,
  motivo TEXT NOT NULL,
  datos_anteriores JSONB,
  datos_nuevos JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_historial_vinculo_personal ON historial_vinculo_laboral(personal_id, id DESC);

CREATE OR REPLACE FUNCTION guardar_historial_vinculo()
RETURNS TRIGGER LANGUAGE plpgsql AS $function$
DECLARE actor INTEGER;
BEGIN
  IF NEW.personal_id IS NULL THEN RETURN NEW; END IF;
  actor := NULLIF(current_setting('app.audit_user_id', TRUE), '')::INTEGER;
  IF actor IS NULL THEN RAISE EXCEPTION 'El cambio de vínculo requiere un usuario de auditoría'; END IF;
  INSERT INTO historial_vinculo_laboral(vinculo_id, personal_id, usuario_id, operacion, motivo, datos_anteriores, datos_nuevos)
  VALUES (NEW.id, NEW.personal_id, actor, TG_OP, COALESCE(NEW.motivo_cambio, 'Registro de vínculo laboral'),
    CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END, to_jsonb(NEW));
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_historial_vinculo ON vinculo_laboral;
CREATE TRIGGER trg_historial_vinculo AFTER INSERT OR UPDATE ON vinculo_laboral FOR EACH ROW EXECUTE FUNCTION guardar_historial_vinculo();
DROP TRIGGER IF EXISTS trg_audit_vinculo ON vinculo_laboral;
CREATE TRIGGER trg_audit_vinculo AFTER INSERT OR UPDATE OR DELETE ON vinculo_laboral FOR EACH ROW EXECUTE FUNCTION procesar_auditoria();
DROP TRIGGER IF EXISTS trg_audit_personal ON personal;
CREATE TRIGGER trg_audit_personal AFTER INSERT OR UPDATE OR DELETE ON personal FOR EACH ROW EXECUTE FUNCTION procesar_auditoria();
