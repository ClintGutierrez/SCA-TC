import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();
const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_SSL'];
if (required.some((name) => !process.env[name])) throw new Error('Falta configurar la conexión PostgreSQL');
const sql = postgres({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'false' ? false : process.env.DB_SSL });

try {
  const migration = await fs.readFile(new URL('./20261110_usuarios_estado.sql', import.meta.url), 'utf8');
  await sql.begin((tx) => tx.unsafe(migration));
  const [{ revisar }] = await sql`
    SELECT COUNT(*)::integer AS revisar FROM usuarios WHERE estado NOT IN ('activo', 'inactivo')
  `;
  console.log('Restricciones de estado de usuarios aplicadas.');
  console.log(`Cuentas con un estado distinto de activo/inactivo (sin acceso, revisar): ${revisar}.`);
} catch (error) {
  console.error('No se pudo aplicar la migración de estado de usuarios:', error.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
