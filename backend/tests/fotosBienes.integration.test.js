import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import dotenv from 'dotenv';
import express from 'express';
import postgres from 'postgres';
import sharp from 'sharp';
import { createBienesRouter } from '../routes/bienes.js';
import { createAuthToken } from '../utils/auth.js';

dotenv.config();

test('fotos de inventario en PostgreSQL aislado', {
  skip: process.env.TEST_FOTOS_BIENES_DATABASE !== '1', timeout: 120000,
}, async () => {
  const schema = `sca_fotos_test_${randomBytes(8).toString('hex')}`;
  const options = {
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'false' ? false : process.env.DB_SSL,
    connect_timeout: 10, onnotice: () => {},
  };
  const admin = postgres(options);
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  let sql;
  let server;
  try {
    await admin`CREATE SCHEMA ${admin(schema)}`;
    sql = postgres({ ...options, connection: { search_path: schema } });
    await sql.unsafe(await readFile(new URL('../migrations/schema.sql', import.meta.url), 'utf8'));
    for (const name of ['20261117_fotos_bienes.sql', '20261119_registros_bienes.sql']) {
      const migration = await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
      await sql.unsafe(migration);
      await sql.unsafe(migration);
    }
    const [user] = await sql`INSERT INTO usuarios (nombre, email, rol) VALUES ('Prueba', 'prueba@example.test', 'administrador') RETURNING *`;
    const headers = { Authorization: `Bearer ${createAuthToken(user)}` };
    const app = express();
    app.use(express.json());
    app.use('/api/bienes', createBienesRouter(sql));
    server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const endpoint = `${origin}/api/bienes`;
    const payload = {
      codigoPatrimonial: 'PAT-FOTO-1', numeroSerie: 'SN-FOTO-1', tipo: 'otro', marca: 'Prueba', modelo: 'Uno',
      ubicacion: 'Sede de prueba', valor: 0, fechaCompra: '2026-01-10', garantiaAnios: 0,
    };
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+BkL8AAAAASUVORK5CYII=', 'base64');
    const jpeg = await sharp(png).jpeg().toBuffer();
    const webp = await sharp(png).webp().toBuffer();
    const multipart = (datos, bytes = png, type = 'image/png') => {
      const form = new FormData();
      form.append('datos', JSON.stringify(datos));
      form.append('foto', new Blob([bytes], { type }), `prueba.${type.split('/')[1]}`);
      return form;
    };
    const save = (body, options = {}) => fetch(options.url || endpoint, { method: options.method || 'POST', headers, body });

    const pngSinCierre = png.subarray(0, -12);
    const fotosInvalidas = [
      ['texto', Buffer.from('archivo no válido'), 'image/png'],
      ['PNG con solo la firma', png.subarray(0, 8), 'image/png'],
      ['PNG sin IEND', pngSinCierre, 'image/png'],
      ['PNG con datos truncados pese a tener IEND', Buffer.concat([png.subarray(0, 40), png.subarray(-12)]), 'image/png'],
      ['JPEG truncado', jpeg.subarray(0, -1), 'image/jpeg'],
      ['WebP truncado', webp.subarray(0, -1), 'image/webp'],
      ['tipo de imagen incorrecto', png, 'image/jpeg'],
    ];
    for (const [caso, bytes, type] of fotosInvalidas) {
      const rejected = await save(multipart(payload, bytes, type));
      assert.equal(rejected.status, 400, caso);
      assert.ok((await rejected.json()).campos.foto, caso);
    }
    assert.equal((await save(multipart(payload, Buffer.alloc(5 * 1024 * 1024 + 1)))).status, 400);
    assert.equal((await sql`SELECT id FROM bienes_informaticos`).length, 0);
    assert.equal((await sql`SELECT id FROM fotos_bienes`).length, 0);

    const registroId = randomBytes(16).toString('hex');
    const intento = { ...payload, registroId };
    const consulta = `${endpoint}/registros/${registroId}`;
    assert.equal((await fetch(consulta, { headers })).status, 404);
    const envios = await Promise.all([save(multipart(intento)), save(multipart(intento))]);
    assert.deepEqual(envios.map((response) => response.status).sort(), [200, 201]);
    const created = envios.find((response) => response.status === 201);
    const bien = await created.json();
    assert.equal((await envios.find((response) => response.status === 200).json()).id, bien.id);
    assert.equal((await sql`SELECT id FROM bienes_informaticos`).length, 1);
    assert.equal((await sql`SELECT id FROM fotos_bienes`).length, 1);
    assert.equal((await fetch(consulta)).status, 401);
    const confirmacion = await fetch(consulta, { headers });
    assert.equal(confirmacion.status, 200);
    assert.equal((await confirmacion.json()).id, bien.id);
    const [otro] = await sql`INSERT INTO usuarios (nombre, email, rol) VALUES ('Otra cuenta', 'otra@example.test', 'jefatura') RETURNING *`;
    assert.equal((await fetch(consulta, { headers: { Authorization: `Bearer ${createAuthToken(otro)}` } })).status, 404);
    const distinto = await save(multipart({ ...intento, modelo: 'Otro modelo' }));
    assert.equal(distinto.status, 409);
    assert.match((await distinto.json()).error, /corresponde a otros datos/);
    assert.match(bien.imagen_url, /^\/api\/bienes\/fotos\//);
    assert.equal((await fetch(origin + bien.imagen_url)).status, 401);
    const downloaded = await fetch(origin + bien.imagen_url, { headers });
    assert.equal(downloaded.status, 200);
    assert.equal(downloaded.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), png);

    assert.equal((await save(multipart(payload))).status, 409);
    assert.equal((await sql`SELECT id FROM fotos_bienes`).length, 1);
    const bienUrl = `${endpoint}/${bien.id}`;
    const invalidReplacement = await save(multipart({ marca: 'Debe conservarse' }, pngSinCierre), { url: bienUrl, method: 'PUT' });
    assert.equal(invalidReplacement.status, 400);
    assert.ok((await invalidReplacement.json()).campos.foto);
    const [unchanged] = await sql`SELECT marca, imagen_url FROM bienes_informaticos WHERE id=${bien.id}`;
    assert.equal(unchanged.marca, bien.marca);
    assert.equal(unchanged.imagen_url, bien.imagen_url);
    assert.equal((await sql`SELECT id FROM fotos_bienes`).length, 1);

    let current = bien;
    for (const [type, bytes] of [['image/jpeg', jpeg], ['image/webp', webp]]) {
      const replaced = await save(multipart({ marca: 'Actualizada' }, bytes, type), { url: bienUrl, method: 'PUT' });
      assert.equal(replaced.status, 200);
      const updated = (await replaced.json()).bien;
      assert.notEqual(updated.imagen_url, current.imagen_url);
      const photo = await fetch(origin + updated.imagen_url, { headers });
      assert.equal(photo.status, 200);
      assert.equal(photo.headers.get('content-type'), type);
      assert.deepEqual(Buffer.from(await photo.arrayBuffer()), bytes);
      current = updated;
    }
    const history = await fetch(`${bienUrl}/historial`, { headers });
    assert.ok((await history.json()).some((entry) => entry.datos_anteriores.imagen_url === bien.imagen_url));
    assert.equal((await fetch(origin + bien.imagen_url, { headers })).status, 200);

    const sinCambio = await fetch(bienUrl, {
      method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ marca: 'Otra marca' }),
    });
    assert.equal((await sinCambio.json()).bien.imagen_url, current.imagen_url);
    const sinFoto = await fetch(bienUrl, {
      method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ imagenUrl: null }),
    });
    assert.equal((await sinFoto.json()).bien.imagen_url, null);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (sql) await sql.end({ timeout: 5 });
    await admin`DROP SCHEMA IF EXISTS ${admin(schema)} CASCADE`;
    await admin.end({ timeout: 5 });
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});
