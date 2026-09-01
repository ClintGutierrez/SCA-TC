import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import postgres from 'postgres';
import { createAuthRouter } from './routes/auth.js';
import { createBienesRouter } from './routes/bienes.js';
import { createMantenimientoRouter } from './routes/mantenimiento.js';
import { createDepreciacionRouter } from './routes/depreciacion.js';
import { createReportesRouter } from './routes/reportes.js';
import { createUsuariosRouter } from './routes/usuarios.js';
import { ensureAuthColumns, seedDefaultUsers } from './utils/auth.js';

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

// Registrar rutas
app.use('/api/auth', createAuthRouter(sql));
app.use('/api/usuarios', createUsuariosRouter(sql));
app.use('/api/bienes', createBienesRouter(sql));
app.use('/api/mantenimiento', createMantenimientoRouter(sql));
app.use('/api/depreciacion', createDepreciacionRouter(sql));
app.use('/api/reportes', createReportesRouter(sql));

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});
