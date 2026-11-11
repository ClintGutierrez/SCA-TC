import express from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intenta de nuevo más tarde.' },
});

// El perfil puede verificar la contraseña actual: se limita para evitar fuerza bruta con un token robado.
const profileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intenta de nuevo más tarde.' },
});

export const createAuthRouter = (sql) => {
  const router = express.Router();

  router.post('/login', loginLimiter, (req, res) => authController.login(req, res, sql));
  router.post('/refresh', (req, res) => authController.refresh(req, res, sql));
  router.post('/logout', (req, res) => authController.logout(req, res, sql));
  router.get('/me', authenticateToken, (req, res) => authController.me(req, res, sql));
  router.put('/profile', profileLimiter, authenticateToken, (req, res) => authController.updateProfile(req, res, sql));

  return router;
};
