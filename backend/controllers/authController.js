import crypto from 'crypto';
import {
  comparePassword,
  cuentaHabilitada,
  createAuthToken,
  createRefreshToken,
  getRefreshCookieOptions,
  hashPassword,
  hashToken,
  refreshCookieName,
  safeUser,
} from '../utils/auth.js';
import { MENSAJE_PASSWORD, emailValido, passwordValida, revocarSesiones, userError } from '../utils/usuarios.js';
import { responderError } from '../utils/errores.js';

const refreshTokenLifetimeDays = 7;

let dummyHashPromise = null;
const getDummyHash = () => {
  dummyHashPromise ||= hashPassword(crypto.randomBytes(32).toString('hex'));
  return dummyHashPromise;
};

const createRefreshTokenExpiresAt = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + refreshTokenLifetimeDays);
  return expiresAt;
};

const recordAuthEvent = async (sql, { user = null, email, successful, reason, operation }) => {
  try {
    const eventOperation = operation || (successful ? 'LOGIN' : 'LOGIN_FAILED');
    const details = {
      email,
      resultado: successful ? 'exitoso' : 'fallido',
      ...(reason ? { motivo: reason } : {}),
    };

    await sql`
      INSERT INTO audit_log (usuario_id, tabla_afectada, operacion, registro_id, datos_anteriores, datos_nuevos)
      VALUES (
        ${user?.id || null},
        'autenticacion',
        ${eventOperation},
        ${user?.id || null},
        ${null},
        ${details}
      )
    `;
  } catch (error) {
    console.error('Error registrando inicio de sesión:', error.message);
  }
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

    const user = users[0] || null;

    // Siempre se ejecuta bcrypt (con un hash ficticio si no hay cuenta o contraseña)
    // para que el tiempo de respuesta no revele qué correos existen.
    const isValid = await comparePassword(normalizedPassword, user?.password_hash || await getDummyHash());

    if (!user || !user.password_hash || !isValid) {
      await recordAuthEvent(sql, { user, email: user?.email || normalizedEmail, successful: false, reason: 'credenciales_invalidas' });
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // El estado de la cuenta solo se informa a quien ya demostró conocer la contraseña.
    if (!cuentaHabilitada(user)) {
      await recordAuthEvent(sql, { user, email: user.email, successful: false, reason: 'acceso_deshabilitado' });
      return res.status(403).json({ error: 'Usuario sin acceso habilitado' });
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

    await recordAuthEvent(sql, { user, email: user.email, successful: true });

    res.cookie(refreshCookieName, refreshToken, getRefreshCookieOptions());

    res.json({
      token,
      user: safeUser(user),
    });
  } catch (error) {
    return responderError(res, error, 'autenticación.login');
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
      SELECT s.id, s.user_id, s.expires_at, s.revoked_at, u.nombre, u.email, u.departamento, u.rol, u.es_ti, u.estado, u.activo_login, u.last_login, u.created_at
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

    if (session.revoked_at || expiresAt <= now || !cuentaHabilitada(session)) {
      await sql`
        UPDATE auth_sessions
        SET revoked_at = NOW()
        WHERE id = ${session.id}
      `;

      res.clearCookie(refreshCookieName, getRefreshCookieOptions());
      return res.status(401).json({ error: 'Sesión inválida o expirada' });
    }

    const refreshedUser = { ...session, id: session.user_id };
    const newAccessToken = createAuthToken(refreshedUser);
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
      user: safeUser(refreshedUser),
    });
  } catch (error) {
    return responderError(res, error, 'autenticación.refresh');
  }
};

export const logout = async (req, res, sql) => {
  try {
    const refreshToken = req.cookies?.[refreshCookieName];

    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      const sessions = await sql`
        SELECT u.id, u.email
        FROM auth_sessions s
        INNER JOIN usuarios u ON u.id = s.user_id
        WHERE s.token_hash = ${tokenHash} AND s.revoked_at IS NULL
        LIMIT 1
      `;

      await sql`
        UPDATE auth_sessions
        SET revoked_at = NOW()
        WHERE token_hash = ${tokenHash} AND revoked_at IS NULL
      `;

      if (sessions[0]) {
        await recordAuthEvent(sql, {
          user: sessions[0],
          email: sessions[0].email,
          successful: true,
          operation: 'LOGOUT',
        });
      }
    }

    res.clearCookie(refreshCookieName, getRefreshCookieOptions());
    return res.status(204).send();
  } catch (error) {
    return responderError(res, error, 'autenticación.logout');
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
    return responderError(res, error, 'autenticación.me');
  }
};

export const updateProfile = async (req, res, sql) => {
  try {
    const userId = Number(req.user?.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0) throw userError(401, 'Identidad de sesión inválida');

    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const { nombre, email, departamento, password, currentPassword } = body;
    const normalizedName = typeof nombre === 'string' ? nombre.trim() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedDepartment = typeof departamento === 'string' ? departamento.trim() : '';
    const changePassword = password !== undefined && password !== null && password !== '';

    const campos = {};
    if (!normalizedName || normalizedName.length > 255) campos.nombre = 'Escribe un nombre de hasta 255 caracteres.';
    if (!emailValido(normalizedEmail)) campos.email = 'Escribe un correo válido.';
    if (departamento != null && (typeof departamento !== 'string' || departamento.length > 255)) {
      campos.departamento = 'Usa como máximo 255 caracteres.';
    }
    if (changePassword && !passwordValida(password)) campos.password = MENSAJE_PASSWORD;
    if (Object.keys(campos).length) throw userError(400, 'Revisa los datos del perfil', campos);

    const newPasswordHash = changePassword ? await hashPassword(password) : null;
    const refreshToken = req.cookies?.[refreshCookieName];

    const updated = await sql.begin(async (tx) => {
      const [current] = await tx`SELECT * FROM usuarios WHERE id = ${userId} FOR UPDATE`;
      if (!current) throw userError(404, 'Usuario no encontrado');
      if (!cuentaHabilitada(current)) {
        throw userError(403, 'Usuario sin acceso habilitado');
      }

      // El correo de acceso identifica al usuario como jefe inmediato al aprobar movimientos
      // patrimoniales y no se verifica por correo: solo un administrador puede cambiarlo
      // (desde Usuarios). Así nadie puede tomar el correo de un jefe para aprobar en su nombre.
      const emailChanged = normalizedEmail !== String(current.email || '').toLowerCase();
      if (emailChanged) {
        throw userError(403, 'Solo un administrador puede cambiar el correo de acceso', {
          email: 'Pide a un administrador que cambie tu correo.',
        });
      }

      // Cambiar la contraseña exige demostrar la actual, para que un token de acceso robado
      // no baste para apropiarse de la cuenta.
      if (changePassword) {
        const valid = typeof currentPassword === 'string' && currentPassword !== ''
          && await comparePassword(currentPassword, current.password_hash);
        if (!valid) {
          throw userError(403, 'La contraseña actual no es correcta', { currentPassword: 'Escribe tu contraseña actual.' });
        }
      }

      const [user] = await tx`
        UPDATE usuarios
        SET nombre = ${normalizedName},
            departamento = ${normalizedDepartment || null},
            password_hash = ${newPasswordHash || current.password_hash}
        WHERE id = ${userId}
        RETURNING id, nombre, email, departamento, rol, es_ti, estado, activo_login, last_login, created_at
      `;

      // Con una contraseña nueva se cierran las demás sesiones; la actual se conserva.
      if (changePassword) await revocarSesiones(tx, userId, refreshToken ? hashToken(refreshToken) : null);
      return user;
    });

    if (changePassword) {
      await recordAuthEvent(sql, { user: updated, email: updated.email, successful: true, operation: 'PASSWORD_CHANGE' });
    }

    return res.json({ user: safeUser(updated) });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    if (error.status) {
      return res.status(error.status).json({ error: error.message, ...(error.campos ? { campos: error.campos } : {}) });
    }
    console.error('Error actualizando perfil:', error.message);
    return res.status(500).json({ error: 'No se pudo actualizar el perfil' });
  }
};
