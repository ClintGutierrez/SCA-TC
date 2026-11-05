import express from 'express';
import multer from 'multer';
import * as migracionController from '../controllers/migracionInventarioController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 10 * 1024 * 1024 },
});

const uploadArchivo = (req, res, next) => upload.single('archivo')(req, res, (error) => {
  if (!error) return next();
  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({
      error: error.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo supera el límite de 10 MB.'
        : 'No se pudo recibir el archivo seleccionado.',
    });
  }
  return next(error);
});

export const createMigracionInventarioRouter = (sql) => {
  const router = express.Router();
  router.use(authenticateToken, requireRole('administrador'));

  router.get('/plantilla/:formato', migracionController.descargarPlantilla);
  router.post('/validar', uploadArchivo, (req, res) => migracionController.validarArchivo(req, res, sql));
  router.post('/confirmar', uploadArchivo, (req, res) => migracionController.confirmarImportacion(req, res, sql));

  return router;
};
