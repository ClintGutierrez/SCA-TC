CREATE TABLE IF NOT EXISTS registros_bienes (
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  registro_id UUID NOT NULL,
  bien_id INTEGER UNIQUE REFERENCES bienes_informaticos(id) ON DELETE SET NULL,
  huella CHAR(64) NOT NULL,
  PRIMARY KEY (usuario_id, registro_id)
);

ALTER TABLE registros_bienes ENABLE ROW LEVEL SECURITY;
