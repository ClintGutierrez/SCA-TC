import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createReportesRouter } from '../routes/reportes.js';
import { createAuthToken, systemRoles } from '../utils/auth.js';

const PATHS = ['/inventario', '/depreciacion', '/asignaciones', '/mantenimiento'];
const ALLOWED = ['administrador', 'jefatura', 'tecnico', 'auditor'];

test('reportes: solo administrador, jefatura, técnico y auditor acceden; el rol se toma de la BD', async (t) => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'secreto-local-para-pruebas-de-reportes';
  t.after(() => {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  });

  // La BD simulada devuelve la cuenta con el rol de la prueba en curso; las consultas
  // de reportes devuelven una fila vacía y se registran para comprobar que no se ejecutan.
  let currentRole;
  let reportQueries = 0;
  const sql = async (parts) => {
    if (parts.join('').includes('FROM usuarios')) {
      return [{ id: 7, nombre: 'Prueba', email: 'p@example.test', rol: currentRole, es_ti: false, estado: 'activo', activo_login: true }];
    }
    reportQueries += 1;
    return [{}];
  };

  const app = express();
  app.use('/reportes', createReportesRouter(sql));
  const server = app.listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/reportes`;
  // El token siempre dice "administrador": el acceso debe depender del rol actual en la BD.
  const token = createAuthToken({ id: 7, email: 'p@example.test', nombre: 'Prueba', rol: 'administrador' });

  for (const role of systemRoles) {
    currentRole = role;
    for (const path of PATHS) {
      const before = reportQueries;
      const res = await fetch(base + path, { headers: { authorization: `Bearer ${token}` } });
      const expected = ALLOWED.includes(role) ? 200 : 403;
      assert.equal(res.status, expected, `${role} ${path}`);
      if (expected === 403) assert.equal(reportQueries, before, `${role} no debe ejecutar la consulta de ${path}`);
    }
  }

  const anonymous = await fetch(base + '/asignaciones');
  assert.equal(anonymous.status, 401);
});
