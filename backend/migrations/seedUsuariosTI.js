// Crea la cuenta de Almacén para probar y deja a tecnico/jefatura como personal de TI.
// Uso (dentro de backend/):  node migrations/seedUsuariosTI.js
import postgres from 'postgres';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const sql = postgres({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'false' ? false : process.env.DB_SSL,
});

try {
  await sql`UPDATE usuarios SET es_ti = TRUE WHERE rol IN ('tecnico', 'jefatura') AND email IN ('tecnico@tc.pe', 'jefatura@tc.pe')`;
  const hash = await bcrypt.hash('Almacen123!', 10);
  await sql`
    INSERT INTO usuarios (nombre, email, departamento, rol, password_hash, estado, activo_login, es_ti)
    VALUES ('Usuario Almacén', 'almacen@tc.pe', 'Almacén', 'almacen', ${hash}, 'activo', TRUE, FALSE)
    ON CONFLICT (email) DO UPDATE SET rol = 'almacen', es_ti = FALSE
  `;
  console.log('✓ Listo: almacen@tc.pe / Almacen123!  |  tecnico y jefatura marcados como personal de TI');
} catch (error) {
  console.error('✗ Error:', error);
  process.exitCode = 1;
} finally {
  await sql.end();
}