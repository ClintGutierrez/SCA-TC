import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();
const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_SSL'];
if (required.some((name) => !process.env[name])) throw new Error('Falta configurar la conexión PostgreSQL');
const sql = postgres({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'false' ? false : process.env.DB_SSL });

// Registros cuyo año base aún no coincide con el año de adquisición de su bien.
const pendientes = async () => (await sql`
  SELECT COUNT(*)::integer AS total FROM depreciacion d
  JOIN bienes_informaticos b ON b.id = d.bien_id
  WHERE d.ano_base IS DISTINCT FROM EXTRACT(YEAR FROM b.fecha_adquisicion)::integer
`)[0].total;

try {
  const migration = await fs.readFile(new URL('./20261110_depreciacion_ano_adquisicion.sql', import.meta.url), 'utf8');
  const antes = await pendientes();
  await sql.begin((tx) => tx.unsafe(migration));
  const despues = await pendientes();
  console.log(`Depreciaciones conciliadas con el año de adquisición: ${antes - despues}.`);
  console.log(`Registros que requieren revisión manual (datos inválidos o fechas futuras): ${despues}.`);
} catch (error) {
  console.error('No se pudo conciliar la depreciación:', error.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
