import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { parseTrustProxy } from '../utils/proxy.js';

test('trust proxy: valores por defecto según el entorno', () => {
  assert.equal(parseTrustProxy(undefined, 'production'), 1);
  assert.equal(parseTrustProxy('', 'production'), 1);
  assert.equal(parseTrustProxy(undefined, 'development'), false);
  assert.equal(parseTrustProxy(undefined, undefined), false);
});

test('trust proxy: acepta saltos, false y direcciones; rechaza true', () => {
  assert.equal(parseTrustProxy('2', 'production'), 2);
  assert.equal(parseTrustProxy(' FALSE ', 'production'), false);
  assert.equal(parseTrustProxy('loopback, 10.0.0.0/8', 'production'), 'loopback, 10.0.0.0/8');
  assert.throws(() => parseTrustProxy('true', 'production'), /TRUST_PROXY/);
});

// Detrás de un proxy, cada cliente debe tener su propio contador de intentos.
test('trust proxy: el límite de intentos distingue clientes detrás de un proxy', async (t) => {
  const app = express();
  app.set('trust proxy', parseTrustProxy(undefined, 'production'));
  app.use(rateLimit({ windowMs: 60_000, limit: 1, standardHeaders: true, legacyHeaders: false }));
  app.get('/', (req, res) => res.json({ ip: req.ip }));
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const get = (ip) => fetch(url, { headers: { 'X-Forwarded-For': ip } });

  const first = await get('203.0.113.10');
  assert.equal(first.status, 200);
  assert.equal((await first.json()).ip, '203.0.113.10');
  assert.equal((await get('203.0.113.10')).status, 429, 'El mismo cliente agota su límite');
  assert.equal((await get('203.0.113.20')).status, 200, 'Otro cliente no queda bloqueado');
});
