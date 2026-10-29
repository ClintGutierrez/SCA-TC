ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS es_ti BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE usuarios SET es_ti = TRUE WHERE rol IN ('jefatura', 'tecnico') AND es_ti = FALSE;

CREATE TABLE IF NOT EXISTS solicitudes_ti (
  id BIGSERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL,
  beneficiario_dni TEXT NOT NULL,
  equipo_clave TEXT NOT NULL,
  correo TEXT NOT NULL,
  datos JSONB NOT NULL,
  estado TEXT NOT NULL DEFAULT 'recibida' CHECK (estado IN ('recibida','asignada','en_atencion','atendida','cerrada','observada','rechazada')),
  asignado_a INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE SEQUENCE IF NOT EXISTS solicitudes_ti_codigo_seq;
CREATE INDEX IF NOT EXISTS idx_solicitudes_ti_bandeja ON solicitudes_ti(asignado_a, estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_ti_duplicados ON solicitudes_ti(beneficiario_dni, tipo, equipo_clave);

CREATE TABLE IF NOT EXISTS solicitudes_ti_respuestas (
  id BIGSERIAL PRIMARY KEY,
  solicitud_id BIGINT NOT NULL REFERENCES solicitudes_ti(id),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  acciones TEXT NOT NULL,
  comentario TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS solicitudes_ti_accesos (
  id BIGSERIAL PRIMARY KEY,
  solicitud_id BIGINT NOT NULL REFERENCES solicitudes_ti(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pedidos_ti (
  id BIGSERIAL PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  descripcion TEXT NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  solicitud_id BIGINT REFERENCES solicitudes_ti(id),
  estado TEXT NOT NULL DEFAULT 'solicitado' CHECK (estado IN ('solicitado','aprobado','en_almacen','recepcionado')),
  asignado_a INTEGER REFERENCES usuarios(id),
  creado_por INTEGER NOT NULL REFERENCES usuarios(id),
  llegada_at TIMESTAMPTZ,
  llegada_por INTEGER REFERENCES usuarios(id),
  observaciones TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS recepciones_ti (
  id BIGSERIAL PRIMARY KEY,
  pedido_id BIGINT NOT NULL UNIQUE REFERENCES pedidos_ti(id),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  fecha TIMESTAMPTZ NOT NULL,
  conformidad BOOLEAN NOT NULL,
  observaciones TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS pedidos_ti_bienes (
  pedido_id BIGINT NOT NULL REFERENCES pedidos_ti(id),
  bien_id INTEGER NOT NULL UNIQUE REFERENCES bienes_informaticos(id),
  vinculado_por INTEGER NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(pedido_id,bien_id)
);

-- Los documentos se guardan privados y atómicamente con su trámite.
CREATE TABLE IF NOT EXISTS documentos_ti (
  id BIGSERIAL PRIMARY KEY,
  solicitud_id BIGINT NOT NULL REFERENCES solicitudes_ti(id),
  respuesta_id BIGINT REFERENCES solicitudes_ti_respuestas(id),
  nombre TEXT NOT NULL,
  mime TEXT NOT NULL,
  tamano INTEGER NOT NULL CHECK (tamano > 0 AND tamano <= 10485760),
  contenido BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documentos_ti_solicitud ON documentos_ti(solicitud_id);
CREATE TABLE IF NOT EXISTS eventos_ti (
  id BIGSERIAL PRIMARY KEY,
  entidad TEXT NOT NULL CHECK (entidad IN ('solicitud','pedido','acceso')),
  entidad_id BIGINT,
  usuario_id INTEGER REFERENCES usuarios(id),
  accion TEXT NOT NULL,
  comentario TEXT NOT NULL DEFAULT '',
  datos JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eventos_ti_entidad ON eventos_ti(entidad, entidad_id, id);
CREATE TABLE IF NOT EXISTS notificaciones_ti (
  id BIGSERIAL PRIMARY KEY,
  evento_clave TEXT NOT NULL UNIQUE,
  usuario_id INTEGER REFERENCES usuarios(id),
  destinatario TEXT,
  asunto TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  entidad TEXT NOT NULL,
  entidad_id BIGINT NOT NULL,
  leida_at TIMESTAMPTZ,
  enviada_at TIMESTAMPTZ,
  intentos INTEGER NOT NULL DEFAULT 0,
  proximo_intento TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notificaciones_ti_bandeja ON notificaciones_ti(usuario_id, leida_at);
CREATE INDEX IF NOT EXISTS idx_notificaciones_ti_envio ON notificaciones_ti(proximo_intento) WHERE enviada_at IS NULL;

-- El acceso a los trámites y archivos pasa por la API autenticada del backend.
-- Sin políticas públicas: la API de datos de Supabase no expone estas tablas.
ALTER TABLE solicitudes_ti ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_ti_respuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_ti_accesos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_ti ENABLE ROW LEVEL SECURITY;
ALTER TABLE recepciones_ti ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_ti_bienes ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_ti ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_ti ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones_ti ENABLE ROW LEVEL SECURITY;
