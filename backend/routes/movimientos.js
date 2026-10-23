import express from 'express';
import * as controller from '../controllers/movimientosController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const createMovimientosRouter = (sql) => {
  const router = express.Router();
  router.use(authenticateToken);
  router.get('/', requireRole('administrador', 'jefatura', 'tecnico', 'auditor'), (req, res) => controller.listMovimientos(req, res, sql));
  router.post('/', requireRole('administrador', 'jefatura'), (req, res) => controller.createMovimiento(req, res, sql));
  router.post('/:id/aprobacion', (req, res) => controller.approveMovimiento(req, res, sql));
  router.post('/:id/retorno', requireRole('administrador', 'jefatura'), (req, res) => controller.returnLoan(req, res, sql));
  router.get('/:id/documento', requireRole('administrador', 'jefatura', 'tecnico', 'auditor'), (req, res) => controller.documentMovimiento(req, res, sql));
  return router;
};
