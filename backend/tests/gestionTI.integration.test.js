import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import express from 'express';
import postgres from 'postgres';
import dotenv from 'dotenv';
import { createGestionTIRouter } from '../routes/gestionTI.js';
import { createAuthToken } from '../utils/auth.js';

dotenv.config();

test('flujos HTTP y PostgreSQL en esquema aislado', { skip:process.env.TEST_TI_DATABASE !== '1', timeout:120000 }, async (t) => {
  const schema = `sca_ti_test_${crypto.randomBytes(8).toString('hex')}`;
  const options = { host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:process.env.DB_SSL === 'false' ? false : process.env.DB_SSL,connect_timeout:10,onnotice:() => {} };
  const admin=postgres(options);
  let sql;let server;
  const priorSecret=process.env.JWT_SECRET;
  process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');
  try {
    await admin.unsafe(`CREATE SCHEMA ${schema}`);
    sql=postgres({ ...options,connection:{ search_path:schema },max:5 });
    await sql.unsafe(`CREATE TABLE usuarios(id SERIAL PRIMARY KEY,nombre TEXT,email TEXT,rol TEXT,estado TEXT DEFAULT 'activo',activo_login BOOLEAN DEFAULT TRUE);
      CREATE TABLE bienes_informaticos(id SERIAL PRIMARY KEY,nombre TEXT,codigo_patrimonial TEXT,numero_serie TEXT,estado TEXT DEFAULT 'activo');`);
    const migration=await fs.readFile(new URL('../migrations/20261028_documentaria_almacen.sql',import.meta.url),'utf8');
    await sql.unsafe(migration);
    await sql.unsafe(migration); // La migración puede repetirse sin perder registros.
    const users=await sql`INSERT INTO usuarios(nombre,email,rol,es_ti) VALUES
      ('Jefatura','jefe@example.test','jefatura',TRUE),('Técnico uno','ti1@example.test','tecnico',TRUE),
      ('Técnico dos','ti2@example.test','tecnico',TRUE),('Almacén','almacen@example.test','almacen',FALSE),
      ('Auditor','auditor@example.test','auditor',FALSE) RETURNING *`;
    const tokens=users.map((u) => createAuthToken(u));
    const app=express();app.use(express.json());app.use('/ti',createGestionTIRouter(sql));
    server=await new Promise((resolve) => { const s=app.listen(0,'127.0.0.1',() => resolve(s)); });
    const base=`http://127.0.0.1:${server.address().port}/ti`;
    const request=async (path,{ user,body,method='GET',raw=false }={}) => {
      const headers={};if(user !== undefined) headers.Authorization=`Bearer ${tokens[user]}`;
      if(body && !(body instanceof FormData)) headers['Content-Type']='application/json';
      const response=await fetch(base+path,{ method,headers,body:body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
      return { status:response.status,data:raw ? Buffer.from(await response.arrayBuffer()) : await response.json() };
    };
    const payload={ tipoSolicitud:'nuevo_usuario',equipoCategoria:'laptop',mismoSolicitante:true,solicitanteNombre:'Solicitante',solicitanteCorreo:'persona@example.test',solicitanteDni:'12345678',solicitanteArea:'Administración',solicitanteCargo:'Analista',sede:'Sede Central',oficina:'Oficina 1',tipoDocumento:'Memorando',numeroDocumento:'MEM-1',justificacion:'Equipo para incorporación' };
    const form=(data=payload,content='%PDF-1.7\nDocumento de prueba',mime='application/pdf') => { const f=new FormData();f.append('datos',JSON.stringify(data));if(content !== null) f.append('documento',new Blob([content],{ type:mime }),'documento.pdf');return f; };
    const action=(data,withFile=false) => { const f=new FormData();f.append('datos',JSON.stringify(data));if(withFile) f.append('adjuntos',new Blob(['%PDF-1.7\nRespuesta'],{ type:'application/pdf' }),'respuesta.pdf');return f; };
    let solicitud;let other;let docId;let pedido;
    await t.test('rechaza formulario incompleto y archivo falso sin crear registros',async () => {
      assert.equal((await request('/solicitudes',{ method:'POST',body:form(payload,null) })).status,400);
      assert.equal((await request('/solicitudes',{ method:'POST',body:form(payload,'<script>') })).status,400);
      assert.equal((await request('/solicitudes',{ method:'POST',body:form({ ...payload,tipoSolicitud:'cambio_equipo' }) })).status,400);
      assert.equal((await sql`SELECT * FROM solicitudes_ti`).length,0);
    });
    await t.test('registra documento privado, constancia y alerta a Jefatura',async () => {
      const result=await request('/solicitudes',{ method:'POST',body:form() });assert.equal(result.status,201);solicitud=result.data;
      assert.match(solicitud.codigo,/^SOL-\d{4}-\d{6}$/);assert.equal(solicitud.estado,'recibida');assert.equal(solicitud.clave.length,48);
      assert.equal((await request('/notificaciones',{ user:0 })).data.length,1);
      assert.equal((await request('/solicitudes',{ user:1 })).data.length,0);
      assert.equal((await request('/solicitudes')).status,401);
      assert.equal((await request('/solicitudes',{ user:3 })).status,403);
      assert.equal((await request('/consulta',{ method:'POST',body:{ codigo:solicitud.codigo,clave:'falsa' } })).status,404);
      const lookup=await request('/consulta',{ method:'POST',body:{ codigo:solicitud.codigo,clave:solicitud.clave } });assert.equal(lookup.status,200);docId=lookup.data.documentos[0].id;
      assert.equal(lookup.data.datos,undefined);
      const file=await request(`/consulta/documentos/${docId}`,{ method:'POST',body:{ codigo:solicitud.codigo,clave:solicitud.clave },raw:true });assert.equal(file.status,200);assert.match(file.data.toString(),/^%PDF-/);
      assert.equal((await request(`/documentos/${docId}`,{ user:1 })).status,403);
    });
    await t.test('advierte duplicado y permite confirmarlo sin repetir el código',async () => {
      const duplicate=await request('/solicitudes',{ method:'POST',body:form() });assert.equal(duplicate.status,409);assert.equal(duplicate.data.duplicada,true);
      const confirmed=await request('/solicitudes',{ method:'POST',body:form({ ...payload,confirmarDuplicado:true }) });assert.equal(confirmed.status,201);other=confirmed.data;assert.notEqual(other.codigo,solicitud.codigo);
      assert.equal((await request(`/consulta/documentos/${docId}`,{ method:'POST',body:{ codigo:other.codigo,clave:other.clave },raw:true })).status,404);
    });
    await t.test('asigna, devuelve con motivo y reasigna; valida permisos del responsable',async () => {
      const path=`/solicitudes/${solicitud.id}/acciones`;
      assert.equal((await request(path,{ user:1,method:'POST',body:action({ accion:'asignar',usuarioId:2 }) })).status,403);
      assert.equal((await request(path,{ user:0,method:'POST',body:action({ accion:'asignar',usuarioId:4 }) })).status,400);
      assert.equal((await request(path,{ user:0,method:'POST',body:action({ accion:'asignar',usuarioId:2,comentario:'Atender incorporación' }) })).status,200);
      assert.equal((await request(path,{ user:2,method:'POST',body:action({ accion:'iniciar' }) })).status,403);
      assert.equal((await request(path,{ user:1,method:'POST',body:action({ accion:'devolver' }) })).status,400);
      assert.equal((await request(path,{ user:1,method:'POST',body:action({ accion:'devolver',comentario:'Se requiere otro especialista' }) })).data.estado,'recibida');
      assert.equal((await request(path,{ user:0,method:'POST',body:action({ accion:'asignar',usuarioId:3 }) })).status,200);
      assert.equal((await request(`/documentos/${docId}`,{ user:1 })).status,403);
      assert.equal((await request(path,{ user:2,method:'POST',body:action({ accion:'responder',acciones:'Atención' }) })).status,409);
      assert.equal((await request(path,{ user:2,method:'POST',body:action({ accion:'iniciar' }) })).status,200);
      assert.equal((await request(path,{ user:2,method:'POST',body:action({ accion:'responder' }) })).status,400);
      assert.equal((await request(path,{ user:2,method:'POST',body:action({ accion:'responder',acciones:'Se instaló el equipo',comentario:'Configurado y probado' },true) })).data.estado,'atendida');
      const lookup=await request('/consulta',{ method:'POST',body:{ codigo:solicitud.codigo,clave:solicitud.clave } });assert.equal(lookup.data.respuestas.length,1);assert.equal(lookup.data.documentos.length,2);
      assert.equal((await request(path,{ user:0,method:'POST',body:action({ accion:'cerrar' }) })).data.estado,'cerrada');
    });
    await t.test('observa y rechaza con motivo; auditor no modifica',async () => {
      const path=`/solicitudes/${other.id}/acciones`;
      assert.equal((await request(path,{ user:0,method:'POST',body:action({ accion:'observar' }) })).status,400);
      assert.equal((await request(path,{ user:0,method:'POST',body:action({ accion:'observar',comentario:'Documento incompleto' }) })).data.estado,'observada');
      assert.equal((await request(path,{ user:4,method:'POST',body:action({ accion:'rechazar',comentario:'No autorizado' }) })).status,403);
      assert.equal((await request(path,{ user:0,method:'POST',body:action({ accion:'rechazar',comentario:'No corresponde' }) })).data.estado,'rechazada');
      const lookup=await request('/consulta',{ method:'POST',body:{ codigo:other.codigo,clave:other.clave } });assert.equal(lookup.data.observaciones.length,2);
    });
    await t.test('registra pedido y llegada una sola vez sin duplicar la alerta',async () => {
      assert.equal((await request('/pedidos',{ user:3,method:'POST',body:{ numero:'OC-1',descripcion:'Laptop',cantidad:1 } })).status,403);
      const created=await request('/pedidos',{ user:0,method:'POST',body:{ numero:'OC-1',descripcion:'Laptop',cantidad:1 } });assert.equal(created.status,201);pedido=created.data;
      assert.equal((await request('/pedidos',{ user:0,method:'POST',body:{ numero:'OC-1',descripcion:'Laptop',cantidad:1 } })).status,409);
      const before=(await request('/notificaciones',{ user:0 })).data.length;
      const body={ accion:'llegada',fecha:new Date(Date.now()-10000).toISOString(),observaciones:'Caja sellada' };
      const results=await Promise.all([request(`/pedidos/${pedido.id}/acciones`,{ user:3,method:'POST',body }),request(`/pedidos/${pedido.id}/acciones`,{ user:3,method:'POST',body })]);
      assert.deepEqual(results.map((r) => r.status).sort(),[200,409]);
      assert.equal((await request('/notificaciones',{ user:0 })).data.length,before+1);
    });
    await t.test('deriva y permite que otro TI recepcione: dos intentos concurrentes crean una recepción',async () => {
      const path=`/pedidos/${pedido.id}/acciones`;
      assert.equal((await request(path,{ user:0,method:'POST',body:{ accion:'derivar',usuarioId:2 } })).status,200);
      assert.equal((await request(path,{ user:3,method:'POST',body:{ accion:'recepcionar',fecha:new Date().toISOString(),conformidad:true } })).status,403);
      assert.equal((await request(path,{ user:2,method:'POST',body:{ accion:'recepcionar',fecha:new Date().toISOString(),conformidad:false } })).status,400);
      const body={ accion:'recepcionar',fecha:new Date().toISOString(),conformidad:true,observaciones:'Equipo conforme' };
      const results=await Promise.all([request(path,{ user:1,method:'POST',body }),request(path,{ user:2,method:'POST',body })]);
      assert.deepEqual(results.map((r) => r.status).sort(),[200,409]);
      assert.equal((await sql`SELECT * FROM recepciones_ti WHERE pedido_id=${pedido.id}`).length,1);
      assert.equal((await request('/pedidos',{ user:0 })).data[0].estado,'recepcionado');
      const [asset]=await sql`INSERT INTO bienes_informaticos(nombre,codigo_patrimonial) VALUES ('Laptop','PAT-1') RETURNING id`;
      assert.equal((await request(`/pedidos/${pedido.id}/bienes`,{ user:0,method:'POST',body:{ bienId:asset.id } })).status,200);
      assert.equal((await request(`/pedidos/${pedido.id}/bienes`,{ user:0,method:'POST',body:{ bienId:asset.id } })).status,409);
      assert.equal((await request('/pedidos',{ user:0 })).data[0].bienes.length,1);
    });
    await t.test('cuentas deshabilitadas pierden acceso aunque el JWT siga vigente',async () => {
      await sql`UPDATE usuarios SET activo_login=FALSE WHERE id=2`;
      assert.equal((await request('/solicitudes',{ user:1 })).status,403);
    });
    await t.test('correo pendiente no revierte trámites y leer alerta no afecta a otro usuario',async () => {
      const notices=(await request('/notificaciones',{ user:0 })).data;
      assert.ok(notices.length > 0);assert.equal(notices[0].correo_estado,'pendiente');
      await request(`/notificaciones/${notices[0].id}/leida`,{ user:2,method:'POST' });
      assert.equal((await request('/notificaciones',{ user:0 })).data[0].leida_at,null);
      await request(`/notificaciones/${notices[0].id}/leida`,{ user:0,method:'POST' });
      assert.ok((await request('/notificaciones',{ user:0 })).data[0].leida_at);
      assert.equal((await sql`SELECT * FROM pedidos_ti WHERE id=${pedido.id}`)[0].estado,'recepcionado');
    });
  } finally {
    if(server) await new Promise((resolve) => server.close(resolve));
    if(sql) await sql.end({ timeout:5 });
    // Solo se elimina el esquema aislado creado por esta prueba, nunca datos reales.
    if(/^sca_ti_test_[a-f0-9]{16}$/.test(schema)) await admin.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end({ timeout:5 });
    if(priorSecret === undefined) delete process.env.JWT_SECRET;else process.env.JWT_SECRET=priorSecret;
  }
});
