import { safeUser } from '../utils/auth.js';
import { bloquearUsuarios, prepararUsuario, protegerAcceso, revocarSesiones, userError } from '../utils/usuarios.js';

const respondError = (res, error) => {
  if (error.code === '23505') return res.status(409).json({ error: 'Ya existe una cuenta con ese correo', campos: { email: 'Este correo ya está registrado.' } });
  const status = error.status || 500;
  if (status === 500) console.error('Usuarios:', error.message);
  return res.status(status).json({ error: status === 500 ? 'No se pudo completar la operación de usuarios' : error.message, ...(error.campos ? { campos: error.campos } : {}) });
};
const positiveId = (value) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw userError(400, 'Identificador de cuenta inválido');
  return id;
};
const duplicateEmail = async (tx, email, id = 0) => {
  const existing = await tx`SELECT id FROM usuarios WHERE LOWER(email)=${email} AND id<>${id} LIMIT 1`;
  if (existing.length) throw userError(409, 'Ya existe una cuenta con ese correo', { email: 'Este correo ya está registrado.' });
};

export const getUsuarios = async (req, res, sql) => {
  try {
    const users = req.user?.rol === 'auditor'
      ? await sql`SELECT id,nombre,email,estado FROM usuarios ORDER BY created_at DESC,nombre ASC`
      : await sql`SELECT id,nombre,email,departamento,rol,es_ti,estado,activo_login,last_login,created_at FROM usuarios ORDER BY created_at DESC,nombre ASC`;
    res.json(users);
  } catch (error) { respondError(res, error); }
};

export const getUsuarioById = async (req, res, sql) => {
  try {
    const id = positiveId(req.params.id);
    const [user] = await sql`SELECT * FROM usuarios WHERE id=${id} LIMIT 1`;
    if (!user) throw userError(404, 'Usuario no encontrado');
    res.json(safeUser(user));
  } catch (error) { respondError(res, error); }
};

export const createUsuario = async (req, res, sql) => {
  try {
    const payload = await prepararUsuario(req.body);
    const created = await sql.begin(async (tx) => {
      await bloquearUsuarios(tx, Number(req.user?.sub));
      await duplicateEmail(tx, payload.email);
      const [user] = await tx`
        INSERT INTO usuarios (nombre,email,departamento,rol,password_hash,estado,activo_login,es_ti)
        VALUES (${payload.nombre},${payload.email},${payload.departamento},${payload.rol},${payload.password_hash},${payload.estado},${payload.activo_login},${payload.es_ti}) RETURNING *`;
      return user;
    });
    res.status(201).json(safeUser(created));
  } catch (error) { respondError(res, error); }
};

export const updateUsuario = async (req, res, sql) => {
  try {
    const id = positiveId(req.params.id);
    const actorId = Number(req.user?.sub);
    const updated = await sql.begin(async (tx) => {
      const users = await bloquearUsuarios(tx, actorId, id);
      const current = users.find((user) => Number(user.id) === id);
      if (!current) throw userError(404, 'Usuario no encontrado');
      const payload = await prepararUsuario(req.body, current);
      protegerAcceso(users, current, payload, actorId);
      await duplicateEmail(tx, payload.email, id);
      const [user] = await tx`UPDATE usuarios SET nombre=${payload.nombre},email=${payload.email},departamento=${payload.departamento},
        rol=${payload.rol},es_ti=${payload.es_ti},estado=${payload.estado},activo_login=${payload.activo_login},password_hash=${payload.password_hash}
        WHERE id=${id} RETURNING *`;
      // Una contraseña nueva o un acceso retirado invalidan las sesiones abiertas de esa cuenta.
      const accessRemoved = !payload.activo_login || payload.estado === 'inactivo';
      if (payload.password_hash !== current.password_hash || accessRemoved) await revocarSesiones(tx, id);
      return user;
    });
    res.json(safeUser(updated));
  } catch (error) { respondError(res, error); }
};

export const disableUsuario = async (req, res, sql) => {
  try {
    const id = positiveId(req.params.id);
    const actorId = Number(req.user?.sub);
    const disabled = await sql.begin(async (tx) => {
      const users = await bloquearUsuarios(tx, actorId, id);
      const current = users.find((user) => Number(user.id) === id);
      if (!current) throw userError(404, 'Usuario no encontrado');
      protegerAcceso(users, current, { ...current, estado: 'inactivo', activo_login: false }, actorId);
      const [user] = await tx`UPDATE usuarios SET estado='inactivo',activo_login=FALSE WHERE id=${id} RETURNING *`;
      await revocarSesiones(tx, id);
      return user;
    });
    res.json({ message: 'Usuario deshabilitado correctamente', user: safeUser(disabled) });
  } catch (error) { respondError(res, error); }
};
