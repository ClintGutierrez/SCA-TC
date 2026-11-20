import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import dotenv from 'dotenv';
import postgres from 'postgres';
import { getAuditoria } from '../controllers/auditoriaController.js';
import { getPreferenciasAlta } from '../controllers/bienesController.js';
import { getConfiguracion, saveConfiguracion } from '../controllers/configuracionController.js';

dotenv.config();

test('configuración guarda cambios parciales y su auditoría en la misma transacción', {
  skip: process.env.TEST_CONFIGURACION_DATABASE !== '1',
  timeout: 60000,
}, async () => {
  const schema = 'sca_configuracion_test_' + randomBytes(8).toString('hex');
  const options = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'false' ? false : process.env.DB_SSL,
    connect_timeout: 10,
    onnotice: () => {},
  };
  const admin = postgres(options);
  let sql;
  let created = false;
  try {
    await admin`CREATE SCHEMA ${admin(schema)}`;
    created = true;
    sql = postgres({ ...options, connection: { search_path: schema } });
    await sql.unsafe(await readFile(new URL('../migrations/schema.sql', import.meta.url), 'utf8'));
    const [user] = await sql`
      INSERT INTO usuarios (nombre, email, rol)
      VALUES ('Prueba', 'configuracion@example.test', 'administrador') RETURNING id
    `;
    await sql`
      INSERT INTO configuracion_sistema (clave, valor) VALUES
        ('inventory', ${sql.json({ moneda: 'PEN', depreciacionAnual: 25, garantiaPredeterminada: 3 })}),
        ('audit', ${sql.json({ retencionDias: 500, registrarAccesos: true })})
    `;
    const initialCatalogs = await sql`
      INSERT INTO catalogos_sistema (categoria, valor, activo, orden) VALUES
        ('sedes', 'Sede vigente', TRUE, 0),
        ('sedes', 'Sede antigua ', FALSE, 1),
        ('sedes', 'Sede que se retira', TRUE, 2),
        ('oficinas', 'Oficina inactiva', FALSE, 0)
      RETURNING id, categoria, valor, activo, orden
    `;
    const save = async (body, expectedStatus = 200) => {
      const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.body = data; return this; },
      };
      await saveConfiguracion({ user: { sub: user.id }, body }, res, sql);
      assert.equal(res.statusCode, expectedStatus, JSON.stringify(res.body));
    };
    const read = async (handler) => {
      const res = {
        set() { return this; },
        json(data) { this.body = data; return this; },
      };
      await handler({}, res, sql);
      return res.body;
    };
    const getCatalogs = () => sql`SELECT id, categoria, valor, activo, orden FROM catalogos_sistema ORDER BY id`;
    const audit = () => read((req, res) => getAuditoria({
      query: { tipo: 'acciones', modulo: 'configuracion_sistema', accion: 'UPDATE' },
    }, res, sql));

    await Promise.all([
      save({ settings: { inventory: { depreciacionAnual: 25.5 } }, catalogs: {} }),
      save({ settings: { inventory: { moneda: 'USD' } }, catalogs: {} }),
    ]);
    const settings = Object.fromEntries((await sql`SELECT clave, valor FROM configuracion_sistema`).map(({ clave, valor }) => [clave, valor]));
    assert.deepEqual(settings.inventory, { moneda: 'USD', depreciacionAnual: 25.5, garantiaPredeterminada: 3 });
    assert.deepEqual(settings.audit, { retencionDias: 500, registrarAccesos: true });
    assert.deepEqual(await getCatalogs(), initialCatalogs);
    const settingLogs = await audit();
    assert.equal(settingLogs.length, 2);
    assert.ok(settingLogs.every((log) => log.usuario_id === user.id && log.usuario === 'Prueba' && log.created_at instanceof Date));
    const depreciation = settingLogs.find((log) => Object.hasOwn(log.datos_nuevos, 'inventory.depreciacionAnual'));
    assert.deepEqual(depreciation.datos_anteriores, { 'inventory.depreciacionAnual': 25 });
    assert.deepEqual(depreciation.datos_nuevos, { 'inventory.depreciacionAnual': 25.5 });

    const values = [{ valor: 'Sede antigua ' }, { valor: 'Sede vigente' }, ' Sede nueva ', 'Sede nueva'];
    await save({ settings: {}, catalogs: { sedes: values } });
    const changed = await getCatalogs();
    assert.deepEqual(changed.find((row) => row.valor === 'Sede antigua '), { ...initialCatalogs[1], orden: 0 });
    assert.deepEqual(changed.find((row) => row.valor === 'Sede vigente'), { ...initialCatalogs[0], orden: 1 });
    assert.deepEqual(changed.find((row) => row.categoria === 'oficinas'), initialCatalogs[3]);
    assert.equal(changed.some((row) => row.valor === 'Sede que se retira'), false);
    assert.equal(changed.find((row) => row.valor === 'Sede nueva')?.activo, true);
    assert.equal(changed.length, 4);
    const [catalogLog] = await audit();
    assert.deepEqual(catalogLog.datos_anteriores['catalogs.sedes'], initialCatalogs.slice(0, 3).map(({ valor, activo }) => ({ valor, activo })));
    assert.deepEqual(catalogLog.datos_nuevos['catalogs.sedes'], [
      { valor: 'Sede antigua ', activo: false }, { valor: 'Sede vigente', activo: true }, { valor: 'Sede nueva', activo: true },
    ]);

    await save({ settings: {}, catalogs: { sedes: values } });
    assert.deepEqual(await getCatalogs(), changed);
    assert.equal((await audit()).length, 3);
    await save({ settings: {}, catalogs: { oficinas: [] } });
    assert.deepEqual(Array.from(await getCatalogs()), changed.filter((row) => row.categoria !== 'oficinas'));

    assert.deepEqual(await read(getPreferenciasAlta), { garantiaPredeterminada: 3 });
    await save({ settings: { inventory: { garantiaPredeterminada: '0' } } });
    assert.deepEqual(await read(getPreferenciasAlta), { garantiaPredeterminada: 0 });
    assert.equal((await read(getConfiguracion)).settings.inventory.garantiaPredeterminada, 0);
    for (const garantiaPredeterminada of [null, '', true, -1, 11, 1.5, '1 año']) {
      await save({ settings: { inventory: { garantiaPredeterminada } } }, 400);
    }
    assert.deepEqual(await read(getPreferenciasAlta), { garantiaPredeterminada: 0 });
    await sql`UPDATE configuracion_sistema SET valor = '{"garantiaPredeterminada": 20}' WHERE clave = 'inventory'`;
    assert.deepEqual(await read(getPreferenciasAlta), { garantiaPredeterminada: 1 });
    assert.equal((await read(getConfiguracion)).settings.inventory.garantiaPredeterminada, 1);

    await Promise.all([
      save({ settings: { inventory: { garantiaPredeterminada: 4 } } }),
      save({ settings: { inventory: { garantiaPredeterminada: 6 } } }),
    ]);
    const [latest, earlier] = await audit();
    assert.equal(earlier.datos_anteriores['inventory.garantiaPredeterminada'], 1);
    assert.equal(latest.datos_anteriores['inventory.garantiaPredeterminada'], earlier.datos_nuevos['inventory.garantiaPredeterminada']);
    const lastWarranty = latest.datos_nuevos['inventory.garantiaPredeterminada'];

    await save({ settings: { siga: { urlServicio: 'https://user:secret@example.test/siga?token=secret#secret' } } });
    const [urlLog] = await audit();
    assert.deepEqual(urlLog.datos_anteriores, { 'siga.urlServicio': '' });
    assert.deepEqual(urlLog.datos_nuevos, { 'siga.urlServicio': 'https://example.test/siga' });

    await sql`ALTER TABLE audit_log ADD CHECK (tabla_afectada <> 'configuracion_sistema') NOT VALID`;
    await save({ settings: { inventory: { garantiaPredeterminada: 10 } } }, 500);
    assert.deepEqual(await read(getPreferenciasAlta), { garantiaPredeterminada: lastWarranty });
  } finally {
    if (sql) await sql.end({ timeout: 5 });
    try {
      if (created) await admin`DROP SCHEMA ${admin(schema)} CASCADE`;
    } finally {
      await admin.end({ timeout: 5 });
    }
  }
});
