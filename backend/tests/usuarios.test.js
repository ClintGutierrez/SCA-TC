import test from 'node:test';
import assert from 'node:assert/strict';
import { comparePassword } from '../utils/auth.js';
import { bloquearUsuarios, prepararUsuario, protegerAcceso } from '../utils/usuarios.js';

const admin = { id: 1, nombre: 'Admin', email: 'admin@example.test', rol: 'administrador', estado: 'activo', activo_login: true, password_hash: 'hash-existente' };
test('usuarios: actualización parcial preserva rol, acceso, pertenencia a TI y contraseña', async () => {
  const current = { ...admin, es_ti: true };
  const result = await prepararUsuario({ nombre: ' Nombre corregido ' }, current);
  assert.equal(result.nombre, 'Nombre corregido'); assert.equal(result.rol, 'administrador');
  assert.equal(result.activo_login, true); assert.equal(result.password_hash, 'hash-existente'); assert.equal(result.es_ti, true);
});
test('usuarios: valida credenciales, enumera roles y no acepta booleanos como cadenas', async () => {
  const valid = { nombre: ' Prueba ', email: ' PERSONA@EXAMPLE.TEST ', rol: 'tecnico', password: 'ClaveDePrueba123!' };
  const result = await prepararUsuario(valid);
  assert.equal(result.email, 'persona@example.test'); assert.equal(result.es_ti, true);
  assert.ok(await comparePassword(valid.password, result.password_hash));
  for (const changes of [{ rol: 'superadmin' }, { estado: 'otro' }, { activoLogin: 'false' }, { esTI: 'true' }, { email: 'inválido' }, { password: 'corta' }]) {
    await assert.rejects(prepararUsuario({ ...valid, ...changes }), { status: 400 });
  }
  const inactive = await prepararUsuario({ ...valid, estado: 'inactivo', activoLogin: true });
  assert.equal(inactive.activo_login, false);
});
test('usuarios: la cuenta propia no puede cambiar su rol ni retirar su acceso', () => {
  for (const changes of [{ rol: 'tecnico' }, { estado: 'inactivo' }, { activo_login: false }]) {
    assert.throws(() => protegerAcceso([admin], admin, { ...admin, ...changes }, 1), { status: 409 });
  }
  assert.doesNotThrow(() => protegerAcceso([admin], admin, { ...admin, nombre: 'Nuevo nombre' }, 1));
});
test('usuarios: exige conservar un administrador habilitado y permite gestionar las demás cuentas', () => {
  const next = { ...admin, rol: 'auditor' };
  assert.throws(() => protegerAcceso([admin], admin, next, 2), { status: 409 });
  assert.doesNotThrow(() => protegerAcceso([admin, { ...admin, id: 2 }], admin, next, 2));
});
test('usuarios: un token antiguo de una cuenta desactivada o degradada no autoriza mutaciones', async () => {
  for (const current of [{ ...admin, estado: 'inactivo' }, { ...admin, rol: 'tecnico' }]) {
    await assert.rejects(bloquearUsuarios(async () => [current], 1), { status: 403 });
  }
  await assert.rejects(bloquearUsuarios(() => assert.fail('No debe consultar SQL'), NaN), { status: 401 });
});
