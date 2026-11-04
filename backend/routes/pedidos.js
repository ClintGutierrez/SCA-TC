import express from 'express';
import * as pedidosController from '../controllers/pedidosController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const createPedidosRouter = (sql) => {
  const router = express.Router();
  router.use(authenticateToken);

  router.get('/', requireRole('almacen', 'administrador', 'jefatura', 'tecnico'), (req, res) => pedidosController.listar(req, res, sql));
  router.get('/next-number', requireRole('administrador'), (req, res) => pedidosController.siguienteNumero(req, res, sql));
  router.get('/:id', (req, res) => pedidosController.obtenerPorId(req, res, sql));
  router.post('/', requireRole('administrador'), (req, res) => pedidosController.crear(req, res, sql));
  router.delete('/:id', requireRole('administrador', 'jefatura'), (req, res) => pedidosController.cancelar(req, res, sql));
  router.put('/:id/llegada', requireRole('almacen'), (req, res) => pedidosController.registrarLlegada(req, res, sql));
  router.put('/:id/derivar', requireRole('jefatura'), (req, res) => pedidosController.derivar(req, res, sql));
  router.put('/:id/recepcionar', requireRole('tecnico'), (req, res) => pedidosController.recepcionar(req, res, sql));

  return router;
};
