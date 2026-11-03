import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const requiredDatabaseEnv = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_SSL'];
const missingDatabaseEnv = requiredDatabaseEnv.filter((name) => !process.env[name]);

if (missingDatabaseEnv.length > 0) {
  throw new Error(`Faltan variables de Supabase: ${missingDatabaseEnv.join(', ')}`);
}

const sql = postgres({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'false' ? false : process.env.DB_SSL,
});

const migrationsDir = path.dirname(fileURLToPath(import.meta.url));
const readSql = (file) => fs.readFileSync(path.join(migrationsDir, file), 'utf8').replace(/^\uFEFF/, '');

// Se ejecutan después de schema.sql, en este orden (todas son idempotentes)
const extraMigrations = [
  '20261013_asignaciones.sql',
  '20261013_movimientos_patrimoniales.sql',
  '20261028_documentaria_almacen.sql',
];

async function runMigrations() {
  try {
    await sql`SELECT 1`;
    console.log('✓ Conectado a PostgreSQL');

    await sql.begin(async (transaction) => {
      await transaction.unsafe(readSql('schema.sql'));
      for (const file of extraMigrations) {
        await transaction.unsafe(readSql(file));
      }
      await transaction.unsafe(`ALTER TABLE IF EXISTS usuarios ADD COLUMN IF NOT EXISTS password_hash TEXT`);
      await transaction.unsafe(`ALTER TABLE IF EXISTS usuarios ADD COLUMN IF NOT EXISTS last_login TIMESTAMP`);
      await transaction.unsafe(`ALTER TABLE IF EXISTS usuarios ADD COLUMN IF NOT EXISTS activo_login BOOLEAN DEFAULT TRUE`);
    });

    console.log('✓ Migraciones ejecutadas correctamente');
  } catch (error) {
    console.error('✗ Error en migraciones:', error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

runMigrations();