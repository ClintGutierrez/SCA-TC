import express from 'express';
import * as reportesController from '../controllers/reportesController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const createReportesRouter = (sql) => {
  const router = express.Router();

  // Verifica que el token sea válido
  router.use(authenticateToken);
  
  // Protege todas las rutas de reportes para los roles autorizados, incluyendo al nuevo auditor
  router.use(requireRole('administrador', 'jefatura', 'tecnico', 'auditor'));

  router.get('/inventario', (req, res) => reportesController.getReporteInventario(req, res, sql));
  router.get('/depreciacion', (req, res) => reportesController.getReporteDepreciacion(req, res, sql));
  router.get('/asignaciones', (req, res) => reportesController.getReporteAsignaciones(req, res, sql));
  router.get('/mantenimiento', (req, res) => reportesController.getReporteMantenimiento(req, res, sql));

  return router;
};