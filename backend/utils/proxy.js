// Valor de `trust proxy` de Express. Detrás de nginx o Heroku, sin él todas las peticiones
// parecen venir de la IP del proxy y los límites de intentos (login, formulario público de TI)
// se comparten entre todos los usuarios: un solo atacante bloquearía a toda la institución.
//
// TRUST_PROXY admite: un número de saltos (p. ej. 1), 'false', o una lista de IP/subredes
// de proxies de confianza (p. ej. 'loopback' o '10.0.0.0/8'). Sin definir, en producción se
// confía en un único proxy y en desarrollo en ninguno.
// 'true' se rechaza: confiaría en cualquier X-Forwarded-For y el cliente podría falsear su IP.
export const parseTrustProxy = (value, nodeEnv = process.env.NODE_ENV) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw === '') return nodeEnv === 'production' ? 1 : false;
  if (raw.toLowerCase() === 'false') return false;
  if (raw.toLowerCase() === 'true') {
    throw new Error("TRUST_PROXY=true permite falsear la IP del cliente; indica el número de proxies (p. ej. 1) o sus direcciones");
  }
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
};
