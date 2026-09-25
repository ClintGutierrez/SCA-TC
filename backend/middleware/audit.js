const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const actionByMethod = {
  POST: 'CREAR',
  PUT: 'ACTUALIZAR',
  PATCH: 'ACTUALIZAR',
  DELETE: 'ELIMINAR',
};

export const createAuditMiddleware = (sql) => (req, res, next) => {
  if (!writeMethods.has(req.method)) {
    return next();
  }

  res.on('finish', () => {
    sql`
      INSERT INTO auditoria (usuario_id, accion, recurso, metodo, estado_http, ip)
      VALUES (
        ${req.user?.sub || null},
        ${actionByMethod[req.method]},
        ${req.originalUrl.split('?')[0]},
        ${req.method},
        ${res.statusCode},
        ${req.ip || null}
      )
    `.catch((error) => console.error('Error registrando auditoría:', error.message));
  });

  return next();
};
