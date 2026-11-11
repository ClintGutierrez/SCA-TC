import { hashPassword, systemRoles } from './auth.js';

export function validateSeedUsers(users, nodeEnv = process.env.NODE_ENV) {
  if (!['development', 'test'].includes(nodeEnv)) {
    throw new Error('La inicialización de cuentas requiere NODE_ENV=development o test');
  }
  if (!Array.isArray(users) || !users.length) throw new Error('Se requiere una lista de cuentas');
  const emails = new Set();
  return users.map((user, index) => {
    const error = () => { throw new Error(`Cuenta ${index + 1}: nombre, correo, rol o contraseña inválidos`); };
    if (!user || typeof user !== 'object') error();
    const nombre = typeof user.nombre === 'string' ? user.nombre.trim() : '';
    const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
    if (!nombre || nombre.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || email.length > 255 || !systemRoles.includes(user.rol)
      || typeof user.password !== 'string' || user.password.trim().length < 8
      || Buffer.byteLength(user.password, 'utf8') > 72 || emails.has(email)) error();
    if (user.departamento != null && (typeof user.departamento !== 'string' || user.departamento.length > 255)) error();
    emails.add(email);
    return { nombre, email, rol: user.rol, password: user.password,
      departamento: user.departamento?.trim() || null,
      es_ti: ['tecnico', 'jefatura'].includes(user.rol) || user.es_ti === true };
  });
}

export async function seedUsers(sql, users, nodeEnv = process.env.NODE_ENV) {
  const accounts = validateSeedUsers(users, nodeEnv);
  return sql.begin(async (tx) => {
    let created = 0;
    for (const user of accounts) {
      // Conservar también cuentas antiguas cuyo correo use mayúsculas.
      const existing = await tx`SELECT id FROM usuarios WHERE LOWER(email) = ${user.email} LIMIT 1`;
      if (existing.length) continue;
      const passwordHash = await hashPassword(user.password);
      const inserted = await tx`
        INSERT INTO usuarios (nombre, email, departamento, rol, password_hash, activo_login, estado, es_ti)
        VALUES (${user.nombre}, ${user.email}, ${user.departamento}, ${user.rol}, ${passwordHash}, TRUE, 'activo', ${user.es_ti})
        ON CONFLICT (email) DO NOTHING RETURNING id
      `;
      created += inserted.length;
    }
    return { created, skipped: accounts.length - created };
  });
}
