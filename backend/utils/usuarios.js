import { hashPassword, systemRoles } from './auth.js';

export const userError = (status, message, campos) => Object.assign(new Error(message), { status, campos });
export const administradorHabilitado = (user) => user.rol === 'administrador' && user.estado !== 'inactivo' && user.activo_login !== false;

export async function prepararUsuario(body, current = null) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw userError(400, 'Datos de cuenta inválidos');
  const field = (name, fallback) => Object.hasOwn(body, name) ? body[name] : fallback;
  const nombre = field('nombre', current?.nombre);
  const email = field('email', current?.email);
  const departamento = field('departamento', current?.departamento || '');
  const rol = field('rol', current?.rol || 'tecnico');
  const estado = field('estado', current?.estado || 'activo');
  const activoLogin = field('activoLogin', current?.activo_login !== false);
  const esTI = field('esTI', current?.es_ti === true);
  const password = body.password;
  const campos = {};
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 255) campos.nombre = 'Escribe un nombre de hasta 255 caracteres.';
  if (typeof email !== 'string' || email.trim().length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) campos.email = 'Escribe un correo válido.';
  if (typeof departamento !== 'string' || departamento.length > 255) campos.departamento = 'Usa como máximo 255 caracteres.';
  if (!systemRoles.includes(rol)) campos.rol = 'Selecciona un rol válido.';
  if (!['activo', 'inactivo'].includes(estado) || typeof activoLogin !== 'boolean') campos.acceso = 'Selecciona un acceso válido.';
  if (typeof esTI !== 'boolean') campos.esTI = 'Indica si pertenece a TI.';
  const changePassword = !current || (password !== undefined && password !== '');
  if (changePassword && (typeof password !== 'string' || password.trim().length < 8 || Buffer.byteLength(password, 'utf8') > 72)) campos.password = 'Usa al menos 8 caracteres y un máximo de 72 bytes.';
  if (Object.keys(campos).length) throw userError(400, 'Revisa los campos de la cuenta', campos);
  return {
    nombre: nombre.trim(), email: email.trim().toLowerCase(), departamento: departamento.trim() || null,
    rol, estado, activo_login: estado === 'activo' && activoLogin,
    es_ti: ['tecnico', 'jefatura'].includes(rol) || esTI,
    password_hash: changePassword ? await hashPassword(password) : current.password_hash,
  };
}

// Bloquear administradores en el mismo orden evita que dos operaciones retiren
// simultáneamente el acceso de las últimas cuentas administradoras.
export async function bloquearUsuarios(tx, actorId, targetId = 0) {
  if (!Number.isSafeInteger(actorId) || actorId <= 0) throw userError(401, 'Identidad de sesión inválida');
  const rows = await tx`SELECT * FROM usuarios WHERE rol='administrador' OR id=${targetId} OR id=${actorId} ORDER BY id FOR UPDATE`;
  const actor = rows.find((user) => Number(user.id) === actorId);
  if (!actor || !administradorHabilitado(actor)) throw userError(403, 'La cuenta actual no tiene permisos para administrar usuarios');
  return rows;
}

export function protegerAcceso(rows, current, next, actorId) {
  const removingAccess = administradorHabilitado(current) && !administradorHabilitado(next);
  if (Number(current.id) === actorId && (next.rol !== current.rol || next.estado === 'inactivo' || next.activo_login === false)) {
    throw userError(409, 'No puedes cambiar tu propio rol ni deshabilitar tu acceso');
  }
  if (removingAccess && rows.filter(administradorHabilitado).length <= 1) {
    throw userError(409, 'Debe conservarse al menos un administrador con acceso habilitado');
  }
}
