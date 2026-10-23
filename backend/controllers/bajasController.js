import crypto from 'node:crypto';
import { createEvidenceUrl, removeEvidence, uploadEvidence } from '../utils/supabaseStorage.js';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_DOCUMENT_SIZE = 15 * 1024 * 1024;

const validateFile = (file, label, allowedTypes, maxSize) => {
  if (!file) return `${label} es obligatorio`;
  if (!allowedTypes.has(file.mimetype)) return `${label} debe ser JPG, PNG o WEBP`;
  if (file.size > maxSize) return `${label} supera el tamaño máximo permitido`;
  return null;
};

export const createBaja = async (req, res, sql) => {
  const frontalError = validateFile(req.files?.fotoFrontal?.[0], 'La foto frontal', ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE);
  const lateralError = validateFile(req.files?.fotoLateral?.[0], 'La foto lateral', ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE);
  const document = req.files?.documentoSustentatorio?.[0];
  const documentError = document
    ? validateFile(
      document,
      'El documento sustentatorio',
      new Set(['application/pdf', 'image/jpeg', 'image/png']),
      MAX_DOCUMENT_SIZE,
    )
    : null;

  if (frontalError || lateralError || documentError || !String(req.body.motivo || '').trim()) {
    return res.status(400).json({
      error: 'Complete los datos y adjunte las evidencias requeridas',
      campos: {
        ...(frontalError ? { fotoFrontal: frontalError } : {}),
        ...(lateralError ? { fotoLateral: lateralError } : {}),
        ...(documentError ? { documentoSustentatorio: documentError } : {}),
        ...(!String(req.body.motivo || '').trim() ? { motivo: 'El motivo de baja es obligatorio' } : {}),
      },
    });
  }

  const bienId = Number(req.params.bienId);
  if (!Number.isInteger(bienId) || bienId <= 0) {
    return res.status(400).json({ error: 'El bien seleccionado no es válido' });
  }

  const frontal = req.files.fotoFrontal[0];
  const lateral = req.files.fotoLateral[0];
  const prefix = `bajas/${bienId}/${Date.now()}-${crypto.randomUUID()}`;
  const paths = {
    frontal: `${prefix}-frontal`,
    lateral: `${prefix}-lateral`,
    document: `${prefix}-sustento`,
  };

  try {
    const result = await sql.begin(async (tx) => {
      await tx`SELECT id FROM bienes_informaticos WHERE id = ${bienId} AND estado <> 'baja' FOR UPDATE`;
      const bien = await tx`SELECT id, estado FROM bienes_informaticos WHERE id = ${bienId} FOR UPDATE`;
      if (!bien.length) return { status: 404, error: 'El bien no existe o ya está dado de baja' };

      const existing = await tx`SELECT id FROM bajas WHERE bien_id = ${bienId}`;
      if (existing.length) return { status: 409, error: 'El bien ya tiene una baja registrada' };

      await uploadEvidence({ file: frontal, path: paths.frontal });
      await uploadEvidence({ file: lateral, path: paths.lateral });
      if (document) await uploadEvidence({ file: document, path: paths.document });

      await tx`
        INSERT INTO bajas (
          bien_id, motivo, documento_sustentatorio, foto_frontal_url,
          foto_lateral_url, autorizado_por, observaciones
        )
        VALUES (
          ${bienId}, ${String(req.body.motivo).trim()}, ${document ? paths.document : null},
          ${paths.frontal}, ${paths.lateral}, ${req.user.id},
          ${String(req.body.observaciones || '').trim() || null}
        )
      `;

      return { status: 201 };
    });

    if (result.status !== 201) return res.status(result.status).json({ error: result.error });
    res.status(201).json({ message: 'Baja registrada correctamente' });
  } catch (error) {
    try {
      await removeEvidence(Object.values(paths));
    } catch (cleanupError) {
      console.error('No se pudieron limpiar todas las evidencias de baja:', cleanupError);
    }
    console.error('Error al registrar baja:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getBajas = async (req, res, sql) => {
  try {
    const bajas = await sql`
      SELECT b.*, bi.codigo_patrimonial, bi.numero_serie, bi.nombre AS bien_nombre,
             u.nombre AS autorizado_por_nombre
      FROM bajas b
      JOIN bienes_informaticos bi ON bi.id = b.bien_id
      LEFT JOIN usuarios u ON u.id = b.autorizado_por
      ORDER BY b.fecha_baja DESC, b.created_at DESC
    `;
    const withUrls = await Promise.all(bajas.map(async (baja) => ({
      ...baja,
      foto_frontal_url: await createEvidenceUrl(baja.foto_frontal_url),
      foto_lateral_url: await createEvidenceUrl(baja.foto_lateral_url),
      documento_sustentatorio: await createEvidenceUrl(baja.documento_sustentatorio),
    })));
    res.json(withUrls);
  } catch (error) {
    console.error('Error al consultar bajas:', error);
    res.status(500).json({ error: error.message });
  }
};
