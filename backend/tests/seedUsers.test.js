import test from 'node:test';
import assert from 'node:assert/strict';
import { seedUsers } from '../utils/seedUsers.js';
import { comparePassword } from '../utils/auth.js';

const account = {
  nombre: 'Administrador de prueba', email: 'nuevo@example.test', rol: 'administrador',
  password: 'ClaveSoloParaEstaPrueba!',
};

test('H08: producción, entorno ausente y cuentas inválidas no llegan a la base de datos', async () => {
  const sql = { begin: () => assert.fail('No debe iniciar una transacción') };
  for (const environment of ['production', '', 'staging']) {
    await assert.rejects(seedUsers(sql, [account], environment), /NODE_ENV/);
  }
  for (const users of [[], [account, { ...account, email: 'inválido' }], [{ ...account, password: '' }], [account, account]]) {
    await assert.rejects(seedUsers(sql, users, 'development'), /lista|Cuenta/);
  }
});

test('H08: cuentas existentes conservan contraseña, rol, nombre y estado incluso con correo en mayúsculas', async () => {
  const existing = { id: 1, email: 'NUEVO@example.test', nombre: 'Personalizado',
    rol: 'auditor', estado: 'inactivo', activo_login: false, password_hash: 'hash-personalizado' };
  const original = { ...existing };
  const sql = async (parts, ...values) => {
    assert.match(parts.join(''), /SELECT id FROM usuarios WHERE LOWER\(email\)/);
    assert.equal(values[0], existing.email.toLowerCase());
    return [{ id: existing.id }];
  };
  sql.begin = (callback) => callback(sql);
  assert.deepEqual(await seedUsers(sql, [account], 'development'), { created: 0, skipped: 1 });
  assert.deepEqual(existing, original);
});

test('H08: crea una cuenta con hash y repetir el comando no la restablece', async () => {
  let existing;
  const sql = async (parts, ...values) => {
    const query = parts.join('');
    if (query.includes('SELECT id')) return existing ? [{ id: existing.id }] : [];
    assert.match(query, /ON CONFLICT \(email\) DO NOTHING/);
    assert.doesNotMatch(query, /DO UPDATE/);
    existing = { id: 7, nombre: values[0], email: values[1], password_hash: values[4] };
    return [{ id: existing.id }];
  };
  sql.begin = (callback) => callback(sql);
  assert.deepEqual(await seedUsers(sql, [account], 'test'), { created: 1, skipped: 0 });
  assert.notEqual(existing.password_hash, account.password);
  assert.ok(await comparePassword(account.password, existing.password_hash));
  const hash = existing.password_hash;
  assert.deepEqual(await seedUsers(sql, [{ ...account, password: 'OtraClaveDePrueba!' }], 'test'), { created: 0, skipped: 1 });
  assert.equal(existing.password_hash, hash);
});
