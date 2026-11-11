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
  const migration = await fs.readFile(new URL('./20261105_depreciacion_base.sql', import.meta.url), 'utf8');
  await sql.begin((tx) => tx.unsafe(migration));
  const [review] = await sql`SELECT COUNT(*)::integer AS pendientes FROM depreciacion
    WHERE ano_base IS NULL OR ano_base < 1 OR ano_base > EXTRACT(YEAR FROM NOW() AT TIME ZONE 'America/Lima')
      OR ano_actual IS NULL OR ano_actual < ano_base OR ano_actual > EXTRACT(YEAR FROM NOW() AT TIME ZONE 'America/Lima')
      OR valor_inicial IS NULL OR valor_inicial < 0 OR valor_inicial::text IN ('NaN', 'Infinity', '-Infinity')
      OR porcentaje_anual IS NULL OR NOT (porcentaje_anual BETWEEN 0 AND 100)
      OR valor_actual IS NULL OR NOT (valor_actual BETWEEN 0 AND valor_inicial)`;
  console.log('Base de depreciación aplicada. Los importes históricos se conservan.');
  console.log(`Registros que requieren revisión: ${review.pendientes}`);
} catch (error) {
  console.error('No se pudo aplicar la migración de depreciación:', error.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
