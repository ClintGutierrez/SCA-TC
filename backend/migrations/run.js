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

    await sql.unsafe(`ALTER TABLE IF EXISTS bienes_informaticos DROP CONSTRAINT IF EXISTS bienes_informaticos_numero_serie_key;`);
    await sql.unsafe(`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY numero_serie ORDER BY id) AS rn
        FROM bienes_informaticos
        WHERE numero_serie IS NOT NULL
      )
      UPDATE bienes_informaticos
      SET numero_serie = NULL
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
    `);

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