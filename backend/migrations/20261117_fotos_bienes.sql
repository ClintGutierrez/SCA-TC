CREATE TABLE IF NOT EXISTS fotos_bienes (
  id UUID PRIMARY KEY,
  bien_id INTEGER NOT NULL REFERENCES bienes_informaticos(id) ON DELETE CASCADE,
  mime TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  contenido BYTEA NOT NULL CHECK (octet_length(contenido) BETWEEN 1 AND 5242880)
);

CREATE INDEX IF NOT EXISTS idx_fotos_bienes_bien ON fotos_bienes(bien_id);
ALTER TABLE fotos_bienes ENABLE ROW LEVEL SECURITY;
