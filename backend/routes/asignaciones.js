import express from 'express';
import * as controller from '../controllers/asignacionesController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const createAsignacionesRouter = (sql) => {
  const router = express.Router();
  router.use(authenticateToken);
  router.get('/', requireRole('administrador', 'jefatura', 'tecnico', 'almacen', 'auditor'), (req, res) => controller.listAsignaciones(req, res, sql));
  router.post('/', requireRole('administrador', 'jefatura', 'almacen'), (req, res) => controller.createAsignacion(req, res, sql));
  router.post('/:id/reasignar', requireRole('administrador', 'jefatura', 'almacen'), (req, res) => controller.reasignarAsignacion(req, res, sql));
  router.post('/:id/devolucion', requireRole('administrador', 'jefatura', 'almacen'), (req, res) => controller.returnAsignacion(req, res, sql));
  return router;
};
