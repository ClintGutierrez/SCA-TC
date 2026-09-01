import { hashPassword, safeUser, normalizeRole } from '../utils/auth.js';

const buildUserPayload = async (sql, body, existingPasswordHash = null) => {
  const { nombre, email, departamento, rol, estado, activoLogin, password } = body;
  const prepared = {
    nombre,
    email,
    departamento,
    rol: normalizeRole(rol),
    estado: estado || 'activo',
    activo_login: activoLogin === undefined ? true : Boolean(activoLogin),
  };

  if (password) {
    prepared.password_hash = await hashPassword(password);
  } else if (existingPasswordHash) {
    prepared.password_hash = existingPasswordHash;
  }

  return prepared;
};

export const getUsuarios = async (req, res, sql) => {
  try {
    const usuarios = await sql`
      SELECT id, nombre, email, departamento, rol, estado, activo_login, last_login, created_at
      FROM usuarios
      ORDER BY created_at DESC, nombre ASC
    `;

    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUsuarioById = async (req, res, sql) => {
  try {
    const { id } = req.params;
    const usuarios = await sql`
      SELECT id, nombre, email, departamento, rol, estado, activo_login, last_login, created_at
      FROM usuarios
      WHERE id = ${id}
      LIMIT 1
    `;

    if (usuarios.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(usuarios[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createUsuario = async (req, res, sql) => {
  try {
    const { nombre, email, departamento, rol, estado, activoLogin, password } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
    }

    const existing = await sql`SELECT id FROM usuarios WHERE LOWER(email) = LOWER(${email}) LIMIT 1`;
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }

    const userPayload = await buildUserPayload(sql, {
      nombre,
      email,
      departamento,
      rol,
      estado,
      activoLogin,
      password,
    });

    const usuarios = await sql`
      INSERT INTO usuarios (nombre, email, departamento, rol, password_hash, estado, activo_login)
      VALUES (${userPayload.nombre}, ${userPayload.email}, ${userPayload.departamento}, ${userPayload.rol}, ${userPayload.password_hash}, ${userPayload.estado}, ${userPayload.activo_login})
      RETURNING id, nombre, email, departamento, rol, estado, activo_login, last_login, created_at
    `;

    res.status(201).json(usuarios[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateUsuario = async (req, res, sql) => {
  try {
    const { id } = req.params;
    const existingUsers = await sql`SELECT * FROM usuarios WHERE id = ${id} LIMIT 1`;

    if (existingUsers.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const current = existingUsers[0];
    const userPayload = await buildUserPayload(sql, req.body, current.password_hash);

    const usuarios = await sql`
      UPDATE usuarios
      SET nombre = ${userPayload.nombre},
          email = ${userPayload.email},
          departamento = ${userPayload.departamento},
          rol = ${userPayload.rol},
          estado = ${userPayload.estado},
          activo_login = ${userPayload.activo_login},
          password_hash = ${userPayload.password_hash || current.password_hash}
      WHERE id = ${id}
      RETURNING id, nombre, email, departamento, rol, estado, activo_login, last_login, created_at
    `;

    res.json(usuarios[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const disableUsuario = async (req, res, sql) => {
  try {
    const { id } = req.params;

    const usuarios = await sql`
      UPDATE usuarios
      SET estado = 'inactivo', activo_login = FALSE
      WHERE id = ${id}
      RETURNING id, nombre, email, departamento, rol, estado, activo_login, last_login, created_at
    `;

    if (usuarios.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ message: 'Usuario deshabilitado correctamente', user: usuarios[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
