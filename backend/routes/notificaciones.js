import express from 'express';
import * as notificacionesController from '../controllers/notificacionesController.js';
import { authenticateToken } from '../middleware/auth.js';

export const createNotificacionesRouter = (sql) => {
  const router = express.Router();
  router.use(authenticateToken);

  router.get('/count', (req, res) => notificacionesController.contarNoLeidas(req, res, sql));
  router.get('/', (req, res) => notificacionesController.listarMias(req, res, sql));
  router.put('/leer-todas', (req, res) => notificacionesController.marcarTodasLeidas(req, res, sql));
  router.put('/:id/leer', (req, res) => notificacionesController.marcarLeida(req, res, sql));

  return router;
};
