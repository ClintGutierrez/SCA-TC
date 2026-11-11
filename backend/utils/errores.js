// Respuesta de error para bloques catch que no controlan el error explícitamente.
// Nunca envía error.message al cliente: puede contener detalles de PostgreSQL
// (tablas, columnas, restricciones o valores). El detalle se registra en el servidor.

// Errores de PostgreSQL causados por los datos de la solicitud, con mensajes seguros.
const ERRORES_DE_DATOS = {
  '22P02': [400, 'Los datos enviados no tienen el formato esperado'],
  '22007': [400, 'La fecha enviada no es válida'],
  '22008': [400, 'La fecha enviada no es válida'],
  '22003': [400, 'Un valor numérico está fuera del rango permitido'],
  '22001': [400, 'Un texto supera la longitud permitida'],
  '23502': [400, 'Faltan datos obligatorios'],
  '23514': [400, 'Los datos enviados no cumplen las reglas del registro'],
  '23503': [409, 'La operación hace referencia a un registro inexistente o relacionado con otros datos'],
  '23505': [409, 'El registro ya existe'],
};

export const responderError = (res, error, contexto, mensaje = 'No se pudo completar la operación') => {
  const conocido = ERRORES_DE_DATOS[error?.code];
  if (conocido) return res.status(conocido[0]).json({ error: conocido[1] });
  console.error(`Error en ${contexto}:`, error);
  return res.status(500).json({ error: mensaje });
};
