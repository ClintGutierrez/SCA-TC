import express from 'express';
import * as personalController from '../controllers/personalController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const createPersonalRouter = (sql) => {
  const router = express.Router();
  router.use(authenticateToken);
  router.get('/', requireRole('administrador', 'jefatura', 'auditor'), (req, res) => personalController.getPersonal(req, res, sql));
  router.get('/:id', requireRole('administrador', 'jefatura', 'auditor'), (req, res) => personalController.getPersonalById(req, res, sql));
  router.post('/', requireRole('administrador', 'jefatura'), (req, res) => personalController.createPersonal(req, res, sql));
  router.put('/:id', requireRole('administrador', 'jefatura'), (req, res) => personalController.updatePersonal(req, res, sql));
  router.delete('/:id', requireRole('administrador', 'jefatura'), (req, res) => personalController.disablePersonal(req, res, sql));
  return router;
};
