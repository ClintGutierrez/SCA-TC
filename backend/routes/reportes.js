import express from 'express';
import * as reportesController from '../controllers/reportesController.js';
import { authenticateToken } from '../middleware/auth.js';

export const createReportesRouter = (sql) => {
  const router = express.Router();

  router.use(authenticateToken);

  router.get('/inventario', (req, res) => reportesController.getReporteInventario(req, res, sql));
  router.get('/depreciacion', (req, res) => reportesController.getReporteDepreciacion(req, res, sql));
  router.get('/asignaciones', (req, res) => reportesController.getReporteAsignaciones(req, res, sql));
  router.get('/mantenimiento', (req, res) => reportesController.getReporteMantenimiento(req, res, sql));

  return router;
};
