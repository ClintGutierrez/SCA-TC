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

async function runMigrations() {
  try {
    await sql`SELECT 1`;
    console.log('✓ Conectado a PostgreSQL');

    const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8').replace(/^\uFEFF/, '');

    await sql.begin(async (transaction) => {
      await transaction.unsafe(schema);
      const assignmentMigrationPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '20261013_asignaciones.sql');
      const assignmentMigration = fs.readFileSync(assignmentMigrationPath, 'utf8').replace(/^\uFEFF/, '');
      await transaction.unsafe(assignmentMigration);
      const movementsMigrationPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '20261013_movimientos_patrimoniales.sql');
      const movementsMigration = fs.readFileSync(movementsMigrationPath, 'utf8').replace(/^\uFEFF/, '');
      await transaction.unsafe(movementsMigration);
      const gestionTIPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '20261028_documentaria_almacen.sql');
      await transaction.unsafe(fs.readFileSync(gestionTIPath, 'utf8').replace(/^\uFEFF/, ''));
      const vinculoPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '20261029_vinculo_laboral.sql');
      await transaction.unsafe(fs.readFileSync(vinculoPath, 'utf8').replace(/^\uFEFF/, ''));
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
