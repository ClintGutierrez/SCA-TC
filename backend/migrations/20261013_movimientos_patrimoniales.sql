ALTER TABLE IF EXISTS personal
  ADD COLUMN IF NOT EXISTS jefe_inmediato INTEGER REFERENCES personal(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS correo_jefe VARCHAR(255);

CREATE TABLE IF NOT EXISTS movimientos_patrimoniales (
  id BIGSERIAL PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('asignacion', 'cambio', 'retiro', 'prestamo')),
  bien_id INTEGER NOT NULL REFERENCES bienes_informaticos(id) ON DELETE RESTRICT,
  bien_reemplazo_id INTEGER REFERENCES bienes_informaticos(id) ON DELETE RESTRICT,
  personal_id INTEGER REFERENCES personal(id) ON DELETE RESTRICT,
  personal_destino_id INTEGER REFERENCES personal(id) ON DELETE RESTRICT,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'ejecutado')),
  fecha_movimiento DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin DATE,
  fecha_retorno DATE,
  motivo TEXT,
  observaciones TEXT,
  creado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  aprobado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  aprobado_at TIMESTAMP,
  datos JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE movimientos_patrimoniales
  ADD COLUMN IF NOT EXISTS bien_reemplazo_id INTEGER REFERENCES bienes_informaticos(id) ON DELETE RESTRICT;
ALTER TABLE movimientos_patrimoniales ADD COLUMN IF NOT EXISTS fecha_retorno DATE;
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo_estado ON movimientos_patrimoniales(tipo, estado);
CREATE INDEX IF NOT EXISTS idx_movimientos_bien ON movimientos_patrimoniales(bien_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_personal ON movimientos_patrimoniales(personal_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_movimientos_bien_pendiente
  ON movimientos_patrimoniales (bien_id) WHERE estado = 'pendiente';
CREATE UNIQUE INDEX IF NOT EXISTS uq_movimientos_reemplazo_pendiente
  ON movimientos_patrimoniales (bien_reemplazo_id)
  WHERE estado = 'pendiente' AND bien_reemplazo_id IS NOT NULL;
