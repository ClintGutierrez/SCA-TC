import test from 'node:test';
import assert from 'node:assert/strict';
import { accesoUsuario, filtrarUsuarios, formularioUsuario, payloadUsuario, resumirUsuarios, validarUsuario } from '../src/utils/usuarios.js';

const users = [
  { id: 1, nombre: 'María Torres', email: 'maria@example.test', departamento: 'Administración', rol: 'administrador', estado: 'activo', activo_login: true },
  { id: 2, nombre: 'Almacén', email: 'almacen@example.test', rol: 'almacen', estado: 'activo', activo_login: false },
  { id: 3, nombre: 'Auditor', email: 'auditor@example.test', rol: 'auditor', estado: 'inactivo', activo_login: true },
];
test('usuarios: acceso efectivo y contadores distinguen bloqueo, inactividad y todos los roles', () => {
  assert.equal(accesoUsuario(users[2]), 'inactiva');
  assert.deepEqual(resumirUsuarios(users), { total: 3, habilitado: 1, bloqueado: 1, inactiva: 1, administradores: 1 });
});
test('usuarios: búsqueda sin tildes se combina con rol y acceso', () => {
  assert.deepEqual(filtrarUsuarios(users, 'administracion', 'administrador', 'habilitado').map((u) => u.id), [1]);
  assert.deepEqual(filtrarUsuarios(users, 'almacen@', 'almacen', 'bloqueado').map((u) => u.id), [2]);
  assert.equal(filtrarUsuarios(users, 'maria', '', 'bloqueado').length, 0);
});
test('usuarios: habilitar una cuenta inactiva produce un estado coherente y omite la contraseña sin cambio', () => {
  const form = { ...formularioUsuario(users[2]), acceso: 'habilitado' };
  const payload = payloadUsuario(form, false);
  assert.equal(payload.estado, 'activo'); assert.equal(payload.activoLogin, true);
  assert.equal(Object.hasOwn(payload, 'password'), false);
});
test('usuarios: TI es obligatorio para técnicos y jefaturas y opcional para los otros roles', () => {
  assert.equal(payloadUsuario({ ...formularioUsuario(), rol: 'jefatura', esTI: false }, false).esTI, true);
  assert.equal(payloadUsuario({ ...formularioUsuario(), rol: 'almacen', esTI: false }, false).esTI, false);
});
test('usuarios: el formulario exige credenciales nuevas válidas y preserva contraseñas existentes', () => {
  const form = { ...formularioUsuario(users[0]), password: '' };
  assert.deepEqual(validarUsuario(form, false), {});
  assert.ok(validarUsuario(form, true).password);
  assert.ok(validarUsuario({ ...form, password: 'é'.repeat(37) }, true).password);
  assert.deepEqual(validarUsuario({ ...form, password: 'UnaClaveDePrueba!' }, true), {});
  assert.ok(validarUsuario({ ...form, email: 'correo inválido' }, false).email);
});
