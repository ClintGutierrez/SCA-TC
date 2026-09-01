-- Tabla de Bienes Informáticos
CREATE TABLE IF NOT EXISTS bienes_informaticos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  tipo VARCHAR(100),
  marca VARCHAR(100),
  modelo VARCHAR(100),
  numero_serie VARCHAR(100) UNIQUE,
  fecha_adquisicion DATE NOT NULL,
  costo DECIMAL(12, 2) NOT NULL,
  usuario_asignado VARCHAR(255),
  estado VARCHAR(50) DEFAULT 'activo',
  ubicacion VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- Índices
CREATE INDEX IF NOT EXISTS idx_bienes_estado ON bienes_informaticos(estado);
CREATE INDEX IF NOT EXISTS idx_bienes_usuario ON bienes_informaticos(usuario_asignado);
CREATE INDEX IF NOT EXISTS idx_mantenimiento_bien ON mantenimiento(bien_id);
CREATE INDEX IF NOT EXISTS idx_asignaciones_bien ON asignaciones(bien_id);
CREATE INDEX IF NOT EXISTS idx_asignaciones_usuario ON asignaciones(usuario_id);
