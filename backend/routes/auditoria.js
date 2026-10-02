import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import * as auditoriaController from '../controllers/auditoriaController.js';

export const createAuditoriaRouter = (sql) => {
  const router = express.Router();

  router.use(authenticateToken, requireRole('administrador', 'auditor'));
  router.get('/', (req, res) => auditoriaController.getAuditoria(req, res, sql));

  return router;
};
