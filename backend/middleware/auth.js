import { cuentaHabilitada, verifyAccessToken, systemRoles } from '../utils/auth.js';

// Verifica el JWT y, en cada solicitud, consulta la cuenta en la base de datos.
// El rol, el correo y el nombre del token se reemplazan por los actuales, de modo que
// un token emitido antes de deshabilitar o degradar una cuenta no conserva sus permisos.
export const authenticate = (sql) => async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  const userId = Number(payload.sub);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  try {
    const [user] = await sql`
      SELECT id, nombre, email, rol, estado, activo_login
      FROM usuarios WHERE id = ${userId} LIMIT 1
    `;
    if (!user) {
      return res.status(401).json({ error: 'Sesión no válida' });
    }
    if (!cuentaHabilitada(user)) {
      return res.status(403).json({ error: 'La cuenta está deshabilitada' });
    }
    req.user = { ...payload, sub: userId, rol: user.rol, email: user.email, nombre: user.nombre };
    return next();
  } catch (error) {
    return next(error);
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
