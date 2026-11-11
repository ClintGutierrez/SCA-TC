// Detecta cuándo la sesión del usuario terminó en el servidor y avisa a la aplicación,
// para que cierre la sesión local y vuelva al inicio de sesión con el motivo.

export const MOTIVOS_FIN_SESION = {
  cuentaDeshabilitada: 'cuenta_deshabilitada',
  sesionExpirada: 'sesion_expirada',
};

export const MENSAJES_FIN_SESION = {
  [MOTIVOS_FIN_SESION.cuentaDeshabilitada]: 'Tu cuenta fue deshabilitada. Contacta al administrador del sistema.',
  [MOTIVOS_FIN_SESION.sesionExpirada]: 'Tu sesión expiró. Inicia sesión de nuevo.',
};

// Un 403 genérico es un permiso denegado; solo este código indica que la cuenta ya no puede operar.
export const esCuentaDeshabilitada = (error) => error?.response?.status === 403
  && error?.response?.data?.code === 'CUENTA_DESHABILITADA';

const oyentes = new Set();

export const alTerminarSesion = (oyente) => {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
};

export const notificarFinSesion = (motivo) => {
  oyentes.forEach((oyente) => {
    try { oyente(motivo); } catch (error) { console.error('Error al cerrar la sesión:', error); }
  });
};
