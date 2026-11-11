import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import postgres from 'postgres';

// Aplica, en este orden y en una sola transacción:
// 1. La conciliación del año base con el año de adquisición de cada bien.
// 2. El recálculo de todos los importes con el método de línea recta.
// Ambas migraciones registran cada cambio en audit_log y pueden repetirse.
dotenv.config();
const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_SSL'];
if (required.some((name) => !process.env[name])) throw new Error('Falta configurar la conexión PostgreSQL');
const sql = postgres({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'false' ? false : process.env.DB_SSL });

const FILES = ['./20261110_depreciacion_ano_adquisicion.sql', './20261110_depreciacion_linea_recta.sql'];

try {
  const migrations = await Promise.all(FILES.map((file) => fs.readFile(new URL(file, import.meta.url), 'utf8')));
  const [{ ultimo }] = await sql`SELECT COALESCE(MAX(id), 0) AS ultimo FROM audit_log`;
  await sql.begin(async (tx) => {
    for (const migration of migrations) await tx.unsafe(migration);
  });
  const resumen = await sql`
    SELECT operacion, COUNT(*)::integer AS total FROM audit_log
    WHERE id > ${ultimo} AND tabla_afectada = 'depreciacion'
      AND operacion IN ('CONCILIAR_ANO_ADQUISICION', 'RECALCULAR_LINEA_RECTA')
    GROUP BY operacion
  `;
  const total = (operacion) => resumen.find((row) => row.operacion === operacion)?.total || 0;
  const [{ pendientes }] = await sql`
    SELECT COUNT(*)::integer AS pendientes FROM depreciacion d
    JOIN bienes_informaticos b ON b.id = d.bien_id
    WHERE d.ano_base IS DISTINCT FROM EXTRACT(YEAR FROM b.fecha_adquisicion)::integer
  `;
  console.log(`Años base conciliados con la fecha de adquisición: ${total('CONCILIAR_ANO_ADQUISICION')}.`);
  console.log(`Importes recalculados con línea recta: ${total('RECALCULAR_LINEA_RECTA')}.`);
  console.log(`Registros que requieren revisión manual (datos inválidos o fechas futuras): ${pendientes}.`);
} catch (error) {
  console.error('No se pudo recalcular la depreciación:', error.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
