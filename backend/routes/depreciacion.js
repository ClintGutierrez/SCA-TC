import express from 'express';
import * as depreciacionController from '../controllers/depreciacionController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

export const createDepreciacionRouter = (sql) => {
  const router = express.Router();

  router.use(authenticate(sql));

  router.get('/', (req, res) => depreciacionController.getDepreciacion(req, res, sql));
  router.get('/:bienId', (req, res) => depreciacionController.getDepreciacionPorBien(req, res, sql));
  router.post('/', requireRole('administrador', 'jefatura'), (req, res) => depreciacionController.crearDepreciacion(req, res, sql));
  router.put('/:bienId', requireRole('administrador', 'jefatura'), (req, res) => depreciacionController.actualizarDepreciacion(req, res, sql));

  return router;
};
