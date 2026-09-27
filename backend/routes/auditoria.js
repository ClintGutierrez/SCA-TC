import express from 'express';
import * as auditoriaController from '../controllers/auditoriaController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const createAuditoriaRouter = (sql) => {
  const router = express.Router();

  router.use(authenticateToken);
  router.get('/', requireRole('administrador', 'auditor'), (req, res) => auditoriaController.getAuditoria(req, res, sql));

  return router;
};