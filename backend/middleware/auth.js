import { verifyAccessToken, systemRoles } from '../utils/auth.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

export const requireRole = (...allowedRoles) => {
  const normalizedAllowed = allowedRoles.map((role) => role.toLowerCase());

  return (req, res, next) => {
    const userRole = (req.user?.rol || '').toLowerCase();

    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({ error: 'No tienes permisos para realizar esta acción' });
    }

    return next();
  };
};

export const allowSystemRoles = (...roles) => roles.filter((role) => systemRoles.includes(role));
