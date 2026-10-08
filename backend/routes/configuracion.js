import express from 'express';
import * as configuracionController from '../controllers/configuracionController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const createConfiguracionRouter = (sql) => {
  const router = express.Router();
  router.use(authenticateToken, requireRole('administrador'));
  router.get('/', (req, res) => configuracionController.getConfiguracion(req, res, sql));
  router.put('/', (req, res) => configuracionController.saveConfiguracion(req, res, sql));
  return router;
};
