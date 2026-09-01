import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const sql = postgres({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'inventario_bienes',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL || false,
});

async function runMigrations() {
  try {
    await sql`SELECT 1`;
    console.log('✓ Conectado a PostgreSQL');

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
