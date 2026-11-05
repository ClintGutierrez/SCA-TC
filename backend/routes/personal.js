import express from 'express';
import * as personalController from '../controllers/personalController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { getVinculos, saveVinculo } from '../controllers/vinculoLaboralController.js';
import { VINCULO_READ_ROLES, VINCULO_WRITE_ROLES } from '../utils/vinculoLaboral.js';

export const createPersonalRouter = (sql) => {
  const router = express.Router();
  router.use(authenticateToken);
  router.use(async (req, res, next) => {
    try {
      const [user] = await sql`SELECT id, rol, estado, activo_login FROM usuarios WHERE id=${req.user.sub}`;
      if (!user || user.estado !== 'activo' || !user.activo_login) return res.status(403).json({ error: 'La cuenta está deshabilitada' });
      req.user.rol = user.rol;
      return next();
    } catch (error) { return next(error); }
  });
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
