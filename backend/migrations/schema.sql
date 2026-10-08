-- Tabla de Bienes Informáticos
CREATE TABLE IF NOT EXISTS bienes_informaticos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  tipo VARCHAR(100),
  marca VARCHAR(100),
  modelo VARCHAR(100),
  numero_serie VARCHAR(100),
  fecha_adquisicion DATE NOT NULL,
  costo DECIMAL(12, 2) NOT NULL,
  usuario_asignado VARCHAR(255),
  estado VARCHAR(50) DEFAULT 'activo',
  ubicacion VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE IF EXISTS bienes_informaticos
  ADD COLUMN IF NOT EXISTS imagen_url TEXT,
  ADD COLUMN IF NOT EXISTS codigo_patrimonial VARCHAR(100),
  ADD COLUMN IF NOT EXISTS direccion_mac VARCHAR(100),
  ADD COLUMN IF NOT EXISTS orden_compra VARCHAR(100),
  ADD COLUMN IF NOT EXISTS especificaciones JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS detalles JSONB,
  ADD COLUMN IF NOT EXISTS garantia_anios INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS bienes_informaticos_numero_serie_key
  ON bienes_informaticos (numero_serie);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bienes_codigo_patrimonial
  ON bienes_informaticos (codigo_patrimonial);

CREATE INDEX IF NOT EXISTS idx_bienes_especificaciones
  ON bienes_informaticos USING GIN (especificaciones);

-- Tabla de Mantenimiento y Repotenciación
CREATE TABLE IF NOT EXISTS mantenimiento (
  id SERIAL PRIMARY KEY,
  bien_id INTEGER NOT NULL REFERENCES bienes_informaticos(id) ON DELETE CASCADE,
  tipo VARCHAR(50),
  descripcion TEXT,
  fecha DATE NOT NULL,
  costo DECIMAL(12, 2),
  responsable VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  departamento VARCHAR(255),
  rol VARCHAR(50),
  password_hash TEXT,
  last_login TIMESTAMP,
  activo_login BOOLEAN DEFAULT TRUE,
  estado VARCHAR(50) DEFAULT 'activo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Directorio de personal de la institución (independiente de las cuentas de acceso)
CREATE TABLE IF NOT EXISTS personal (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(150) NOT NULL,
  dni VARCHAR(8) NOT NULL UNIQUE,
  correo_institucional VARCHAR(255) NOT NULL UNIQUE,
  numero_celular VARCHAR(20),
  regimen_laboral VARCHAR(100) NOT NULL,
  oficina VARCHAR(150),
  area VARCHAR(150),
  sede VARCHAR(150),
  piso VARCHAR(50),
  estado VARCHAR(20) NOT NULL DEFAULT 'activo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT personal_dni_formato CHECK (dni ~ '^[0-9]{8}$'),
 CONSTRAINT personal_estado_check CHECK (estado IN ('activo', 'inactivo')),
 CONSTRAINT personal_regimen_check CHECK (regimen_laboral IN ('Practicante', 'Locador de servicios', 'CAS', 'CAP', 'Personal de confianza', 'Servir')),
 CONSTRAINT personal_sede_check CHECK (sede IS NULL OR sede IN ('Centro de Lima', 'Sede Central', 'Centro de estudios constitucionales', 'Sede Arequipa'))
);

CREATE INDEX IF NOT EXISTS idx_personal_nombre
  ON personal (apellido, nombre);
CREATE INDEX IF NOT EXISTS idx_personal_ubicacion
  ON personal (sede, oficina, area);

CREATE TABLE IF NOT EXISTS configuracion_sistema (
  clave VARCHAR(100) PRIMARY KEY,
  valor JSONB NOT NULL DEFAULT '{}'::jsonb,
  actualizado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS catalogos_sistema (
  id SERIAL PRIMARY KEY,
  categoria VARCHAR(100) NOT NULL,
  valor VARCHAR(255) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  orden INTEGER NOT NULL DEFAULT 0,
  UNIQUE (categoria, valor)
);

CREATE INDEX IF NOT EXISTS idx_catalogos_categoria
  ON catalogos_sistema (categoria, activo, orden);

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'personal_regimen_check' AND conrelid = 'personal'::regclass
  ) THEN
    ALTER TABLE personal
      ADD CONSTRAINT personal_regimen_check
      CHECK (regimen_laboral IN ('Practicante', 'Locador de servicios', 'CAS', 'CAP', 'Personal de confianza', 'Servir'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'personal_sede_check' AND conrelid = 'personal'::regclass
  ) THEN
    ALTER TABLE personal
      ADD CONSTRAINT personal_sede_check
      CHECK (sede IS NULL OR sede IN ('Centro de Lima', 'Sede Central', 'Centro de estudios constitucionales', 'Sede Arequipa'));
  END IF;
END;
$migration$;

-- Tabla de sesiones de refresco JWT
CREATE TABLE IF NOT EXISTS auth_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);

-- Registro de acciones realizadas en el sistema
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  tabla_afectada TEXT NOT NULL,
  operacion TEXT,
  registro_id INTEGER,
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_usuario ON audit_log(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- Tabla de Depreciación
CREATE TABLE IF NOT EXISTS depreciacion (
  id SERIAL PRIMARY KEY,
  bien_id INTEGER NOT NULL REFERENCES bienes_informaticos(id) ON DELETE CASCADE,
  valor_inicial DECIMAL(12, 2),
  porcentaje_anual DECIMAL(5, 2) DEFAULT 20.0,
  valor_actual DECIMAL(12, 2),
  ano_actual INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Asignaciones
CREATE TABLE IF NOT EXISTS asignaciones (
  id SERIAL PRIMARY KEY,
  bien_id INTEGER NOT NULL REFERENCES bienes_informaticos(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha_asignacion DATE NOT NULL,
  fecha_devolucion DATE,
  observaciones TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE IF EXISTS asignaciones
  ADD COLUMN IF NOT EXISTS personal_id INTEGER REFERENCES personal(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_asignaciones_personal
  ON asignaciones(personal_id);

CREATE TABLE IF NOT EXISTS historial_ficha_tecnica (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bien_id INTEGER NOT NULL REFERENCES bienes_informaticos(id),
  datos_anteriores JSONB NOT NULL,
  modificado_por INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_historial_ficha_bien
  ON historial_ficha_tecnica (bien_id);

CREATE TABLE IF NOT EXISTS bajas (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bien_id INTEGER NOT NULL UNIQUE REFERENCES bienes_informaticos(id),
  motivo VARCHAR(255) NOT NULL,
  documento_sustentatorio VARCHAR(255),
  foto_frontal_url TEXT NOT NULL,
  foto_lateral_url TEXT NOT NULL,
  autorizado_por INTEGER NOT NULL REFERENCES usuarios(id),
  fecha_baja DATE NOT NULL DEFAULT CURRENT_DATE,
  observaciones TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE IF EXISTS bajas
  ADD COLUMN IF NOT EXISTS foto_frontal_url TEXT,
  ADD COLUMN IF NOT EXISTS foto_lateral_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bajas_bien_id ON bajas (bien_id);

CREATE TABLE IF NOT EXISTS vinculo_laboral (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  tipo_vinculo VARCHAR(50) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE,
  vigente BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT vinculo_laboral_tipo_vinculo_check
    CHECK (tipo_vinculo IN ('CAS', 'CAP', 'locador', 'practicante'))
);

CREATE INDEX IF NOT EXISTS idx_vinculo_laboral_usuario
  ON vinculo_laboral (usuario_id);

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_estado_valido'
      AND conrelid = 'bienes_informaticos'::regclass
  ) THEN
    ALTER TABLE bienes_informaticos
      ADD CONSTRAINT chk_estado_valido
      CHECK (estado IN ('activo', 'baja', 'mantenimiento', 'asignado'));
  END IF;
END;
$migration$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_bienes_estado ON bienes_informaticos(estado);
CREATE INDEX IF NOT EXISTS idx_bienes_usuario ON bienes_informaticos(usuario_asignado);
CREATE INDEX IF NOT EXISTS idx_mantenimiento_bien ON mantenimiento(bien_id);
CREATE INDEX IF NOT EXISTS idx_asignaciones_bien ON asignaciones(bien_id);
CREATE INDEX IF NOT EXISTS idx_asignaciones_usuario ON asignaciones(usuario_id);

CREATE OR REPLACE FUNCTION procesar_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  audit_user_id INTEGER;
BEGIN
  audit_user_id := NULLIF(current_setting('app.audit_user_id', TRUE), '')::INTEGER;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (usuario_id, tabla_afectada, operacion, registro_id, datos_nuevos)
    VALUES (audit_user_id, TG_TABLE_NAME, TG_OP, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (usuario_id, tabla_afectada, operacion, registro_id, datos_anteriores, datos_nuevos)
    VALUES (audit_user_id, TG_TABLE_NAME, TG_OP, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (usuario_id, tabla_afectada, operacion, registro_id, datos_anteriores)
    VALUES (audit_user_id, TG_TABLE_NAME, TG_OP, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION fn_guardar_historial_ficha_tecnica()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO historial_ficha_tecnica (bien_id, datos_anteriores, modificado_por)
  VALUES (
    OLD.id,
    to_jsonb(OLD),
    NULLIF(current_setting('app.audit_user_id', TRUE), '')::INTEGER
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION fn_procesar_baja()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE bienes_informaticos
  SET estado = 'baja', updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.bien_id;

  UPDATE asignaciones
  SET fecha_devolucion = NEW.fecha_baja
  WHERE bien_id = NEW.bien_id AND fecha_devolucion IS NULL;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_bienes ON bienes_informaticos;
CREATE TRIGGER trg_audit_bienes
AFTER INSERT OR UPDATE OR DELETE ON bienes_informaticos
FOR EACH ROW EXECUTE FUNCTION procesar_auditoria();

DROP TRIGGER IF EXISTS trg_historial_ficha_tecnica ON bienes_informaticos;
CREATE TRIGGER trg_historial_ficha_tecnica
BEFORE UPDATE ON bienes_informaticos
FOR EACH ROW EXECUTE FUNCTION fn_guardar_historial_ficha_tecnica();

DROP TRIGGER IF EXISTS trg_audit_asignaciones ON asignaciones;
CREATE TRIGGER trg_audit_asignaciones
AFTER INSERT OR UPDATE OR DELETE ON asignaciones
FOR EACH ROW EXECUTE FUNCTION procesar_auditoria();

DROP TRIGGER IF EXISTS trg_audit_mantenimiento ON mantenimiento;
CREATE TRIGGER trg_audit_mantenimiento
AFTER INSERT OR UPDATE OR DELETE ON mantenimiento
FOR EACH ROW EXECUTE FUNCTION procesar_auditoria();

DROP TRIGGER IF EXISTS trg_procesar_baja ON bajas;
CREATE TRIGGER trg_procesar_baja
AFTER INSERT ON bajas
FOR EACH ROW EXECUTE FUNCTION fn_procesar_baja();
