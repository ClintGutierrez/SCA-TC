import {
  comparePassword,
  createAuthToken,
  createRefreshToken,
  getRefreshCookieOptions,
  hashToken,
  refreshCookieName,
  safeUser,
} from '../utils/auth.js';

const refreshTokenLifetimeDays = 7;

const createRefreshTokenExpiresAt = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + refreshTokenLifetimeDays);
  return expiresAt;
};

export const login = async (req, res, sql) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = (email || '').trim();
    const normalizedPassword = password ?? '';

    if (!normalizedEmail || !normalizedPassword) {
      return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
    }

    const users = await sql`
      SELECT *
      FROM usuarios
      WHERE LOWER(email) = LOWER(${normalizedEmail})
      LIMIT 1
    `;

    if (users.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = users[0];

    if (!user.password_hash || user.activo_login === false || user.estado === 'inactivo') {
      return res.status(403).json({ error: 'Usuario sin acceso habilitado' });
    }

    const isValid = await comparePassword(normalizedPassword, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = createAuthToken(user);
    const refreshToken = createRefreshToken();
    const refreshTokenHash = hashToken(refreshToken);

    await sql.begin(async (transaction) => {
      await transaction`
        UPDATE usuarios
        SET last_login = NOW()
        WHERE id = ${user.id}
      `;

      await transaction`
        INSERT INTO auth_sessions (user_id, token_hash, expires_at)
        VALUES (${user.id}, ${refreshTokenHash}, ${createRefreshTokenExpiresAt()})
      `;
    });

    res.cookie(refreshCookieName, refreshToken, getRefreshCookieOptions());

    res.json({
      token,
      user: safeUser(user),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const refresh = async (req, res, sql) => {
  try {
    const refreshToken = req.cookies?.[refreshCookieName];

    if (!refreshToken) {
      return res.status(401).json({ error: 'Sesión no encontrada' });
    }

    const tokenHash = hashToken(refreshToken);
    const sessions = await sql`
      SELECT s.id, s.user_id, s.expires_at, s.revoked_at, u.id AS user_id, u.nombre, u.email, u.departamento, u.rol, u.estado, u.activo_login, u.last_login, u.created_at
      FROM auth_sessions s
      INNER JOIN usuarios u ON u.id = s.user_id
      WHERE s.token_hash = ${tokenHash}
      LIMIT 1
    `;

    if (sessions.length === 0) {
      res.clearCookie(refreshCookieName, getRefreshCookieOptions());
      return res.status(401).json({ error: 'Sesión inválida o expirada' });
    }

    const session = sessions[0];
    const now = new Date();
    const expiresAt = new Date(session.expires_at);

    if (session.revoked_at || expiresAt <= now || session.estado === 'inactivo' || session.activo_login === false) {
      await sql`
        UPDATE auth_sessions
        SET revoked_at = NOW()
        WHERE id = ${session.id}
      `;

      res.clearCookie(refreshCookieName, getRefreshCookieOptions());
      return res.status(401).json({ error: 'Sesión inválida o expirada' });
    }

    const newAccessToken = createAuthToken(session);
    const newRefreshToken = createRefreshToken();
    const newRefreshTokenHash = hashToken(newRefreshToken);

    await sql`
      UPDATE auth_sessions
      SET token_hash = ${newRefreshTokenHash},
          expires_at = ${createRefreshTokenExpiresAt()},
          last_used_at = NOW()
      WHERE id = ${session.id}
    `;

    res.cookie(refreshCookieName, newRefreshToken, getRefreshCookieOptions());

    return res.json({
      token: newAccessToken,
      user: safeUser(session),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const logout = async (req, res, sql) => {
  try {
    const refreshToken = req.cookies?.[refreshCookieName];

    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);

      await sql`
        UPDATE auth_sessions
        SET revoked_at = NOW()
        WHERE token_hash = ${tokenHash} AND revoked_at IS NULL
      `;
    }

    res.clearCookie(refreshCookieName, getRefreshCookieOptions());
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const me = async (req, res, sql) => {
  try {
    const users = await sql`SELECT * FROM usuarios WHERE id = ${req.user.sub} LIMIT 1`;

    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ user: safeUser(users[0]) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
