export const ROLES_USUARIO = [
  { value: 'administrador', label: 'Administrador', description: 'Gestiona cuentas, configuración, inventario y autorizaciones del sistema.' },
  { value: 'jefatura', label: 'Jefatura', description: 'Supervisa solicitudes TI, asigna responsables y gestiona inventario y movimientos.' },
  { value: 'tecnico', label: 'Técnico', description: 'Registra mantenimiento y atiende sus solicitudes asignadas como personal de TI.' },
  { value: 'auditor', label: 'Auditor', description: 'Consulta auditoría y los registros habilitados para su rol. No administra cuentas.' },
  { value: 'almacen', label: 'Almacén', description: 'Registra la llegada de pedidos y consulta su recepción. No administra cuentas.' },
];
export const ACCESOS_USUARIO = [
  { value: 'habilitado', label: 'Habilitado', description: 'Cuenta activa con inicio de sesión habilitado.' },
  { value: 'bloqueado', label: 'Bloqueado', description: 'Cuenta activa con inicio de sesión bloqueado.' },
  { value: 'inactiva', label: 'Cuenta inactiva', description: 'Cuenta desactivada. Sus registros se conservan.' },
];
export const esRolTI = (role) => ['tecnico', 'jefatura'].includes(role);
export const accesoUsuario = (user) => user.estado === 'inactivo' ? 'inactiva' : user.activo_login === false ? 'bloqueado' : 'habilitado';
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
export const formularioUsuario = (user) => ({
  nombre: user?.nombre || '', email: user?.email || '', departamento: user?.departamento || '',
  rol: user?.rol || 'tecnico', acceso: user ? accesoUsuario(user) : 'habilitado',
  esTI: user?.es_ti === true, password: '',
});
export const resumirUsuarios = (users) => users.reduce((summary, user) => {
  summary.total++; summary[accesoUsuario(user)]++;
  if (user.rol === 'administrador' && accesoUsuario(user) === 'habilitado') summary.administradores++;
  return summary;
}, { total: 0, habilitado: 0, bloqueado: 0, inactiva: 0, administradores: 0 });
export const filtrarUsuarios = (users, search, role, access) => users.filter((user) => (!role || user.rol === role)
  && (!access || accesoUsuario(user) === access)
  && (!normalize(search) || normalize([user.nombre, user.email, user.departamento].join(' ')).includes(normalize(search))));
export function validarUsuario(form, requierePassword) {
  const errors = {};
  if (!form.nombre.trim()) errors.nombre = 'Escribe el nombre completo.';
  else if (form.nombre.trim().length > 255) errors.nombre = 'Usa como máximo 255 caracteres.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) || form.email.trim().length > 255) errors.email = 'Escribe un correo válido.';
  if (form.departamento.length > 255) errors.departamento = 'Usa como máximo 255 caracteres.';
  if (!ROLES_USUARIO.some((role) => role.value === form.rol)) errors.rol = 'Selecciona un rol válido.';
  if (!ACCESOS_USUARIO.some((access) => access.value === form.acceso)) errors.acceso = 'Selecciona un acceso válido.';
  if (requierePassword && form.password.trim().length < 8) errors.password = 'Usa una contraseña de al menos 8 caracteres.';
  if (requierePassword && new TextEncoder().encode(form.password).length > 72) errors.password = 'La contraseña supera los 72 bytes permitidos.';
  return errors;
}
export const payloadUsuario = (form, incluirPassword) => ({
  nombre: form.nombre.trim(), email: form.email.trim().toLowerCase(), departamento: form.departamento.trim(),
  rol: form.rol, estado: form.acceso === 'inactiva' ? 'inactivo' : 'activo', activoLogin: form.acceso === 'habilitado',
  esTI: esRolTI(form.rol) || form.esTI,
  ...(incluirPassword ? { password: form.password } : {}),
});
