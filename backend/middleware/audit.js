import { verifyAccessToken } from '../utils/auth.js';

const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const actionByMethod = {
  POST: 'CREAR',
  PUT: 'ACTUALIZAR',
  PATCH: 'ACTUALIZAR',
  DELETE: 'ELIMINAR',
};

export const createAuditMiddleware = (sql) => (req, res, next) => {
  const requestPath = req.originalUrl.split('?')[0];

  if (!writeMethods.has(req.method) || requestPath.startsWith('/api/auth/') || requestPath.startsWith('/api/bienes')) {
    return next();
  }

  const pathSegments = requestPath.split('/').filter(Boolean);
  const tablaAfectada = pathSegments[1] || 'sistema';
  const registroId = Number(req.params?.id || req.params?.bienId || req.params?.usuarioId) || null;
  const datosNuevos = req.body && Object.keys(req.body).length > 0 ? req.body : null;
  const authHeader = req.headers.authorization || '';
  let tokenUsuarioId = null;

  if (authHeader.startsWith('Bearer ')) {
    try {
      tokenUsuarioId = verifyAccessToken(authHeader.slice(7)).sub;
    } catch {
      tokenUsuarioId = null;
    }
  }

  res.on('finish', () => {
    sql.begin(async (transaction) => {
      const email = req.user?.email || null;
      const users = email
        ? await transaction`SELECT id FROM usuarios WHERE email = ${email} LIMIT 1`
        : [];
      const usuarioId = users[0]?.id || req.user?.sub || tokenUsuarioId || null;

      return transaction`
        INSERT INTO audit_log (usuario_id, tabla_afectada, operacion, registro_id, datos_anteriores, datos_nuevos)
        VALUES (
          ${usuarioId},
          ${tablaAfectada},
          ${actionByMethod[req.method]},
          ${registroId},
          ${null},
          ${datosNuevos}
        )
      `;
    }).catch((error) => console.error('Error registrando auditoría:', error.message));
  });

  return next();
};
