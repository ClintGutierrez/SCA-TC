import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import postgres from 'postgres';
import { seedUsers, validateSeedUsers } from '../utils/seedUsers.js';

dotenv.config();
let sql;
try {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--file') {
    throw new Error('Uso: npm run seed:users -- --file <archivo-privado.json>');
  }
  if (!['development', 'test'].includes(process.env.NODE_ENV)) {
    throw new Error('La inicialización de cuentas requiere NODE_ENV=development o test');
  }
  const users = JSON.parse(await fs.readFile(args[1], 'utf8'));
  validateSeedUsers(users);
  const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_SSL'];
  if (required.some((name) => !process.env[name])) throw new Error('Falta configurar la conexión PostgreSQL');
  sql = postgres({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'false' ? false : process.env.DB_SSL });
  const result = await seedUsers(sql, users);
  console.log(`Cuentas creadas: ${result.created}. Cuentas existentes conservadas: ${result.skipped}.`);
} catch (error) {
  console.error('No se inicializaron las cuentas:', error instanceof SyntaxError ? 'El archivo debe contener JSON válido' : error.message);
  process.exitCode = 1;
} finally {
  if (sql) await sql.end({ timeout: 5 });
}
