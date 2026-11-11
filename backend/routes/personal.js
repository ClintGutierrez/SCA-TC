import express from 'express';
import * as personalController from '../controllers/personalController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getVinculos, saveVinculo } from '../controllers/vinculoLaboralController.js';
import { VINCULO_READ_ROLES, VINCULO_WRITE_ROLES } from '../utils/vinculoLaboral.js';

export const createPersonalRouter = (sql) => {
  const router = express.Router();
  // authenticate consulta la cuenta en cada solicitud y aplica el rol vigente.
  router.use(authenticate(sql));
  router.get('/', requireRole(...VINCULO_READ_ROLES), (req, res) => personalController.getPersonal(req, res, sql));
  router.get('/:id', requireRole(...VINCULO_READ_ROLES), (req, res) => personalController.getPersonalById(req, res, sql));
  router.get('/:id/vinculos', requireRole(...VINCULO_READ_ROLES), (req, res) => getVinculos(req, res, sql));
  router.post('/:id/vinculos', requireRole(...VINCULO_WRITE_ROLES), (req, res) => saveVinculo(req, res, sql));
  router.put('/:id/vinculos/:vinculoId', requireRole(...VINCULO_WRITE_ROLES), (req, res) => saveVinculo(req, res, sql));
  router.post('/', requireRole('administrador', 'jefatura'), (req, res) => personalController.createPersonal(req, res, sql));
  router.put('/:id', requireRole('administrador', 'jefatura'), (req, res) => personalController.updatePersonal(req, res, sql));
  router.delete('/:id', requireRole('administrador', 'jefatura'), (req, res) => personalController.disablePersonal(req, res, sql));
  return router;
};
