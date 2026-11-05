import express from 'express';
import * as controller from '../controllers/asignacionesController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const createAsignacionesRouter = (sql) => {
  const router = express.Router();
  router.use(authenticateToken);
  router.get('/', requireRole('administrador', 'jefatura', 'tecnico', 'auditor'), (req, res) => controller.listAsignaciones(req, res, sql));
  router.post('/', requireRole('administrador', 'jefatura'), (req, res) => controller.createAsignacion(req, res, sql));
  router.post('/:id/devolucion', requireRole('administrador', 'jefatura'), (req, res) => controller.returnAsignacion(req, res, sql));
  return router;
};
