// Identificadores de registros: enteros positivos dentro del rango de INTEGER de PostgreSQL.
// Validarlos antes de consultar evita que un valor como "abc" o "1.5" llegue a la base
// y termine en un error 500 en vez de un 400 claro.
const MAX_INTEGER = 2147483647;

export const idValido = (value) => (typeof value === 'number' || typeof value === 'string')
  && /^\d+$/.test(String(value))
  && Number(value) > 0
  && Number(value) <= MAX_INTEGER;

// Para router.param: valida el parámetro de la ruta y lo deja convertido en número.
export const validarParamId = (req, res, next, value, name) => {
  if (!idValido(value)) return res.status(400).json({ error: 'El identificador no es válido' });
  req.params[name] = Number(value);
  return next();
};
