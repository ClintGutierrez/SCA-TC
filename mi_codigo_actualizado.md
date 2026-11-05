# Código Completo del Proyecto SCA-TC

## Estructura de Directorios
```text
.
./.env.example
./.git
./.github
./.github/copilot-instructions.md
./.gitignore
./backend
./backend/.env
./backend/.env.example
./backend/controllers
./backend/controllers/auditoriaController.js
./backend/controllers/authController.js
./backend/controllers/bienesController.js
./backend/controllers/depreciacionController.js
./backend/controllers/mantenimientoController.js
./backend/controllers/reportesController.js
./backend/controllers/usuariosController.js
./backend/docs
./backend/docs/openapi.js
./backend/middleware
./backend/middleware/auth.js
./backend/migrations
./backend/migrations/run.js
./backend/migrations/schema.sql
./backend/node_modules
./backend/package.json
./backend/package-lock.json
./backend/routes
./backend/routes/auditoria.js
./backend/routes/auth.js
./backend/routes/bienes.js
./backend/routes/depreciacion.js
./backend/routes/mantenimiento.js
./backend/routes/reportes.js
./backend/routes/usuarios.js
./backend/server.js
./backend/utils
./backend/utils/auth.js
./CONTRIBUTORS.md
./DEPLOYMENT.md
./DEVELOPMENT.md
./frontend
./frontend/index.html
./frontend/node_modules
./frontend/package.json
./frontend/package-lock.json
./frontend/postcss.config.js
./frontend/src
./frontend/src/App.css
./frontend/src/App.jsx
./frontend/src/components
./frontend/src/components/AuditoriaList.jsx
./frontend/src/components/Dashboard.jsx
./frontend/src/components/InventarioList.jsx
./frontend/src/components/Login.jsx
./frontend/src/components/Mantenimiento.jsx
./frontend/src/components/NavBar.jsx
./frontend/src/components/Reportes.jsx
./frontend/src/components/Sidebar.jsx
./frontend/src/components/Usuarios.jsx
./frontend/src/index.css
./frontend/src/main.jsx
./frontend/src/services
./frontend/src/services/api.js
./frontend/src/utils
./frontend/src/utils/helpers.js
./frontend/tailwind.config.js
./frontend/vite.config.js
./INSTALL.md
./mi_codigo_actualizado.md
./package.json
./package-lock.json
./PROJECT_STATUS.md
./README.md
./TESTING.md
```

## Contenido de los Archivos

### Archivo: ./.gitignore
```javascript
# Ignore Node modules
node_modules/
npm-debug.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Ignore environment variables
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store

# Build outputs
dist/
build/
*.tsbuildinfo

# Dependencies
/backend/node_modules/
/frontend/node_modules/

# Logs
logs
*.log

# Database
*.db
*.sqlite
*.sqlite3

# Temporary files
temp/
tmp/
*.tmp

# OS
Thumbs.db
.DS_Store

```

### Archivo: ./backend/controllers/auditoriaController.js
```javascript
export const getAuditoria = async (req, res, sql) => {
  const { desde, hasta, usuario, modulo, accion } = req.query;

  try {
    const logs = await sql`
      SELECT * FROM log_auditoria
      WHERE 
        (${desde || null}::timestamp IS NULL OR fecha_hora >= ${desde}) AND
        (${hasta || null}::timestamp IS NULL OR fecha_hora <= ${hasta}) AND
        (${usuario || null}::text IS NULL OR usuario ILIKE ${'%' + usuario + '%'}) AND
        (${modulo || null}::text IS NULL OR modulo = ${modulo}) AND
        (${accion || null}::text IS NULL OR accion = ${accion})
      ORDER BY fecha_hora DESC
      LIMIT 50
    `.timeout(3000);

    res.status(200).json(logs);
  } catch (error) {
    if (error.code === 'TIMEOUT') {
      return res.status(408).json({ 
        error: "La consulta excede el limite de procesamiento. Por favor refine los filtros aplicados" 
      });
    }
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};
```

### Archivo: ./backend/controllers/authController.js
```javascript
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

```

### Archivo: ./backend/controllers/bienesController.js
```javascript
import { v4 as uuidv4 } from 'uuid';

export const getBienes = async (req, res, sql) => {
  try {
    const bienes = await sql`SELECT * FROM bienes_informaticos ORDER BY created_at DESC`;
    res.json(bienes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getBienById = async (req, res, sql) => {
  try {
    const { id } = req.params;
    const bien = await sql`SELECT * FROM bienes_informaticos WHERE id = ${id}`;
    if (bien.length === 0) {
      return res.status(404).json({ error: 'Bien no encontrado' });
    }
    res.json(bien[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createBien = async (req, res, sql) => {
  try {
    const { nombre, descripcion, tipo, marca, modelo, numeroSerie, fechaAdquisicion, costo, usuarioAsignado, ubicacion } = req.body;
    
    const bien = await sql`
      INSERT INTO bienes_informaticos (nombre, descripcion, tipo, marca, modelo, numero_serie, fecha_adquisicion, costo, usuario_asignado, estado, ubicacion)
      VALUES (${nombre}, ${descripcion}, ${tipo}, ${marca}, ${modelo}, ${numeroSerie}, ${fechaAdquisicion}, ${costo}, ${usuarioAsignado}, 'activo', ${ubicacion})
      RETURNING *
    `;
    res.status(201).json(bien[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateBien = async (req, res, sql) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, tipo, marca, modelo, numeroSerie, costo, usuarioAsignado, estado, ubicacion } = req.body;
    
    const bien = await sql`
      UPDATE bienes_informaticos 
      SET nombre = ${nombre}, 
          descripcion = ${descripcion}, 
          tipo = ${tipo}, 
          marca = ${marca}, 
          modelo = ${modelo}, 
          numero_serie = ${numeroSerie}, 
          costo = ${costo}, 
          usuario_asignado = ${usuarioAsignado}, 
          estado = ${estado}, 
          ubicacion = ${ubicacion},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    
    if (bien.length === 0) {
      return res.status(404).json({ error: 'Bien no encontrado' });
    }
    res.json(bien[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteBien = async (req, res, sql) => {
  try {
    const { id } = req.params;
    const result = await sql`DELETE FROM bienes_informaticos WHERE id = ${id}`;
    if (result.count === 0) {
      return res.status(404).json({ error: 'Bien no encontrado' });
    }
    res.json({ message: 'Bien eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

```

### Archivo: ./backend/controllers/depreciacionController.js
```javascript
import { getYear } from 'date-fns';

export const calcularDepreciacion = (valorInicial, porcentajeAnual, anios) => {
  return valorInicial * Math.pow(1 - porcentajeAnual / 100, anios);
};

export const getDepreciacion = async (req, res, sql) => {
  try {
    const depreciacion = await sql`SELECT * FROM depreciacion`;
    res.json(depreciacion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getDepreciacionPorBien = async (req, res, sql) => {
  try {
    const { bienId } = req.params;
    const depreciacion = await sql`SELECT * FROM depreciacion WHERE bien_id = ${bienId}`;
    if (depreciacion.length === 0) {
      return res.status(404).json({ error: 'Depreciación no encontrada' });
    }
    res.json(depreciacion[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const crearDepreciacion = async (req, res, sql) => {
  try {
    const { bienId, valorInicial, porcentajeAnual } = req.body;
    const anoActual = getYear(new Date());
    
    const depreciacion = await sql`
      INSERT INTO depreciacion (bien_id, valor_inicial, porcentaje_anual, valor_actual, ano_actual)
      VALUES (${bienId}, ${valorInicial}, ${porcentajeAnual || 20}, ${valorInicial}, ${anoActual})
      RETURNING *
    `;
    res.status(201).json(depreciacion[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const actualizarDepreciacion = async (req, res, sql) => {
  try {
    const { bienId } = req.params;
    
    // Obtener datos de depreciación
    const depreciacionData = await sql`SELECT * FROM depreciacion WHERE bien_id = ${bienId}`;
    if (depreciacionData.length === 0) {
      return res.status(404).json({ error: 'Depreciación no encontrada' });
    }
    
    const { valor_inicial, porcentaje_anual, ano_actual } = depreciacionData[0];
    const anoActual = getYear(new Date());
    const anios = anoActual - ano_actual;
    
    const nuevoValor = calcularDepreciacion(valor_inicial, porcentaje_anual, anios);
    
    const result = await sql`
      UPDATE depreciacion 
      SET valor_actual = ${nuevoValor}, ano_actual = ${anoActual}
      WHERE bien_id = ${bienId}
      RETURNING *
    `;
    
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

```

### Archivo: ./backend/controllers/mantenimientoController.js
```javascript
export const getMantenimiento = async (req, res, sql) => {
  try {
    const mantenimiento = await sql`SELECT * FROM mantenimiento ORDER BY fecha DESC`;
    res.json(mantenimiento);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getMantenimientoPorBien = async (req, res, sql) => {
  try {
    const { bienId } = req.params;
    const mantenimiento = await sql`SELECT * FROM mantenimiento WHERE bien_id = ${bienId} ORDER BY fecha DESC`;
    res.json(mantenimiento);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createMantenimiento = async (req, res, sql) => {
  try {
    const { bienId, tipo, descripcion, fecha, costo, responsable } = req.body;
    
    const mantenimiento = await sql`
      INSERT INTO mantenimiento (bien_id, tipo, descripcion, fecha, costo, responsable)
      VALUES (${bienId}, ${tipo}, ${descripcion}, ${fecha}, ${costo}, ${responsable})
      RETURNING *
    `;
    res.status(201).json(mantenimiento[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteMantenimiento = async (req, res, sql) => {
  try {
    const { id } = req.params;
    const result = await sql`DELETE FROM mantenimiento WHERE id = ${id}`;
    if (result.count === 0) {
      return res.status(404).json({ error: 'Registro de mantenimiento no encontrado' });
    }
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

```

### Archivo: ./backend/controllers/reportesController.js
```javascript
export const getReporteInventario = async (req, res, sql) => {
  try {
    const reporte = await sql`
      SELECT 
        COUNT(*) as total_bienes,
        SUM(CASE WHEN estado = 'activo' THEN 1 ELSE 0 END) as activos,
        SUM(CASE WHEN estado = 'inactivo' THEN 1 ELSE 0 END) as inactivos,
        SUM(CASE WHEN estado = 'reparacion' THEN 1 ELSE 0 END) as en_reparacion,
        SUM(costo) as valor_total
      FROM bienes_informaticos
    `;
    res.json(reporte[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getReporteDepreciacion = async (req, res, sql) => {
  try {
    const reporte = await sql`
      SELECT 
        b.id,
        b.nombre,
        b.tipo,
        d.valor_inicial,
        d.valor_actual,
        (d.valor_inicial - d.valor_actual) as depreciacion_total,
        ROUND(((d.valor_inicial - d.valor_actual) / d.valor_inicial * 100)::numeric, 2) as porcentaje_depreciacion
      FROM bienes_informaticos b
      LEFT JOIN depreciacion d ON b.id = d.bien_id
      ORDER BY b.nombre
    `;
    res.json(reporte);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getReporteAsignaciones = async (req, res, sql) => {
  try {
    const reporte = await sql`
      SELECT 
        u.nombre as usuario,
        COUNT(a.id) as cantidad_equipos,
        STRING_AGG(b.nombre, ', ') as equipos
      FROM usuarios u
      LEFT JOIN asignaciones a ON u.id = a.usuario_id AND a.fecha_devolucion IS NULL
      LEFT JOIN bienes_informaticos b ON a.bien_id = b.id
      GROUP BY u.id, u.nombre
      ORDER BY u.nombre
    `;
    res.json(reporte);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getReporteMantenimiento = async (req, res, sql) => {
  try {
    const reporte = await sql`
      SELECT 
        b.nombre,
        b.tipo,
        COUNT(m.id) as cantidad_mantenimientos,
        SUM(m.costo) as costo_total_mantenimiento,
        MAX(m.fecha) as ultimo_mantenimiento
      FROM bienes_informaticos b
      LEFT JOIN mantenimiento m ON b.id = m.bien_id
      GROUP BY b.id, b.nombre, b.tipo
      ORDER BY costo_total_mantenimiento DESC
    `;
    res.json(reporte);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

```

### Archivo: ./backend/controllers/usuariosController.js
```javascript
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

```

### Archivo: ./backend/docs/openapi.js
```javascript
const secured = (summary, tags, responses = { 200: { description: 'Operacion exitosa' } }) => ({
  summary,
  tags,
  security: [{ bearerAuth: [] }],
  responses,
});

const idParameter = (name = 'id') => ({
  name,
  in: 'path',
  required: true,
  schema: { type: 'string' },
});

const crudPaths = (resource, tag, options = {}) => ({
  [`/api/${resource}`]: {
    get: secured(`Listar ${tag.toLowerCase()}`, [tag]),
    post: {
      ...secured(`Crear ${tag.toLowerCase()}`, [tag], {
        201: { description: 'Recurso creado' },
        400: { description: 'Datos invalidos' },
        401: { description: 'No autenticado' },
        403: { description: 'Permisos insuficientes' },
      }),
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object' } } },
      },
    },
  },
  [`/api/${resource}/{id}`]: {
    parameters: [idParameter()],
    get: secured(`Obtener ${tag.toLowerCase()}`, [tag]),
    put: {
      ...secured(`Actualizar ${tag.toLowerCase()}`, [tag], {
        200: { description: 'Recurso actualizado' },
        400: { description: 'Datos invalidos' },
        401: { description: 'No autenticado' },
        403: { description: 'Permisos insuficientes' },
      }),
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object' } } },
      },
    },
    delete: options.noDelete ? undefined : secured(`Eliminar ${tag.toLowerCase()}`, [tag], {
      200: { description: 'Recurso eliminado' },
      401: { description: 'No autenticado' },
      403: { description: 'Permisos insuficientes' },
    }),
  },
});

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'API de Inventario de Bienes Informaticos',
    version: '1.0.0',
    description: 'API REST para la gestion del inventario del Tribunal Constitucional del Peru.',
  },
  servers: [{ url: 'http://localhost:5000', description: 'Servidor local' }],
  tags: [
    { name: 'Health', description: 'Estado del servidor' },
    { name: 'Autenticacion', description: 'Inicio y cierre de sesion' },
    { name: 'Usuarios', description: 'Gestion de usuarios' },
    { name: 'Bienes', description: 'Gestion de bienes informaticos' },
    { name: 'Mantenimiento', description: 'Gestion de mantenimientos' },
    { name: 'Depreciacion', description: 'Gestion de depreciacion' },
    { name: 'Reportes', description: 'Reportes del sistema' },
  ],
  paths: {
    '/api/health': {
      get: {
        summary: 'Verificar estado del servidor',
        tags: ['Health'],
        responses: { 200: { description: 'Servidor funcionando correctamente' } },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Iniciar sesion',
        tags: ['Autenticacion'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: {
          200: { description: 'Sesion iniciada' },
          401: { description: 'Credenciales invalidas' },
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        summary: 'Renovar token de acceso',
        tags: ['Autenticacion'],
        responses: { 200: { description: 'Token renovado' } },
      },
    },
    '/api/auth/logout': {
      post: {
        summary: 'Cerrar sesion',
        tags: ['Autenticacion'],
        responses: { 200: { description: 'Sesion cerrada' } },
      },
    },
    '/api/auth/me': {
      get: secured('Consultar usuario autenticado', ['Autenticacion']),
    },
    ...crudPaths('usuarios', 'Usuarios'),
    ...crudPaths('bienes', 'Bienes'),
    '/api/mantenimiento': {
      get: secured('Listar mantenimientos', ['Mantenimiento']),
      post: {
        ...secured('Crear mantenimiento', ['Mantenimiento'], {
          201: { description: 'Mantenimiento creado' },
          400: { description: 'Datos invalidos' },
          401: { description: 'No autenticado' },
          403: { description: 'Permisos insuficientes' },
        }),
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
      },
    },
    '/api/mantenimiento/{id}': {
      parameters: [idParameter()],
      delete: secured('Eliminar mantenimiento', ['Mantenimiento'], {
        200: { description: 'Mantenimiento eliminado' },
        401: { description: 'No autenticado' },
        403: { description: 'Permisos insuficientes' },
      }),
    },
    '/api/depreciacion': {
      get: secured('Listar depreciacion', ['Depreciacion']),
      post: {
        ...secured('Crear depreciacion', ['Depreciacion'], {
          201: { description: 'Depreciacion creada' },
          400: { description: 'Datos invalidos' },
          401: { description: 'No autenticado' },
          403: { description: 'Permisos insuficientes' },
        }),
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
      },
    },
    '/api/mantenimiento/bien/{bienId}': {
      parameters: [idParameter('bienId')],
      get: secured('Listar mantenimientos de un bien', ['Mantenimiento']),
    },
    '/api/depreciacion/{bienId}': {
      parameters: [idParameter('bienId')],
      get: secured('Obtener depreciacion de un bien', ['Depreciacion']),
      put: secured('Actualizar depreciacion de un bien', ['Depreciacion']),
    },
    '/api/reportes/inventario': {
      get: secured('Generar reporte de inventario', ['Reportes']),
    },
    '/api/reportes/depreciacion': {
      get: secured('Generar reporte de depreciacion', ['Reportes']),
    },
    '/api/reportes/asignaciones': {
      get: secured('Generar reporte de asignaciones', ['Reportes']),
    },
    '/api/reportes/mantenimiento': {
      get: secured('Generar reporte de mantenimiento', ['Reportes']),
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
};

```

### Archivo: ./backend/middleware/auth.js
```javascript
import { verifyAccessToken, systemRoles } from '../utils/auth.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

export const requireRole = (...allowedRoles) => {
  const normalizedAllowed = allowedRoles.map((role) => role.toLowerCase());

  return (req, res, next) => {
    const userRole = (req.user?.rol || '').toLowerCase();

    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({ error: 'No tienes permisos para realizar esta acción' });
    }

    return next();
  };
};

export const allowSystemRoles = (...roles) => roles.filter((role) => systemRoles.includes(role));

```

### Archivo: ./backend/migrations/run.js
```javascript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const sql = postgres({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'inventario_bienes',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL || false,
  prepare: false, // <-- AÑADE ESTA LÍNEA AQUÍ TAMBIÉN
});

async function runMigrations() {
  try {
    await sql`SELECT 1`;
    console.log('✓ Conectado a PostgreSQL');

    const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    const statements = schema.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await sql.unsafe(statement);
      }
    }

    await sql.unsafe(`ALTER TABLE IF EXISTS usuarios ADD COLUMN IF NOT EXISTS password_hash TEXT`);
    await sql.unsafe(`ALTER TABLE IF EXISTS usuarios ADD COLUMN IF NOT EXISTS last_login TIMESTAMP`);
    await sql.unsafe(`ALTER TABLE IF EXISTS usuarios ADD COLUMN IF NOT EXISTS activo_login BOOLEAN DEFAULT TRUE`);

    console.log('✓ Migraciones ejecutadas correctamente');
  } catch (error) {
    console.error('✗ Error en migraciones:', error);
  } finally {
    await sql.end();
  }
}

runMigrations();

```

### Archivo: ./backend/migrations/schema.sql
```javascript
-- Tabla de Bienes Informáticos
CREATE TABLE IF NOT EXISTS bienes_informaticos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  tipo VARCHAR(100),
  marca VARCHAR(100),
  modelo VARCHAR(100),
  numero_serie VARCHAR(100) UNIQUE,
  fecha_adquisicion DATE NOT NULL,
  costo DECIMAL(12, 2) NOT NULL,
  usuario_asignado VARCHAR(255),
  estado VARCHAR(50) DEFAULT 'activo',
  ubicacion VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Mantenimiento y Repotenciación
CREATE TABLE IF NOT EXISTS mantenimiento (
  id SERIAL PRIMARY KEY,
  bien_id INTEGER NOT NULL REFERENCES bienes_informaticos(id) ON DELETE CASCADE,
  tipo VARCHAR(50),
  descripcion TEXT,
  fecha DATE NOT NULL,
  costo DECIMAL(12, 2),
  responsable VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  departamento VARCHAR(255),
  rol VARCHAR(50),
  password_hash TEXT,
  last_login TIMESTAMP,
  activo_login BOOLEAN DEFAULT TRUE,
  estado VARCHAR(50) DEFAULT 'activo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de sesiones de refresco JWT
CREATE TABLE IF NOT EXISTS auth_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);

-- Tabla de Depreciación
CREATE TABLE IF NOT EXISTS depreciacion (
  id SERIAL PRIMARY KEY,
  bien_id INTEGER NOT NULL REFERENCES bienes_informaticos(id) ON DELETE CASCADE,
  valor_inicial DECIMAL(12, 2),
  porcentaje_anual DECIMAL(5, 2) DEFAULT 20.0,
  valor_actual DECIMAL(12, 2),
  ano_actual INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Asignaciones
CREATE TABLE IF NOT EXISTS asignaciones (
  id SERIAL PRIMARY KEY,
  bien_id INTEGER NOT NULL REFERENCES bienes_informaticos(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha_asignacion DATE NOT NULL,
  fecha_devolucion DATE,
  observaciones TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Log de Auditoría
CREATE TABLE IF NOT EXISTS log_auditoria (
  id_log SERIAL PRIMARY KEY,
  fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  usuario VARCHAR(100) NOT NULL,
  accion VARCHAR(50) NOT NULL,
  modulo VARCHAR(100) NOT NULL,
  activo_afectado VARCHAR(255),
  ip_origen VARCHAR(45),
  resultado VARCHAR(50),
  datos_previos JSONB,
  datos_modificados JSONB
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_bienes_estado ON bienes_informaticos(estado);
CREATE INDEX IF NOT EXISTS idx_bienes_usuario ON bienes_informaticos(usuario_asignado);
CREATE INDEX IF NOT EXISTS idx_mantenimiento_bien ON mantenimiento(bien_id);
CREATE INDEX IF NOT EXISTS idx_asignaciones_bien ON asignaciones(bien_id);
CREATE INDEX IF NOT EXISTS idx_asignaciones_usuario ON asignaciones(usuario_id);

-- Índices para optimizar las consultas del Log de Auditoría
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON log_auditoria(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON log_auditoria(usuario);
CREATE INDEX IF NOT EXISTS idx_auditoria_modulo ON log_auditoria(modulo);
```

### Archivo: ./backend/package.json
```javascript
{
  "name": "inventario-bienes-informaticos-backend",
  "version": "1.0.0",
  "description": "Backend para sistema de gestión de inventario de bienes informáticos",
  "main": "server.js",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "migrate": "node migrations/run.js"
  },
  "keywords": [
    "inventario",
    "bienes",
    "informáticos",
    "tribunal"
  ],
  "author": "Clint Weslly Gutierrez Cruz",
  "license": "MIT",
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "date-fns": "^2.30.0",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "express-rate-limit": "^8.7.0",
    "helmet": "^8.3.0",
    "jsonwebtoken": "^9.0.2",
    "postgres": "^3.3.5",
    "swagger-ui-express": "^5.0.1",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}

```

### Archivo: ./backend/routes/auditoria.js
```javascript
import express from 'express';
import * as auditoriaController from '../controllers/auditoriaController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const createAuditoriaRouter = (sql) => {
  const router = express.Router();

  router.use(authenticateToken);
  router.get('/', requireRole('administrador', 'auditor'), (req, res) => auditoriaController.getAuditoria(req, res, sql));

  return router;
};
```

### Archivo: ./backend/routes/auth.js
```javascript
import express from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intenta de nuevo más tarde.' },
});

export const createAuthRouter = (sql) => {
  const router = express.Router();

  router.post('/login', loginLimiter, (req, res) => authController.login(req, res, sql));
  router.post('/refresh', (req, res) => authController.refresh(req, res, sql));
  router.post('/logout', (req, res) => authController.logout(req, res, sql));
  router.get('/me', authenticateToken, (req, res) => authController.me(req, res, sql));

  return router;
};

```

### Archivo: ./backend/routes/bienes.js
```javascript
import express from 'express';
import * as bienesController from '../controllers/bienesController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const createBienesRouter = (sql) => {
  const router = express.Router();

  router.use(authenticateToken);

  router.get('/', (req, res) => bienesController.getBienes(req, res, sql));
  router.get('/:id', (req, res) => bienesController.getBienById(req, res, sql));
  router.post('/', requireRole('administrador', 'jefatura'), (req, res) => bienesController.createBien(req, res, sql));
  router.put('/:id', requireRole('administrador', 'jefatura'), (req, res) => bienesController.updateBien(req, res, sql));
  router.delete('/:id', requireRole('administrador'), (req, res) => bienesController.deleteBien(req, res, sql));

  return router;
};

```

### Archivo: ./backend/routes/depreciacion.js
```javascript
import express from 'express';
import * as depreciacionController from '../controllers/depreciacionController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const createDepreciacionRouter = (sql) => {
  const router = express.Router();

  router.use(authenticateToken);

  router.get('/', (req, res) => depreciacionController.getDepreciacion(req, res, sql));
  router.get('/:bienId', (req, res) => depreciacionController.getDepreciacionPorBien(req, res, sql));
  router.post('/', requireRole('administrador', 'jefatura'), (req, res) => depreciacionController.crearDepreciacion(req, res, sql));
  router.put('/:bienId', requireRole('administrador', 'jefatura'), (req, res) => depreciacionController.actualizarDepreciacion(req, res, sql));

  return router;
};

```

### Archivo: ./backend/routes/mantenimiento.js
```javascript
import express from 'express';
import * as mantenimientoController from '../controllers/mantenimientoController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const createMantenimientoRouter = (sql) => {
  const router = express.Router();

  router.use(authenticateToken);

  router.get('/', (req, res) => mantenimientoController.getMantenimiento(req, res, sql));
  router.get('/bien/:bienId', (req, res) => mantenimientoController.getMantenimientoPorBien(req, res, sql));
  router.post('/', requireRole('administrador', 'jefatura', 'tecnico'), (req, res) => mantenimientoController.createMantenimiento(req, res, sql));
  router.delete('/:id', requireRole('administrador', 'jefatura'), (req, res) => mantenimientoController.deleteMantenimiento(req, res, sql));

  return router;
};

```

### Archivo: ./backend/routes/reportes.js
```javascript
import express from 'express';
import * as reportesController from '../controllers/reportesController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const createReportesRouter = (sql) => {
  const router = express.Router();

  // Verifica que el token sea válido
  router.use(authenticateToken);
  
  // Protege todas las rutas de reportes para los roles autorizados, incluyendo al nuevo auditor
  router.use(requireRole('administrador', 'jefatura', 'tecnico', 'auditor'));

  router.get('/inventario', (req, res) => reportesController.getReporteInventario(req, res, sql));
  router.get('/depreciacion', (req, res) => reportesController.getReporteDepreciacion(req, res, sql));
  router.get('/asignaciones', (req, res) => reportesController.getReporteAsignaciones(req, res, sql));
  router.get('/mantenimiento', (req, res) => reportesController.getReporteMantenimiento(req, res, sql));

  return router;
};
```

### Archivo: ./backend/routes/usuarios.js
```javascript
import express from 'express';
import * as usuariosController from '../controllers/usuariosController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const createUsuariosRouter = (sql) => {
  const router = express.Router();

  router.use(authenticateToken);

  router.get('/', requireRole('administrador', 'jefatura'), (req, res) => usuariosController.getUsuarios(req, res, sql));
  router.get('/:id', requireRole('administrador', 'jefatura'), (req, res) => usuariosController.getUsuarioById(req, res, sql));
  router.post('/', requireRole('administrador'), (req, res) => usuariosController.createUsuario(req, res, sql));
  router.put('/:id', requireRole('administrador'), (req, res) => usuariosController.updateUsuario(req, res, sql));
  router.delete('/:id', requireRole('administrador'), (req, res) => usuariosController.disableUsuario(req, res, sql));

  return router;
};

```

### Archivo: ./backend/server.js
```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import postgres from 'postgres';
import swaggerUi from 'swagger-ui-express';
import { createAuthRouter } from './routes/auth.js';
import { createBienesRouter } from './routes/bienes.js';
import { createMantenimientoRouter } from './routes/mantenimiento.js';
import { createDepreciacionRouter } from './routes/depreciacion.js';
import { createReportesRouter } from './routes/reportes.js';
import { createUsuariosRouter } from './routes/usuarios.js';
import { ensureAuthColumns, seedDefaultUsers } from './utils/auth.js';
import { openapiSpec } from './docs/openapi.js';
import { createAuditoriaRouter } from './routes/auditoria.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());


// Conexión a Base de Datos
const sql = postgres({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'inventario_bienes',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL || false,
  prepare: false, // <-- AÑADE ESTA LÍNEA
});

await ensureAuthColumns(sql);

if (process.env.NODE_ENV !== 'production' && process.env.SEED_DEFAULT_USERS !== 'false') {
  await seedDefaultUsers(sql);
}

console.log('✓ Conectado a PostgreSQL');

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor funcionando correctamente' });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
  customSiteTitle: 'API Inventario - Swagger',
}));

// Registrar rutas
app.use('/api/auth', createAuthRouter(sql));
app.use('/api/usuarios', createUsuariosRouter(sql));
app.use('/api/bienes', createBienesRouter(sql));
app.use('/api/mantenimiento', createMantenimientoRouter(sql));
app.use('/api/depreciacion', createDepreciacionRouter(sql));
app.use('/api/reportes', createReportesRouter(sql));
// ... más    abajo, junto a los otros app.use('/api/...'):
app.use('/api/auditoria', createAuditoriaRouter(sql));

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});

```

### Archivo: ./backend/utils/auth.js
```javascript
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const defaultUsers = [
  {
    nombre: 'Administrador General',
    email: 'admin@tc.pe',
    departamento: 'Tecnología de la Información',
    rol: 'administrador',
    password: 'Admin123!',
  },
  {
    nombre: 'Jefatura TI',
    email: 'jefatura@tc.pe',
    departamento: 'Tecnología de la Información',
    rol: 'jefatura',
    password: 'Jefe123!',
  },
  {
    nombre: 'Técnico de Soporte',
    email: 'tecnico@tc.pe',
    departamento: 'Soporte Técnico',
    rol: 'tecnico',
    password: 'Tecnico123!',
  },
  {
    nombre: 'Auditor OCI',
    email: 'auditor@tc.pe',
    departamento: 'Órgano de Control Institucional',
    rol: 'auditor',
    password: 'Auditor123!',
  },
];

export const systemRoles = ['administrador', 'jefatura', 'tecnico', 'auditor'];

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

export const seedDefaultUsers = async (sql) => {
  for (const user of defaultUsers) {
    const passwordHash = await hashPassword(user.password);

    await sql`
      INSERT INTO usuarios (nombre, email, departamento, rol, password_hash, activo_login, estado)
      VALUES (${user.nombre}, ${user.email}, ${user.departamento}, ${user.rol}, ${passwordHash}, TRUE, 'activo')
      ON CONFLICT (email)
      DO UPDATE SET
        nombre = EXCLUDED.nombre,
        departamento = EXCLUDED.departamento,
        rol = EXCLUDED.rol,
        password_hash = EXCLUDED.password_hash,
        activo_login = TRUE,
        estado = 'activo'
    `;
  }
};

export const ensureAuthColumns = async (sql) => {
  await sql.unsafe(`ALTER TABLE IF EXISTS usuarios ADD COLUMN IF NOT EXISTS password_hash TEXT`);
  await sql.unsafe(`ALTER TABLE IF EXISTS usuarios ADD COLUMN IF NOT EXISTS last_login TIMESTAMP`);
  await sql.unsafe(`ALTER TABLE IF EXISTS usuarios ADD COLUMN IF NOT EXISTS activo_login BOOLEAN DEFAULT TRUE`);
};

```

### Archivo: ./frontend/index.html
```javascript
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sistema de Gestión de Inventario - Bienes Informáticos</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>

```

### Archivo: ./frontend/package.json
```javascript
{
  "name": "inventario-bienes-informaticos-frontend",
  "version": "1.0.0",
  "description": "Frontend para sistema de gestión de inventario de bienes informáticos",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "axios": "^1.6.0",
    "date-fns": "^2.30.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.3.6",
    "postcss": "^8.4.31",
    "autoprefixer": "^10.4.16"
  }
}

```

### Archivo: ./frontend/postcss.config.js
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

```

### Archivo: ./frontend/src/App.css
```javascript
#root {
	min-height: 100vh;
}

```

### Archivo: ./frontend/src/App.jsx
```javascript
import { useEffect, useMemo, useState } from 'react';
import './App.css';
import * as api from './services/api';
import NavBar from './components/NavBar';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import InventarioList from './components/InventarioList';
import Mantenimiento from './components/Mantenimiento';
import Reportes from './components/Reportes';
import Login from './components/Login';
import Usuarios from './components/Usuarios';
import AuditoriaList from './components/AuditoriaList';

const rolePermissions = {
  administrador: {
    canCreateAssets: true,
    canEditAssets: true,
    canDeleteAssets: true,
    canCreateMaintenance: true,
    canDeleteMaintenance: true,
    canManageUsers: true,
  },
  jefatura: {
    canCreateAssets: true,
    canEditAssets: true,
    canDeleteAssets: false,
    canCreateMaintenance: true,
    canDeleteMaintenance: true,
    canManageUsers: false,
  },
  tecnico: {
    canCreateAssets: false,
    canEditAssets: false,
    canDeleteAssets: false,
    canCreateMaintenance: true,
    canDeleteMaintenance: false,
    canManageUsers: false,
  },
  auditor: {
    canCreateAssets: false,
    canEditAssets: false,
    canDeleteAssets: false,
    canCreateMaintenance: false,
    canDeleteMaintenance: false,
    canManageUsers: false,
  },
};

function App() {
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bienes, setBienes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const role = currentUser?.rol || 'tecnico';
  const permissions = rolePermissions[role] || rolePermissions.tecnico;

  useEffect(() => {
    const bootstrapAuth = async () => {
     try {
        const response = await api.refreshSession();
        const token = response.data?.token;
        if (token) api.setAuthToken(token);
        
        setCurrentUser(response.data.user);
        // NUEVO: Redirigir si es auditor
        if (response.data.user.rol === 'auditor') {
          setCurrentView('auditoria');
        }
      }
      catch (error) {
        api.clearAuthToken();
        setCurrentUser(null);
      } 
      finally {
        setAuthReady(true);
      }
    };

    bootstrapAuth();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const bienesResponse = await api.getBienes();
        setBienes(bienesResponse.data);

        if (permissions.canManageUsers) {
          const usuariosResponse = await api.getUsuarios();
          setUsuarios(usuariosResponse.data);
        } else {
          setUsuarios([]);
        }
      } catch (error) {
        console.error('Error cargando datos iniciales:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser, permissions.canManageUsers]);

  const fetchBienes = async () => {
    const response = await api.getBienes();
    setBienes(response.data);
  };

  const fetchUsuarios = async () => {
    const response = await api.getUsuarios();
    setUsuarios(response.data);
  };

  const handleLogin = async (email, password) => {
    setAuthLoading(true);
    setAuthError('');

    try {
      const response = await api.login({ email, password });
      api.setAuthToken(response.data.token);
      setCurrentUser(response.data.user);
      
      // NUEVO: Validar vista según rol
      setCurrentView(response.data.user.rol === 'auditor' ? 'auditoria' : 'dashboard');
      setSidebarOpen(false);
    }
    catch (error) {
      setAuthError(error?.response?.data?.error || 'No se pudo iniciar sesión');
    } 
    finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    api.logout().catch(() => {});
    api.clearAuthToken();
    setCurrentUser(null);
    setBienes([]);
    setUsuarios([]);
    setCurrentView('dashboard');
    setSidebarOpen(false);
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard bienes={bienes} currentUser={currentUser} />;
      case 'inventario':
        return (
          <InventarioList
            bienes={bienes}
            onRefresh={fetchBienes}
            canCreate={permissions.canCreateAssets}
            canEdit={permissions.canEditAssets}
            canDelete={permissions.canDeleteAssets}
          />
        );
      case 'mantenimiento':
        return (
          <Mantenimiento
            bienes={bienes}
            canCreate={permissions.canCreateMaintenance}
            canDelete={permissions.canDeleteMaintenance}
          />
        );
      case 'reportes':
        return <Reportes currentUser={currentUser} />;
      case 'usuarios':
        return <Usuarios usuarios={usuarios} onRefresh={fetchUsuarios} currentUser={currentUser} />;
      case 'auditoria':
        return <AuditoriaList />;
      default:
        return <Dashboard bienes={bienes} currentUser={currentUser} />;
    }
  };

  const viewLabels = {
    dashboard: {
      title: 'Dashboard ejecutivo',
      description: 'Resumen general del inventario, mantenimiento y reportes',
    },
    inventario: {
      title: 'Inventario de bienes',
      description: 'Alta, edición y control de activos informáticos',
    },
    mantenimiento: {
      title: 'Mantenimiento',
      description: 'Seguimiento de servicios preventivos y correctivos',
    },
    reportes: {
      title: 'Reportes',
      description: 'Indicadores y exportación de información',
    },
    usuarios: {
      title: 'Gestión de usuarios',
      description: 'Administración de accesos, roles y credenciales',
    },
    auditoria: {
      title: 'Log de Auditoría',
      description: 'Historial inmutable de eventos y operaciones del sistema',
    },
  };

  const currentMeta = viewLabels[currentView] || viewLabels.dashboard;

  const logout = useMemo(() => handleLogout, []);

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-10 text-center shadow-2xl backdrop-blur">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-cyan-400" />
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Cargando sesión</p>
          <p className="mt-2 text-sm text-slate-300">Preparando el panel de control</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} loading={authLoading} error={authError} />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.16),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] text-slate-900">
      <NavBar
        currentUser={currentUser}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onLogout={logout}
        searchValue={searchValue}
        onSearchValueChange={setSearchValue}
        title={currentMeta.title}
        description={currentMeta.description}
      />

      <div className="mx-auto flex max-w-[1800px] gap-6 px-4 pb-6 pt-4 lg:px-6">
        <Sidebar
          isOpen={sidebarOpen}
          currentView={currentView}
          onViewChange={setCurrentView}
          onCloseSidebar={() => setSidebarOpen(false)}
          currentUser={currentUser}
        />

        <main className="min-w-0 flex-1">
          <div className="mb-6 rounded-[28px] border border-white/70 bg-white/70 px-6 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">Tribunal Constitucional del Perú</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 lg:text-3xl">{currentMeta.title}</h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">{currentMeta.description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-emerald-700">
                  {loading ? 'Sincronizando datos' : 'Sistema operativo'}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm">
                  {new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm">
                  {currentUser.nombre} · {currentUser.rol}
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-[calc(100vh-210px)] rounded-[32px] border border-white/70 bg-white/60 p-4 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur lg:p-6">
            {loading ? (
              <div className="flex min-h-[420px] items-center justify-center">
                <div className="rounded-3xl border border-slate-200 bg-white px-8 py-10 text-center shadow-lg">
                  <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
                  <p className="text-sm font-semibold text-slate-700">Cargando datos...</p>
                  <p className="mt-1 text-sm text-slate-500">Actualizando información del inventario</p>
                </div>
              </div>
            ) : (
              renderView()
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
```

### Archivo: ./frontend/src/components/AuditoriaList.jsx
```javascript
import { useState, useEffect } from 'react';
import * as api from '../services/api';

export default function AuditoriaList() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // NUEVO: Estado para controlar la ventana emergente (Pasos 5 y 6)
  const [logSeleccionado, setLogSeleccionado] = useState(null);
  
  const [filtros, setFiltros] = useState({
    desde: '', hasta: '', usuario: '', modulo: '', accion: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFiltros(prev => ({ ...prev, [name]: value }));
  };

  const buscarLogs = async (e) => {
    if (e) e.preventDefault();
    
    if (filtros.desde && filtros.hasta && new Date(filtros.hasta) < new Date(filtros.desde)) {
      alert("El rango de fechas ingresado no es valido. Verifique los parametros de busqueda");
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await api.getAuditoria(filtros);
      setLogs(response.data || []);
      
      if (response.data?.length === 0) {
        setError("No se encontraron registros de auditoria para los criterios especificados");
      }
    } catch (err) {
      if (err.response?.status === 408) {
        setError("La consulta excede el limite de procesamiento. Por favor refine los filtros aplicados");
      } else {
        setError("Ocurrió un error al consultar el log de auditoría.");
      }
    } finally {
      setLoading(false);
    }
  };

  // NUEVO: Función para exportar la auditoría (Pasos 7, 8 y 9)
  const exportarAuditoria = () => {
    if (logs.length === 0) return alert("No hay datos para exportar");
    
    const headers = ["Fecha", "Usuario", "Accion", "Modulo", "IP Origen", "Resultado"];
    const csv = [
      headers.join(','),
      ...logs.map(log => [
        new Date(log.fecha_hora).toLocaleString('es-PE').replace(/,/g, ''),
        log.usuario,
        log.accion,
        log.modulo,
        log.ip_origen,
        log.resultado
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Log_Auditoria_${new Date().getTime()}.csv`;
    a.click();
  };

  useEffect(() => {
    buscarLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">Seguridad y Administración</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Log de Auditoría</h2>
          <p className="mt-2 text-sm text-slate-500">Consulta la trazabilidad inmutable de las operaciones realizadas en el sistema.</p>
        </div>
        {/* NUEVO: Botón de exportación */}
        <button onClick={exportarAuditoria} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-2">
          <span>📥</span> Exportar Excel/CSV
        </button>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={buscarLogs} className="space-y-4">
           {/* ... (Mantén tus inputs de filtros exactamente igual que antes) ... */}
           <div className="grid gap-4 md:grid-cols-5">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Desde</span>
              <input type="date" name="desde" value={filtros.desde} onChange={handleInputChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Hasta</span>
              <input type="date" name="hasta" value={filtros.hasta} onChange={handleInputChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Usuario</span>
              <input type="text" name="usuario" placeholder="Nombre..." value={filtros.usuario} onChange={handleInputChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Módulo</span>
              <select name="modulo" value={filtros.modulo} onChange={handleInputChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100">
                <option value="">Todos</option>
                <option value="Usuarios">Usuarios</option>
                <option value="Bienes">Bienes</option>
                <option value="Mantenimiento">Mantenimiento</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Acción</span>
              <select name="accion" value={filtros.accion} onChange={handleInputChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100">
                <option value="">Todas</option>
                <option value="Creación">Creación</option>
                <option value="Edición">Edición</option>
                <option value="Eliminación">Eliminación</option>
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setFiltros({ desde: '', hasta: '', usuario: '', modulo: '', accion: '' })} className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Limpiar</button>
            <button type="submit" disabled={loading} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{loading ? 'Consultando...' : 'Aplicar Filtros'}</button>
          </div>
        </form>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 text-center">
          {error}
        </div>
      )}

      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="text-left text-xs uppercase tracking-[0.2em] text-slate-400">
              <tr>
                <th className="px-4 py-4">Fecha y Hora</th>
                <th className="px-4 py-4">Usuario</th>
                <th className="px-4 py-4">Acción</th>
                <th className="px-4 py-4">Módulo</th>
                <th className="px-4 py-4">IP Origen</th>
                <th className="px-4 py-4">Resultado</th>
                <th className="px-4 py-4 text-center">Detalle</th> {/* NUEVA COLUMNA */}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id_log || log.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-4 text-sm font-medium text-slate-900">{new Date(log.fecha_hora).toLocaleString('es-PE')}</td>
                  <td className="px-4 py-4 text-sm text-slate-600">{log.usuario}</td>
                  <td className="px-4 py-4 text-sm"><span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">{log.accion}</span></td>
                  <td className="px-4 py-4 text-sm text-slate-600">{log.modulo}</td>
                  <td className="px-4 py-4 text-sm text-slate-500 font-mono">{log.ip_origen}</td>
                  <td className="px-4 py-4 text-sm">
                    <span className={`font-semibold ${log.resultado === 'Éxito' ? 'text-emerald-600' : 'text-rose-600'}`}>{log.resultado}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    {/* NUEVO: Botón para abrir modal */}
                    <button onClick={() => setLogSeleccionado(log)} className="text-blue-600 hover:text-blue-800 font-semibold text-sm px-3 py-1 rounded bg-blue-50 transition">
                      Inspeccionar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* NUEVO: Ventana Emergente (Modal) para el Detalle del Evento (Paso 6) */}
      {logSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[32px] bg-white p-8 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Detalle de Operación</h3>
                <p className="text-sm text-slate-500 mt-1">ID Transacción: {logSeleccionado.id_log || logSeleccionado.id}</p>
              </div>
              <button onClick={() => setLogSeleccionado(null)} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200">
                ✕
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-slate-500 font-medium">Actor</p>
                <p className="font-semibold text-slate-900 mt-1">{logSeleccionado.usuario}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-slate-500 font-medium">Fecha Exacta</p>
                <p className="font-semibold text-slate-900 mt-1">{new Date(logSeleccionado.fecha_hora).toLocaleString('es-PE')}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6">
              <div>
                <p className="font-semibold text-slate-700 mb-2">Datos Modificados (Nuevos):</p>
                <pre className="rounded-xl bg-slate-950 p-4 text-sm text-emerald-400 overflow-x-auto font-mono">
                  {logSeleccionado.datos_modificados ? JSON.stringify(logSeleccionado.datos_modificados, null, 2) : 'Sin datos registrados'}
                </pre>
              </div>
              <div>
                <p className="font-semibold text-slate-700 mb-2">Datos Previos (Anteriores):</p>
                <pre className="rounded-xl bg-slate-950 p-4 text-sm text-rose-400 overflow-x-auto font-mono">
                  {logSeleccionado.datos_previos ? JSON.stringify(logSeleccionado.datos_previos, null, 2) : 'Sin datos previos (Aplica para creación)'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Archivo: ./frontend/src/components/Dashboard.jsx
```javascript
export default function Dashboard({ bienes, currentUser }) {
  const totalBienes = bienes.length;
  const bienesActivos = bienes.filter(b => b.estado === 'activo').length;
  const bienesInactivos = bienes.filter(b => b.estado !== 'activo').length;
  const valorTotal = bienes.reduce((sum, b) => sum + (Number(b.costo) || 0), 0);
  const porcentajeActivos = totalBienes > 0 ? Math.round((bienesActivos / totalBienes) * 100) : 0;
  const valorPromedio = totalBienes > 0 ? valorTotal / totalBienes : 0;
  const equipamientoCritico = bienes.filter(b => (b.tipo || '').toLowerCase().includes('servidor') || (b.tipo || '').toLowerCase().includes('laptop')).length;

  const cards = [
    {
      title: 'Total de Bienes',
      value: totalBienes,
      icon: '📦',
      accent: 'from-blue-500 to-cyan-400',
      helper: 'Inventario registrado',
      trend: `${totalBienes} activos en control`,
    },
    {
      title: 'Activos',
      value: bienesActivos,
      icon: '✅',
      accent: 'from-emerald-500 to-green-400',
      helper: 'Disponibles para uso',
      trend: `${porcentajeActivos}% del total`,
    },
    {
      title: 'Inactivos',
      value: bienesInactivos,
      icon: '🛑',
      accent: 'from-rose-500 to-orange-400',
      helper: 'Fuera de operación',
      trend: `${totalBienes > 0 ? Math.round((bienesInactivos / totalBienes) * 100) : 0}% del total`,
    },
    {
      title: 'Valor Total',
      value: `S/ ${valorTotal.toFixed(2)}`,
      icon: '💰',
      accent: 'from-violet-500 to-fuchsia-400',
      helper: 'Valor patrimonial',
      trend: `Promedio S/ ${valorPromedio.toFixed(2)}`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-slate-950 text-white shadow-[0_25px_70px_rgba(15,23,42,0.18)]">
          <div className="relative px-8 py-8 sm:px-10 sm:py-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.24),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(99,102,241,0.2),_transparent_28%)]" />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-blue-200">Resumen ejecutivo</p>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Panel de control del inventario</h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                  Monitorea activos, estado operativo y valor patrimonial con una vista limpia y compacta al estilo TailAdmin.
                </p>
                <div className="mt-5 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
                  Sesión: {currentUser?.nombre} · {currentUser?.rol}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:min-w-[280px]">
                <div className="rounded-3xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
                  <p className="text-xs text-slate-300">Activos</p>
                  <p className="mt-2 text-2xl font-semibold">{porcentajeActivos}%</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
                  <p className="text-xs text-slate-300">Críticos</p>
                  <p className="mt-2 text-2xl font-semibold">{equipamientoCritico}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-500">Disponibilidad</p>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Operativo</span>
            </div>
            <div className="mt-5 flex items-end justify-between">
              <div>
                <p className="text-4xl font-semibold text-slate-950">{porcentajeActivos}%</p>
                <p className="mt-2 text-sm text-slate-500">de los bienes están activos</p>
              </div>
              <div className="h-20 w-20 rounded-full border-[10px] border-slate-100 border-t-blue-500 rotate-[-45deg]" />
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Valor promedio</p>
            <p className="mt-4 text-4xl font-semibold text-slate-950">S/ {valorPromedio.toFixed(2)}</p>
            <p className="mt-2 text-sm text-slate-500">Base para depreciación y auditoría</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, index) => (
          <div
            key={index}
            className="group rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="flex items-start justify-between mb-5">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent} text-xl text-white shadow-lg`}>
                {card.icon}
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition group-hover:bg-slate-950 group-hover:text-white">
                {card.trend}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500">{card.title}</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">{card.value}</p>
            <p className="mt-3 text-sm text-slate-500">{card.helper}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-950">Actividad reciente</h3>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Últimos eventos</span>
          </div>
          <div className="mt-6 space-y-4">
            {[
              { title: 'Sincronización de inventario', detail: 'Actualización de bienes y metadatos', tone: 'bg-blue-500' },
              { title: 'Control de mantenimiento', detail: 'Registro y seguimiento de servicios', tone: 'bg-emerald-500' },
              { title: 'Exportación de reportes', detail: 'Datos listos para auditoría', tone: 'bg-violet-500' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className={`mt-1 h-3 w-3 rounded-full ${item.tone}`} />
                <div>
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Estado del sistema</h3>
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">Operativo</span>
          </div>
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <span className="text-sm text-slate-300">Versión</span>
              <span className="font-semibold">1.0.0</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <span className="text-sm text-slate-300">Base de datos</span>
              <span className="font-semibold">PostgreSQL</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <span className="text-sm text-slate-300">Tiempo de respuesta</span>
              <span className="font-semibold">&lt; 1s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

```

### Archivo: ./frontend/src/components/InventarioList.jsx
```javascript
import { useState } from 'react';
import * as api from '../services/api';

export default function InventarioList({ bienes, onRefresh, canCreate, canEdit, canDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    tipo: '',
    marca: '',
    modelo: '',
    numeroSerie: '',
    fechaAdquisicion: '',
    costo: '',
    usuarioAsignado: '',
    ubicacion: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      descripcion: '',
      tipo: '',
      marca: '',
      modelo: '',
      numeroSerie: '',
      fechaAdquisicion: '',
      costo: '',
      usuarioAsignado: '',
      ubicacion: '',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await api.updateBien(editingId, formData);
      } else {
        await api.createBien(formData);
      }
      resetForm();
      onRefresh();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar el bien');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (bien) => {
    setFormData({
      nombre: bien.nombre,
      descripcion: bien.descripcion,
      tipo: bien.tipo,
      marca: bien.marca,
      modelo: bien.modelo,
      numeroSerie: bien.numero_serie,
      fechaAdquisicion: bien.fecha_adquisicion,
      costo: bien.costo,
      usuarioAsignado: bien.usuario_asignado,
      ubicacion: bien.ubicacion,
    });
    setEditingId(bien.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este bien?')) {
      setLoading(true);
      try {
        await api.deleteBien(id);
        onRefresh();
      } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar el bien');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Inventario de Bienes</h1>
          <p className="text-slate-600 mt-2">Total: {bienes.length} equipos</p>
        </div>
        {canCreate ? (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
            disabled={loading}
          >
            <span>➕</span> Agregar Equipo
          </button>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
            Modo lectura para tu perfil
          </div>
        )}
      </div>

      {/* Formulario */}
      {showForm && canCreate && (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 overflow-hidden">
          <h3 className="text-xl font-bold text-slate-900 mb-6">
            {editingId ? 'Editar Bien' : 'Registrar Nuevo Bien'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nombre *</label>
                <input
                  type="text"
                  name="nombre"
                  placeholder="Nombre del equipo"
                  value={formData.nombre}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tipo *</label>
                <select
                  name="tipo"
                  value={formData.tipo}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  required
                >
                  <option value="">Selecciona tipo</option>
                  <option value="computadora">Computadora</option>
                  <option value="laptop">Laptop</option>
                  <option value="impresora">Impresora</option>
                  <option value="servidor">Servidor</option>
                  <option value="monitor">Monitor</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Marca</label>
                <input
                  type="text"
                  name="marca"
                  placeholder="Marca"
                  value={formData.marca}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Modelo</label>
                <input
                  type="text"
                  name="modelo"
                  placeholder="Modelo"
                  value={formData.modelo}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Serie</label>
                <input
                  type="text"
                  name="numeroSerie"
                  placeholder="Número de serie"
                  value={formData.numeroSerie}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Descripción</label>
              <textarea
                name="descripcion"
                placeholder="Descripción del equipo"
                value={formData.descripcion}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                rows="3"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Fecha de Adquisición *</label>
                <input
                  type="date"
                  name="fechaAdquisicion"
                  value={formData.fechaAdquisicion}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Costo (S/) *</label>
                <input
                  type="number"
                  name="costo"
                  placeholder="0.00"
                  step="0.01"
                  value={formData.costo}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Usuario Asignado</label>
                <input
                  type="text"
                  name="usuarioAsignado"
                  placeholder="Usuario o departamento"
                  value={formData.usuarioAsignado}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Ubicación</label>
                <input
                  type="text"
                  name="ubicacion"
                  placeholder="Ubicación física"
                  value={formData.ubicacion}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-200">
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? '⏳ Guardando...' : '💾 Guardar'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-slate-300 hover:bg-slate-400 text-slate-800 px-6 py-2.5 rounded-lg font-semibold transition-all duration-200"
              >
                ✕ Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
              <tr>
                <th className="px-6 py-4 text-left font-semibold">Equipo</th>
                <th className="px-6 py-4 text-left font-semibold">Tipo</th>
                <th className="px-6 py-4 text-left font-semibold">Marca/Modelo</th>
                <th className="px-6 py-4 text-right font-semibold">Costo</th>
                <th className="px-6 py-4 text-left font-semibold">Asignado a</th>
                <th className="px-6 py-4 text-center font-semibold">Estado</th>
                <th className="px-6 py-4 text-center font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {bienes && bienes.length > 0 ? (
                bienes.map(bien => (
                  <tr key={bien.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 font-medium text-slate-900">{bien.nombre}</td>
                    <td className="px-6 py-4 text-slate-600">
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                        {bien.tipo}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-sm">
                      {bien.marca || '-'} {bien.modelo ? `/ ${bien.modelo}` : ''}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900">
                      S/ {(Number(bien.costo) || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {bien.usuario_asignado || <span className="text-slate-400">Sin asignar</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                        bien.estado === 'activo'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {bien.estado === 'activo' ? '✓ Activo' : '✕ Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex gap-2 justify-center">
                        {canEdit && (
                          <button
                            onClick={() => handleEdit(bien)}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1 rounded transition font-semibold text-sm"
                            disabled={loading}
                          >
                            ✏️ Editar
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(bien.id)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded transition font-semibold text-sm"
                            disabled={loading}
                          >
                            🗑️ Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-slate-500">
                    <span className="text-2xl">📭</span>
                    <p className="mt-2">No hay bienes registrados</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

```

### Archivo: ./frontend/src/components/Login.jsx
```javascript
import { useState } from 'react';

export default function Login({ onLogin, loading, error }) {
  const [formData, setFormData] = useState({
    email: 'admin@tc.pe',
    password: 'Admin123!',
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onLogin(formData.email, formData.password);
  };

  const demoAccounts = [
    { role: 'Administrador', email: 'admin@tc.pe', password: 'Admin123!' },
    { role: 'Jefatura', email: 'jefatura@tc.pe', password: 'Jefe123!' },
    { role: 'Técnico', email: 'tecnico@tc.pe', password: 'Tecnico123!' },
    { role: 'Auditor', email: 'auditor@tc.pe', password: 'Auditor123!' }, // <- Nuevo
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.22),_transparent_30%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#111827_100%)] px-4 py-8 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl overflow-hidden rounded-[36px] border border-white/10 bg-white/5 shadow-[0_40px_120px_rgba(15,23,42,0.45)] backdrop-blur xl:grid-cols-[1.05fr_0.95fr]">
        <div className="relative overflow-hidden border-b border-white/10 px-8 py-10 sm:px-12 xl:border-b-0 xl:border-r">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.25),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(99,102,241,0.18),_transparent_28%)]" />
          <div className="relative flex h-full flex-col justify-between gap-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
                Sistema de control de activos
              </div>
              <h1 className="mt-8 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Gestión de inventario con acceso por roles y trazabilidad real.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
                Un panel administrativo para administrar bienes, mantenimiento, depreciación y usuarios con tokens JWT para administrador, jefatura y técnicos.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {['Autenticación JWT', 'Roles y permisos', 'Control de activos'].map((item) => (
                <div key={item} className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4 text-sm text-slate-200 shadow-lg">
                  {item}
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {demoAccounts.map((account) => (
                <div key={account.role} className="rounded-3xl border border-white/10 bg-slate-950/30 px-4 py-4 text-sm text-slate-200">
                  <p className="font-semibold text-white">{account.role}</p>
                  <p className="mt-1 text-slate-400">{account.email}</p>
                  <p className="text-slate-400">{account.password}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center px-6 py-10 sm:px-10">
          <form onSubmit={handleSubmit} className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-8 text-slate-900 shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">Bienvenido</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">Iniciar sesión</h2>
              <p className="mt-2 text-sm text-slate-500">Ingresa con una cuenta autorizada para administrar el sistema.</p>
            </div>

            <div className="mt-8 space-y-5">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Correo electrónico</span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder="usuario@tc.pe"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Contraseña</span>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder="••••••••"
                  required
                />
              </label>
            </div>

            {error && (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-blue-200 transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Ingresando...' : 'Acceder al sistema'}
            </button>

            <div className="mt-6 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Acceso controlado</p>
              <p className="mt-1">Las cuentas autorizadas se administran desde el backend y el acceso se renueva con cookie httpOnly.</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

```

### Archivo: ./frontend/src/components/Mantenimiento.jsx
```javascript
import { useState } from 'react';

export default function Mantenimiento({ bienes, canCreate, canDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [mantenimientos, setMantenimientos] = useState([]);
  const [formData, setFormData] = useState({
    bienId: '',
    tipo: 'preventivo',
    descripcion: '',
    fecha: '',
    costo: '',
    responsable: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      bienId: '',
      tipo: 'preventivo',
      descripcion: '',
      fecha: '',
      costo: '',
      responsable: '',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Implementar lógica de guardado
    resetForm();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">Gestión de Mantenimiento</h2>
        {canCreate ? (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            + Agregar Mantenimiento
          </button>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">Solo lectura para este rol</div>
        )}
      </div>

      {showForm && canCreate && (
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <select
                name="bienId"
                value={formData.bienId}
                onChange={handleInputChange}
                className="px-4 py-2 border rounded"
                required
              >
                <option value="">Selecciona el equipo</option>
                {bienes.map(bien => (
                  <option key={bien.id} value={bien.id}>
                    {bien.nombre} ({bien.tipo})
                  </option>
                ))}
              </select>

              <select
                name="tipo"
                value={formData.tipo}
                onChange={handleInputChange}
                className="px-4 py-2 border rounded"
                required
              >
                <option value="preventivo">Preventivo</option>
                <option value="correctivo">Correctivo</option>
                <option value="repotenciacion">Repotenciación</option>
              </select>
            </div>

            <textarea
              name="descripcion"
              placeholder="Descripción del mantenimiento"
              value={formData.descripcion}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border rounded"
            />

            <div className="grid grid-cols-3 gap-4">
              <input
                type="date"
                name="fecha"
                value={formData.fecha}
                onChange={handleInputChange}
                className="px-4 py-2 border rounded"
                required
              />

              <input
                type="number"
                name="costo"
                placeholder="Costo"
                value={formData.costo}
                onChange={handleInputChange}
                className="px-4 py-2 border rounded"
              />

              <input
                type="text"
                name="responsable"
                placeholder="Responsable"
                value={formData.responsable}
                onChange={handleInputChange}
                className="px-4 py-2 border rounded"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left">Equipo</th>
              <th className="px-6 py-3 text-left">Tipo</th>
              <th className="px-6 py-3 text-left">Descripción</th>
              <th className="px-6 py-3 text-left">Fecha</th>
              <th className="px-6 py-3 text-left">Costo</th>
              <th className="px-6 py-3 text-left">Responsable</th>
              <th className="px-6 py-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {mantenimientos.map(m => (
              <tr key={m.id} className="border-t hover:bg-gray-50">
                <td className="px-6 py-3">{m.equipoNombre}</td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-1 rounded text-sm ${
                    m.tipo === 'preventivo' ? 'bg-blue-100 text-blue-800' :
                    m.tipo === 'correctivo' ? 'bg-orange-100 text-orange-800' :
                    'bg-purple-100 text-purple-800'
                  }`}>
                    {m.tipo}
                  </span>
                </td>
                <td className="px-6 py-3">{m.descripcion}</td>
                <td className="px-6 py-3">{new Date(m.fecha).toLocaleDateString()}</td>
                <td className="px-6 py-3">S/ {m.costo?.toFixed(2)}</td>
                <td className="px-6 py-3">{m.responsable}</td>
                <td className="px-6 py-3">
                  <button className="text-blue-600 hover:text-blue-800 mr-4">
                    Editar
                  </button>
                  {canDelete && (
                    <button className="text-red-600 hover:text-red-800">
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

```

### Archivo: ./frontend/src/components/NavBar.jsx
```javascript
import { useEffect, useState } from 'react';

export default function NavBar({ currentUser, onToggleSidebar, onLogout, searchValue, onSearchValueChange, title, description }) {
  const [localSearch, setLocalSearch] = useState(searchValue || '');

  useEffect(() => {
    setLocalSearch(searchValue || '');
  }, [searchValue]);

  const handleSearch = (event) => {
    event.preventDefault();
    onSearchValueChange(localSearch);
  };

  return (
    <nav className="sticky top-0 z-30 border-b border-white/60 bg-white/75 text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1800px] items-center gap-4 px-4 py-4 lg:px-6">
        <button
          onClick={onToggleSidebar}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700 lg:hidden"
          title="Abrir menú"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-lg font-bold text-white shadow-lg shadow-blue-200 lg:flex">
          T
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-600">Sistema de Inventario</p>
          <h1 className="truncate text-lg font-semibold text-slate-900 lg:text-xl">{title}</h1>
          <p className="mt-0.5 hidden text-sm text-slate-500 lg:block">{description}</p>
        </div>

        <form onSubmit={handleSearch} className="hidden w-full max-w-xl lg:block">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar bienes, usuarios o reportes..."
              value={localSearch}
              onChange={(event) => setLocalSearch(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pl-11 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
            <svg className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </form>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-2 text-right shadow-sm sm:block">
            <p className="text-sm font-semibold text-slate-900">{currentUser.nombre}</p>
            <p className="text-xs text-slate-500 capitalize">{currentUser.rol}</p>
          </div>
          <button onClick={onLogout} className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-rose-200 hover:text-rose-700 sm:block">
            Salir
          </button>
          <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}

```

### Archivo: ./frontend/src/components/Reportes.jsx
```javascript
import { useState, useEffect } from 'react';
import * as api from '../services/api';

export default function Reportes() {
  const [reporteInventario, setReporteInventario] = useState(null);
  const [reporteDepreciacion, setReporteDepreciacion] = useState([]);
  const [reporteMantenimiento, setReporteMantenimiento] = useState([]);
  const [reporteAsignaciones, setReporteAsignaciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('inventario');

  useEffect(() => {
    fetchReportes();
  }, []);

  const fetchReportes = async () => {
    setLoading(true);
    try {
      const [inv, dep, man, asig] = await Promise.all([
        api.getReporteInventario(),
        api.getReporteDepreciacion(),
        api.getReporteMantenimiento(),
        api.getReporteAsignaciones(),
      ]);
      
      setReporteInventario(inv.data);
      setReporteDepreciacion(dep.data);
      setReporteMantenimiento(man.data);
      setReporteAsignaciones(asig.data);
    } catch (error) {
      console.error('Error fetching reportes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = (data, filename) => {
    if (!data || data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row => headers.map(h => row[h] || '').join(','))].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">Reportes</h2>
        <button
          onClick={fetchReportes}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b">
        {['inventario', 'depreciacion', 'mantenimiento', 'asignaciones'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium ${
              activeTab === tab
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Reporte de Inventario */}
      {activeTab === 'inventario' && reporteInventario && (
        <div>
          <h3 className="text-2xl font-bold mb-4">Reporte de Inventario</h3>
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
              <p className="text-gray-600 text-sm">Total de Bienes</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{reporteInventario.total_bienes}</p>
            </div>
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <p className="text-gray-600 text-sm">Activos</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{reporteInventario.activos}</p>
            </div>
            <div className="bg-red-50 p-6 rounded-lg border border-red-200">
              <p className="text-gray-600 text-sm">Inactivos</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{reporteInventario.inactivos}</p>
            </div>
            <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
              <p className="text-gray-600 text-sm">Valor Total</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">S/ {parseFloat(reporteInventario.valor_total || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Reporte de Depreciación */}
      {activeTab === 'depreciacion' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold">Reporte de Depreciación</h3>
            <button
              onClick={() => handleExportCSV(reporteDepreciacion, 'reporte-depreciacion')}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Exportar CSV
            </button>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left">Nombre</th>
                  <th className="px-6 py-3 text-left">Tipo</th>
                  <th className="px-6 py-3 text-left">Valor Inicial</th>
                  <th className="px-6 py-3 text-left">Valor Actual</th>
                  <th className="px-6 py-3 text-left">Depreciación</th>
                  <th className="px-6 py-3 text-left">% Depreciación</th>
                </tr>
              </thead>
              <tbody>
                {reporteDepreciacion.map(item => (
                  <tr key={item.id} className="border-t hover:bg-gray-50">
                    <td className="px-6 py-3">{item.nombre}</td>
                    <td className="px-6 py-3">{item.tipo}</td>
                    <td className="px-6 py-3">S/ {parseFloat(item.valor_inicial || 0).toFixed(2)}</td>
                    <td className="px-6 py-3">S/ {parseFloat(item.valor_actual || 0).toFixed(2)}</td>
                    <td className="px-6 py-3">S/ {parseFloat(item.depreciacion_total || 0).toFixed(2)}</td>
                    <td className="px-6 py-3">{parseFloat(item.porcentaje_depreciacion || 0).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reporte de Mantenimiento */}
      {activeTab === 'mantenimiento' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold">Reporte de Mantenimiento</h3>
            <button
              onClick={() => handleExportCSV(reporteMantenimiento, 'reporte-mantenimiento')}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Exportar CSV
            </button>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left">Equipo</th>
                  <th className="px-6 py-3 text-left">Tipo</th>
                  <th className="px-6 py-3 text-left">Mantenimientos</th>
                  <th className="px-6 py-3 text-left">Costo Total</th>
                  <th className="px-6 py-3 text-left">Último Mantenimiento</th>
                </tr>
              </thead>
              <tbody>
                {reporteMantenimiento.map((item, idx) => (
                  <tr key={idx} className="border-t hover:bg-gray-50">
                    <td className="px-6 py-3">{item.nombre}</td>
                    <td className="px-6 py-3">{item.tipo}</td>
                    <td className="px-6 py-3">{item.cantidad_mantenimientos || 0}</td>
                    <td className="px-6 py-3">S/ {parseFloat(item.costo_total_mantenimiento || 0).toFixed(2)}</td>
                    <td className="px-6 py-3">{item.ultimo_mantenimiento ? new Date(item.ultimo_mantenimiento).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reporte de Asignaciones */}
      {activeTab === 'asignaciones' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold">Reporte de Asignaciones</h3>
            <button
              onClick={() => handleExportCSV(reporteAsignaciones, 'reporte-asignaciones')}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Exportar CSV
            </button>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left">Usuario</th>
                  <th className="px-6 py-3 text-left">Cantidad de Equipos</th>
                  <th className="px-6 py-3 text-left">Equipos</th>
                </tr>
              </thead>
              <tbody>
                {reporteAsignaciones.map((item, idx) => (
                  <tr key={idx} className="border-t hover:bg-gray-50">
                    <td className="px-6 py-3">{item.usuario}</td>
                    <td className="px-6 py-3">{item.cantidad_equipos || 0}</td>
                    <td className="px-6 py-3 max-w-xs truncate">{item.equipos || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


```

### Archivo: ./frontend/src/components/Sidebar.jsx
```javascript
export default function Sidebar({ isOpen, onViewChange, currentView, onCloseSidebar, currentUser }) {
  const allMenuItems = [
 { id: 'dashboard', icon: '📊', label: 'Dashboard', description: 'Resumen ejecutivo', roles: ['administrador', 'jefatura', 'tecnico'] },
    { id: 'inventario', icon: '💻', label: 'Inventario', description: 'Gestión de bienes', roles: ['administrador', 'jefatura', 'tecnico'] },
    { id: 'mantenimiento', icon: '🔧', label: 'Mantenimiento', description: 'Control de servicios', roles: ['administrador', 'jefatura', 'tecnico'] },
    { id: 'reportes', icon: '📈', label: 'Reportes', description: 'Análisis y reportes', roles: ['administrador', 'jefatura', 'tecnico', 'auditor'] },
    { id: 'auditoria', icon: '🛡️', label: 'Auditoría', description: 'Registro de eventos', roles: ['administrador', 'auditor'] },
    { id: 'usuarios', icon: '👥', label: 'Usuarios', description: 'Accesos y roles', roles: ['administrador'] },
  ];

  const role = currentUser?.rol || 'tecnico';
  const menuItems = allMenuItems.filter((item) => item.roles.includes(role));

  const handleMenuClick = (viewId) => {
    onViewChange(viewId);
    onCloseSidebar();
  };

  return (
    <>
      <div className={`fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={onCloseSidebar} />

      <div className={`fixed left-4 top-4 z-50 flex h-[calc(100vh-2rem)] w-[280px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 text-white shadow-[0_30px_80px_rgba(15,23,42,0.25)] transition-transform duration-300 lg:sticky lg:top-6 lg:z-20 lg:flex lg:h-[calc(100vh-3rem)] lg:w-[286px] ${isOpen ? 'translate-x-0' : '-translate-x-[110%] lg:translate-x-0'}`}>
        <div className="border-b border-white/10 bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-950 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur-sm">📋</div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Inventario TPG</h2>
              <p className="text-xs text-blue-100/90">Panel administrativo</p>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Sesión activa</p>
            <p className="mt-2 text-sm font-medium text-white">{currentUser?.nombre}</p>
            <p className="text-xs text-slate-400 capitalize">{currentUser?.rol}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleMenuClick(item.id)}
              className={`group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition duration-200 ${currentView === item.id ? 'bg-white text-slate-950 shadow-lg shadow-black/10' : 'text-slate-300 hover:bg-white/8 hover:text-white'}`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-xl transition-transform group-hover:scale-105">{item.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{item.label}</p>
                <p className={`text-xs ${currentView === item.id ? 'text-slate-500' : 'text-slate-400'}`}>{item.description}</p>
              </div>
            </button>
          ))}
        </nav>

        <div className="mx-4 border-t border-white/10" />

        <div className="px-4 py-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">Herramientas</p>
          <button className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-slate-300 transition hover:bg-white/8 hover:text-white">
            <span>⚙️</span>
            <span>Configuración</span>
          </button>
        </div>

        <div className="border-t border-white/10 bg-white/5 p-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Última actualización</p>
            <p className="mt-2 text-sm font-medium text-white">Hace 2 minutos</p>
            <p className="mt-1 text-xs text-slate-400">v1.0.0 • {new Date().getFullYear()}</p>
          </div>
        </div>
      </div>
    </>
  );
}

```

### Archivo: ./frontend/src/components/Usuarios.jsx
```javascript
import { useEffect, useMemo, useState } from 'react';
import * as api from '../services/api';

const defaultForm = {
  nombre: '',
  email: '',
  departamento: '',
  rol: 'tecnico',
  estado: 'activo',
  activoLogin: true,
  password: '',
};

const roleLabels = {
  administrador: 'Administrador',
  jefatura: 'Jefatura',
  tecnico: 'Técnico',
  auditor: 'Auditor', // <- Nuevo
};

export default function Usuarios({ usuarios: initialUsuarios = [], onRefresh, currentUser }) {
  const [usuarios, setUsuarios] = useState(initialUsuarios);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState(defaultForm);

  useEffect(() => {
    setUsuarios(initialUsuarios);
  }, [initialUsuarios]);

  useEffect(() => {
    loadUsuarios();
  }, []);

  const loadUsuarios = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getUsuarios();
      setUsuarios(response.data);
      onRefresh?.();
    } catch (fetchError) {
      setError(fetchError?.response?.data?.error || 'No se pudieron cargar los usuarios');
    } finally {
      setLoading(false);
    }
  };

  const roleStats = useMemo(() => {
    return usuarios.reduce(
      (accumulator, user) => {
        const role = user.rol || 'tecnico';
        accumulator.total += 1;
        accumulator[role] = (accumulator[role] || 0) + 1;
        return accumulator;
      },
      { total: 0, administrador: 0, jefatura: 0, tecnico: 0, auditor: 0 }, // <- Agrega auditor: 0
    );
  }, [usuarios]);

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const resetForm = () => {
    setEditingId(null);
    setShowForm(false);
    setFormData(defaultForm);
  };

  const handleEdit = (usuario) => {
    setEditingId(usuario.id);
    setFormData({
      nombre: usuario.nombre || '',
      email: usuario.email || '',
      departamento: usuario.departamento || '',
      rol: usuario.rol || 'tecnico',
      estado: usuario.estado || 'activo',
      activoLogin: usuario.activo_login !== false,
      password: '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        nombre: formData.nombre,
        email: formData.email,
        departamento: formData.departamento,
        rol: formData.rol,
        estado: formData.estado,
        activoLogin: formData.activoLogin,
      };

      if (!editingId || formData.password) {
        payload.password = formData.password;
      }

      if (editingId) {
        await api.updateUsuario(editingId, payload);
      } else {
        await api.createUsuario({ ...payload, password: formData.password });
      }

      await loadUsuarios();
      resetForm();
    } catch (submitError) {
      setError(submitError?.response?.data?.error || 'No se pudo guardar el usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async (id) => {
    if (!window.confirm('¿Deseas deshabilitar este usuario?')) {
      return;
    }

    setSaving(true);
    setError('');
    try {
      await api.disableUsuario(id);
      await loadUsuarios();
    } catch (disableError) {
      setError(disableError?.response?.data?.error || 'No se pudo deshabilitar el usuario');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Total usuarios', value: roleStats.total, tone: 'from-blue-500 to-cyan-400' },
          { label: 'Administradores', value: roleStats.administrador, tone: 'from-violet-500 to-fuchsia-400' },
          { label: 'Jefaturas', value: roleStats.jefatura, tone: 'from-emerald-500 to-teal-400' },
          { label: 'Técnicos', value: roleStats.tecnico, tone: 'from-amber-500 to-orange-400' },
          { label: 'Auditores', value: roleStats.auditor, tone: 'from-rose-500 to-pink-400' },
        ].map((item) => (
          <div key={item.label} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{item.label}</p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <p className="text-4xl font-semibold tracking-tight text-slate-950">{item.value}</p>
              <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${item.tone}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">Usuarios del sistema</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Gestión de accesos y credenciales</h2>
          <p className="mt-2 text-sm text-slate-500">Solo administradores pueden crear, editar o deshabilitar cuentas.</p>
        </div>
        {currentUser?.rol === 'administrador' && (
          <button
            onClick={() => setShowForm((previous) => !previous)}
            className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:from-blue-700 hover:to-indigo-700"
          >
            {showForm ? 'Cerrar formulario' : 'Nuevo usuario'}
          </button>
        )}
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {showForm && currentUser?.rol === 'administrador' && (
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-950">{editingId ? 'Editar usuario' : 'Crear usuario'}</h3>
              <p className="mt-1 text-sm text-slate-500">{editingId ? 'Actualiza credenciales y rol.' : 'Asigna un acceso al sistema con rol específico.'}</p>
            </div>
            <button type="button" onClick={resetForm} className="text-sm font-semibold text-slate-500 hover:text-slate-900">Cerrar</button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Nombre</span>
                <input name="nombre" value={formData.nombre} onChange={handleInputChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100" required />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Email</span>
                <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100" required />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Departamento</span>
                <input name="departamento" value={formData.departamento} onChange={handleInputChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Rol</span>
                <select name="rol" value={formData.rol} onChange={handleInputChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100">
                  <option value="administrador">Administrador</option>
                  <option value="jefatura">Jefatura</option>
                  <option value="tecnico">Técnico</option>
                  <option value="auditor">Auditor</option>{/* <- Nueva opción */}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Estado</span>
                <select name="estado" value={formData.estado} onChange={handleInputChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100">
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Contraseña {editingId ? '(opcional)' : ''}</span>
                <input type="password" name="password" value={formData.password} onChange={handleInputChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100" placeholder={editingId ? 'Dejar en blanco para conservar' : 'Nueva contraseña'} required={!editingId} />
              </label>
              <label className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:mt-0">
                <input type="checkbox" name="activoLogin" checked={formData.activoLogin} onChange={handleInputChange} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm font-medium text-slate-700">Habilitar acceso al sistema</span>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={saving} className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60">
                {saving ? 'Guardando...' : 'Guardar usuario'}
              </button>
              <button type="button" onClick={resetForm} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="text-left text-xs uppercase tracking-[0.28em] text-slate-400">
              <tr>
                <th className="px-4 py-4">Nombre</th>
                <th className="px-4 py-4">Email</th>
                <th className="px-4 py-4">Departamento</th>
                <th className="px-4 py-4">Rol</th>
                <th className="px-4 py-4">Estado</th>
                <th className="px-4 py-4">Último acceso</th>
                <th className="px-4 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-10 text-center text-slate-500">Cargando usuarios...</td>
                </tr>
              ) : usuarios.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-10 text-center text-slate-500">No hay usuarios registrados</td>
                </tr>
              ) : (
                usuarios.map((usuario) => (
                  <tr key={usuario.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-4 font-medium text-slate-900">{usuario.nombre}</td>
                    <td className="px-4 py-4 text-slate-600">{usuario.email}</td>
                    <td className="px-4 py-4 text-slate-600">{usuario.departamento || '-'}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{roleLabels[usuario.rol] || usuario.rol}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${usuario.estado === 'activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {usuario.estado === 'activo' ? 'Activo' : 'Inactivo'}
                      </span>
                      <p className="mt-2 text-xs text-slate-500">{usuario.activo_login ? 'Acceso habilitado' : 'Acceso bloqueado'}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-500">{usuario.last_login ? new Date(usuario.last_login).toLocaleString('es-PE') : 'Sin acceso registrado'}</td>
                    <td className="px-4 py-4">
                      {currentUser?.rol === 'administrador' ? (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleEdit(usuario)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700">
                            Editar
                          </button>
                          <button onClick={() => handleDisable(usuario.id)} className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50" disabled={saving}>
                            Deshabilitar
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">Solo lectura</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

```

### Archivo: ./frontend/src/index.css
```javascript
@tailwind base;
@tailwind components;
@tailwind utilities;

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  font-family: Inter, 'Segoe UI Variable', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #0f172a;
  background: #f8fafc;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}

* {
  box-sizing: border-box;
}

::selection {
  background: rgba(59, 130, 246, 0.2);
}

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.5);
  border-radius: 9999px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

```

### Archivo: ./frontend/src/main.jsx
```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

```

### Archivo: ./frontend/src/services/api.js
```javascript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
});

let accessToken = null;
let refreshPromise = null;

const isAuthEndpoint = (url = '') => url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout');

const syncAuthorizationHeader = () => {
  if (accessToken) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
};

export const setAuthToken = (token) => {
  accessToken = token || null;
  syncAuthorizationHeader();
};

export const clearAuthToken = () => {
  accessToken = null;
  syncAuthorizationHeader();
};

export const refreshSession = async () => {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post('/auth/refresh')
      .then((response) => {
        if (response.data?.token) {
          setAuthToken(response.data.token);
        }

        return response;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};

    if (error?.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint(originalRequest.url)) {
      originalRequest._retry = true;

      try {
        const response = await refreshSession();
        const newToken = response.data?.token;

        if (newToken) {
          originalRequest.headers = {
            ...(originalRequest.headers || {}),
            Authorization: `Bearer ${newToken}`,
          };
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        clearAuthToken();
        return Promise.reject(refreshError);
      }

      clearAuthToken();
    }

    return Promise.reject(error);
  },
);

// Auth
export const login = (credentials) => apiClient.post('/auth/login', credentials);
export const getMe = () => apiClient.get('/auth/me');
export const logout = () => apiClient.post('/auth/logout');

// Usuarios
export const getUsuarios = () => apiClient.get('/usuarios');
export const getUsuarioById = (id) => apiClient.get(`/usuarios/${id}`);
export const createUsuario = (data) => apiClient.post('/usuarios', data);
export const updateUsuario = (id, data) => apiClient.put(`/usuarios/${id}`, data);
export const disableUsuario = (id) => apiClient.delete(`/usuarios/${id}`);

// Bienes
export const getBienes = () => apiClient.get('/bienes');
export const getBienById = (id) => apiClient.get(`/bienes/${id}`);
export const createBien = (data) => apiClient.post('/bienes', data);
export const updateBien = (id, data) => apiClient.put(`/bienes/${id}`, data);
export const deleteBien = (id) => apiClient.delete(`/bienes/${id}`);

// Mantenimiento
export const getMantenimiento = () => apiClient.get('/mantenimiento');
export const getMantenimientoPorBien = (bienId) => apiClient.get(`/mantenimiento/bien/${bienId}`);
export const createMantenimiento = (data) => apiClient.post('/mantenimiento', data);
export const deleteMantenimiento = (id) => apiClient.delete(`/mantenimiento/${id}`);

// Depreciación
export const getDepreciacion = () => apiClient.get('/depreciacion');
export const getDepreciacionPorBien = (bienId) => apiClient.get(`/depreciacion/${bienId}`);
export const createDepreciacion = (data) => apiClient.post('/depreciacion', data);
export const updateDepreciacion = (bienId) => apiClient.put(`/depreciacion/${bienId}`);

// Reportes
export const getReporteInventario = () => apiClient.get('/reportes/inventario');
export const getReporteDepreciacion = () => apiClient.get('/reportes/depreciacion');
export const getReporteAsignaciones = () => apiClient.get('/reportes/asignaciones');
export const getReporteMantenimiento = () => apiClient.get('/reportes/mantenimiento');

// Auditoría
export const getAuditoria = (filtros) => {
  const query = new URLSearchParams(filtros).toString();
  return apiClient.get(`/auditoria?${query}`);
};

export default apiClient;

```

### Archivo: ./frontend/src/utils/helpers.js
```javascript
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export const formatearFecha = (fecha) => {
  if (!fecha) return '-';
  return formatDistanceToNow(new Date(fecha), { addSuffix: true, locale: es });
};

export const formatearMoneda = (valor) => {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(valor || 0);
};

export const calcularEdad = (fechaInicio) => {
  if (!fechaInicio) return 0;
  const hoy = new Date();
  const inicio = new Date(fechaInicio);
  let edad = hoy.getFullYear() - inicio.getFullYear();
  const mes = hoy.getMonth() - inicio.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < inicio.getDate())) {
    edad--;
  }
  return edad;
};

export const generarReportePDF = (datos, titulo) => {
  // Implementación futura con librería de PDF
  console.log(`Generando reporte: ${titulo}`);
};

```

### Archivo: ./frontend/tailwind.config.js
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

```

### Archivo: ./frontend/vite.config.js
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});

```

### Archivo: ./package.json
```javascript
{
  "name": "inventario-bienes-informaticos",
  "version": "1.0.0",
  "description": "Sistema de gestión de inventario de bienes informáticos para el Tribunal Constitucional del Perú",
  "main": "backend/server.js",
  "type": "module",
  "scripts": {
    "setup": "npm install && cd backend && npm install && cd ../frontend && npm install && cd ..",
    "backend:install": "cd backend && npm install",
    "backend:migrate": "cd backend && npm run migrate",
    "backend:dev": "cd backend && npm run dev",
    "backend:start": "cd backend && npm start",
    "frontend:install": "cd frontend && npm install",
    "frontend:dev": "cd frontend && npm run dev",
    "frontend:build": "cd frontend && npm run build",
    "dev": "echo 'Ejecuta en terminales separadas: npm run backend:dev y npm run frontend:dev'",
    "build": "npm run frontend:build"
  },
  "keywords": [
    "inventario",
    "bienes",
    "informáticos",
    "tribunal",
    "gestión"
  ],
  "author": "Clint Weslly Gutierrez Cruz",
  "license": "MIT"
}

```
