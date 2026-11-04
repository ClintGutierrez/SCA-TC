import express from 'express';
import * as mantenimientoController from '../controllers/mantenimientoController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const createMantenimientoRouter = (sql) => {
  const router = express.Router();

  router.use(authenticateToken);

  router.get('/', (req, res) => mantenimientoController.getMantenimiento(req, res, sql));
  router.get('/bien/:bienId', (req, res) => mantenimientoController.getMantenimientoPorBien(req, res, sql));
  router.post('/', requireRole('administrador', 'jefatura', 'tecnico'), (req, res) => mantenimientoController.createMantenimiento(req, res, sql));
  router.delete('/:id', requireRole('administrador', 'jefatura'), (req, res) => mantenimientoController.deleteMantenimiento(req, res, sql));

  return router;
};
