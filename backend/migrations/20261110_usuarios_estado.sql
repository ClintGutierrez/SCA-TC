-- usuarios.estado solo admite 'activo' o 'inactivo', y estado y activo_login no admiten NULL.
-- Así el login, el refresh y el middleware aplican la misma regla (cuentaHabilitada) sin casos ambiguos.
-- Los NULL se normalizan a los valores por defecto ('activo' y TRUE), que es como el login ya los trataba.
-- Si hubiera otros valores de estado, la restricción se crea NOT VALID para no bloquear la migración:
-- esas cuentas siguen sin acceso y deben revisarse; las escrituras nuevas sí deben cumplirla.
-- Puede repetirse sin efectos adicionales.

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo_login BOOLEAN DEFAULT TRUE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS estado VARCHAR(50) DEFAULT 'activo';

UPDATE usuarios SET estado = 'activo' WHERE estado IS NULL;
UPDATE usuarios SET activo_login = TRUE WHERE activo_login IS NULL;

ALTER TABLE usuarios ALTER COLUMN estado SET DEFAULT 'activo';
ALTER TABLE usuarios ALTER COLUMN estado SET NOT NULL;
ALTER TABLE usuarios ALTER COLUMN activo_login SET DEFAULT TRUE;
ALTER TABLE usuarios ALTER COLUMN activo_login SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_usuarios_estado' AND conrelid = 'usuarios'::regclass
  ) THEN
    ALTER TABLE usuarios ADD CONSTRAINT chk_usuarios_estado CHECK (estado IN ('activo', 'inactivo')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE estado NOT IN ('activo', 'inactivo')) THEN
    ALTER TABLE usuarios VALIDATE CONSTRAINT chk_usuarios_estado;
  END IF;
END;
$$;
