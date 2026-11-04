import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();
const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_SSL'];
if (required.some((name) => !process.env[name])) throw new Error('Falta configurar la conexión PostgreSQL');
const sql = postgres({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: process.env.DB_SSL === 'false' ? false : process.env.DB_SSL,
  connect_timeout: 10, onnotice: () => {} });
try {
  const migration = await fs.readFile(new URL('./20261029_vinculo_laboral.sql', import.meta.url), 'utf8');
  await sql.begin((tx) => tx.unsafe(migration));
  const [legacy] = await sql`SELECT COUNT(*)::integer AS pendientes FROM vinculo_laboral WHERE personal_id IS NULL`;
  console.log(`Migración CUS12 aplicada. Vínculos antiguos pendientes de asociar a Personal: ${legacy.pendientes}`);
} catch (error) { console.error('No se pudo aplicar CUS12:', error.message); process.exitCode = 1; }
finally { await sql.end({ timeout: 5 }); }
