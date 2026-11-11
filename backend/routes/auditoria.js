import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as auditoriaController from '../controllers/auditoriaController.js';

export const createAuditoriaRouter = (sql) => {
  const router = express.Router();

  router.use(authenticate(sql), requireRole('administrador', 'auditor'));
  router.get('/', (req, res) => auditoriaController.getAuditoria(req, res, sql));

  return router;
};
