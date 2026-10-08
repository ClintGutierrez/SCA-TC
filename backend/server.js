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
import { createPersonalRouter } from './routes/personal.js';
import { createConfiguracionRouter } from './routes/configuracion.js';
import { createAuditoriaRouter } from './routes/auditoria.js';
import { createBajasRouter } from './routes/bajas.js';
import { ensureAuthColumns, seedDefaultUsers } from './utils/auth.js';
import { openapiSpec } from './docs/openapi.js';

dotenv.config();

const requiredDatabaseEnv = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_SSL'];
const missingDatabaseEnv = requiredDatabaseEnv.filter((name) => !process.env[name]);

if (missingDatabaseEnv.length > 0) {
  throw new Error(`Faltan variables de Supabase: ${missingDatabaseEnv.join(', ')}`);
}

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const allowedFrontendOrigins = new Set([FRONTEND_URL, 'http://localhost:3000', 'http://localhost:5173']);
const isAllowedFrontendOrigin = (origin) => !origin
  || allowedFrontendOrigins.has(origin)
  || (process.env.NODE_ENV !== 'production' && /^https?:\/\/localhost:\d+$/.test(origin));

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: (origin, callback) => callback(null, isAllowedFrontendOrigin(origin)), credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Conexión a PostgreSQL desde las variables de entorno
const sql = postgres({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'false' ? false : process.env.DB_SSL,
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
app.use('/api/personal', createPersonalRouter(sql));
app.use('/api/configuracion', createConfiguracionRouter(sql));
app.use('/api/bienes', createBienesRouter(sql));
app.use('/api/mantenimiento', createMantenimientoRouter(sql));
app.use('/api/depreciacion', createDepreciacionRouter(sql));
app.use('/api/reportes', createReportesRouter(sql));
app.use('/api/auditoria', createAuditoriaRouter(sql));
app.use('/api/bajas', createBajasRouter(sql));

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});