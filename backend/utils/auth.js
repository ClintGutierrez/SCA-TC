import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export const systemRoles = ['administrador', 'jefatura', 'tecnico', 'auditor', 'almacen'];

const refreshTokenTTLDays = 7;

export const refreshCookieName = 'inventario_refresh_token';

export const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET no configurado');
  }

  return process.env.JWT_SECRET;
};

export const createRefreshToken = () => crypto.randomBytes(64).toString('hex');

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/api/auth',
  maxAge: refreshTokenTTLDays * 24 * 60 * 60 * 1000,
});

export const normalizeRole = (role) => {
  const normalized = (role || '').toLowerCase();
  return systemRoles.includes(normalized) ? normalized : 'tecnico';
};

export const createAuthToken = (user) => {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      rol: user.rol,
      nombre: user.nombre,
      type: 'access',
    },
    getJwtSecret(),
    { expiresIn: '15m', issuer: 'inventario-bienes', audience: 'inventario-web' },
  );
};

export const safeUser = (user) => ({
  id: user.id,
  nombre: user.nombre,
  email: user.email,
  departamento: user.departamento,
  rol: user.rol,
  es_ti: user.es_ti,
  estado: user.estado,
  activo_login: user.activo_login,
  last_login: user.last_login,
  created_at: user.created_at,
});

export const hashPassword = (password) => bcrypt.hash(password, 10);

export const comparePassword = (password, hash) => bcrypt.compare(password, hash || '');

export const verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET || 'inventario-secret-key');

export const verifyAccessToken = (token) => {
  const payload = jwt.verify(token, getJwtSecret(), {
    issuer: 'inventario-bienes',
    audience: 'inventario-web',
  });

  if (payload.type !== 'access') {
    throw new Error('Token inválido');
  }

  return payload;
};

export const ensureAuthColumns = async (sql) => {
  await sql.unsafe(`ALTER TABLE IF EXISTS usuarios ADD COLUMN IF NOT EXISTS password_hash TEXT`);
  await sql.unsafe(`ALTER TABLE IF EXISTS usuarios ADD COLUMN IF NOT EXISTS last_login TIMESTAMP`);
  await sql.unsafe(`ALTER TABLE IF EXISTS usuarios ADD COLUMN IF NOT EXISTS activo_login BOOLEAN DEFAULT TRUE`);
  await sql.unsafe(`ALTER TABLE IF EXISTS usuarios ADD COLUMN IF NOT EXISTS es_ti BOOLEAN NOT NULL DEFAULT FALSE`);
};
