import express from 'express';
import * as reportesController from '../controllers/reportesController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

// Mismos roles que ven el módulo Reportes en el menú (solo lectura). Los reportes exponen costos
// y datos personales (DNI del reporte de asignaciones).
export const REPORTES_ROLES = ['administrador', 'jefatura', 'tecnico', 'auditor'];

export const createReportesRouter = (sql) => {
  const router = express.Router();

  router.use(authenticate(sql), requireRole(...REPORTES_ROLES));

  router.get('/inventario', (req, res) => reportesController.getReporteInventario(req, res, sql));
  router.get('/depreciacion', (req, res) => reportesController.getReporteDepreciacion(req, res, sql));
  router.get('/asignaciones', (req, res) => reportesController.getReporteAsignaciones(req, res, sql));
  router.get('/mantenimiento', (req, res) => reportesController.getReporteMantenimiento(req, res, sql));

  return router;
};
