import express from 'express';
import * as bienesController from '../controllers/bienesController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const createBienesRouter = (sql) => {
  const router = express.Router();

  router.use(authenticateToken);

  router.get('/', (req, res) => bienesController.getBienes(req, res, sql));
  router.get('/:id', (req, res) => bienesController.getBienById(req, res, sql));
  router.post('/', requireRole('administrador', 'jefatura'), (req, res) => bienesController.createBien(req, res, sql));
  router.put('/:id', requireRole('administrador', 'jefatura'), (req, res) => bienesController.updateBien(req, res, sql));
  router.delete('/:id', requireRole('administrador'), (req, res) => bienesController.deleteBien(req, res, sql));

  return router;
};
