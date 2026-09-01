import express from 'express';
import * as usuariosController from '../controllers/usuariosController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const createUsuariosRouter = (sql) => {
  const router = express.Router();

  router.use(authenticateToken);

  router.get('/', requireRole('administrador', 'jefatura'), (req, res) => usuariosController.getUsuarios(req, res, sql));
  router.get('/:id', requireRole('administrador', 'jefatura'), (req, res) => usuariosController.getUsuarioById(req, res, sql));
  router.post('/', requireRole('administrador'), (req, res) => usuariosController.createUsuario(req, res, sql));
  router.put('/:id', requireRole('administrador'), (req, res) => usuariosController.updateUsuario(req, res, sql));
  router.delete('/:id', requireRole('administrador'), (req, res) => usuariosController.disableUsuario(req, res, sql));

  return router;
};
