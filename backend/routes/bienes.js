import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import * as bienesController from '../controllers/bienesController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validarParamId } from '../utils/ids.js';

const uploadFoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 + 1, files: 1, fields: 1, fieldSize: 1024 * 1024 },
}).single('foto');

const errorFoto = (res, message) => res.status(400).json({
  error: 'No se pudo adjuntar la foto', campos: { foto: message },
});

const formatosFoto = new Map([['image/jpeg', 'jpeg'], ['image/png', 'png'], ['image/webp', 'webp']]);
const cierrePng = Buffer.from('0000000049454e44ae426082', 'hex');

const fotoValida = async ({ buffer, mimetype }) => {
  const formato = formatosFoto.get(mimetype);
  if (!formato) return false;
  // El decodificador de PNG puede leer todos los píxeles aunque falte el bloque final IEND.
  if (formato === 'png' && !buffer.subarray(-cierrePng.length).equals(cierrePng)) return false;
  try {
    const imagen = sharp(buffer, { failOn: 'warning', limitInputPixels: 64_000_000, animated: true });
    const metadata = await imagen.metadata();
    if (metadata.format !== formato) return false;
    await imagen.stats();
    return true;
  } catch {
    return false;
  }
};

const parseBien = (req, res, next) => {
  if (!req.is('multipart/form-data')) return next();
  return uploadFoto(req, res, async (error) => {
    if (error) {
      return errorFoto(res, error.code === 'LIMIT_FILE_SIZE' ? 'La foto supera el límite de 5 MB.' : 'Selecciona una sola foto e inténtalo de nuevo.');
    }
    try {
      const datos = JSON.parse(req.body.datos);
      if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw new Error();
      req.body = datos;
    } catch {
      return res.status(400).json({ error: 'Los datos del bien no tienen el formato esperado.' });
    }
    if (req.file && !(await fotoValida(req.file))) {
      return errorFoto(res, 'Selecciona una imagen JPG, PNG o WebP válida de hasta 64 megapíxeles.');
    }
    return next();
  });
};

export const createBienesRouter = (sql) => {
  const router = express.Router();

  router.use(authenticate(sql));
  router.param('id', validarParamId);

  router.get('/', (req, res) => bienesController.getBienes(req, res, sql));
  router.get('/fotos/:fotoId', (req, res) => bienesController.getFotoBien(req, res, sql));
  router.get('/registros/:registroId', requireRole('administrador', 'jefatura'), (req, res) => bienesController.getRegistroBien(req, res, sql));
  router.get('/preferencias-alta', requireRole('administrador', 'jefatura'), (req, res) => bienesController.getPreferenciasAlta(req, res, sql));
  router.get('/:id', (req, res) => bienesController.getBienById(req, res, sql));
  router.post('/', requireRole('administrador', 'jefatura'), parseBien, (req, res) => bienesController.createBien(req, res, sql));
  router.put('/:id', requireRole('administrador', 'jefatura'), parseBien, (req, res) => bienesController.updateBien(req, res, sql));
  router.get('/:id/historial', requireRole('administrador', 'jefatura', 'tecnico', 'auditor'), (req, res) => bienesController.getHistorialBien(req, res, sql));
  router.delete('/:id', requireRole('administrador'), (req, res) => bienesController.deleteBien(req, res, sql));

  return router;
};
