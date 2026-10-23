import express from 'express';
import multer from 'multer';
import * as bajasController from '../controllers/bajasController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 3, fileSize: 15 * 1024 * 1024 },
});

export const createBajasRouter = (sql) => {
  const router = express.Router();
  router.use(authenticateToken);
  router.get('/', requireRole('administrador', 'jefatura', 'auditor'), (req, res) => bajasController.getBajas(req, res, sql));
  router.post(
    '/:bienId',
    requireRole('administrador', 'jefatura'),
    upload.fields([
      { name: 'fotoFrontal', maxCount: 1 },
      { name: 'fotoLateral', maxCount: 1 },
      { name: 'documentoSustentatorio', maxCount: 1 },
    ]),
    (req, res) => bajasController.createBaja(req, res, sql),
  );
  return router;
};
