import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { authenticateToken } from '../middleware/auth.js';
import { fail, positiveId, textField, validateSolicitud, validateFile, hashAccess, newAccess, solicitudTransition, pedidoTransition } from '../utils/flujoTI.js';
import { queueNotice, notifyHeads } from '../utils/notificacionesTI.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { files: 3, fileSize: 10 * 1024 * 1024, fields: 8, fieldSize: 32 * 1024 } });
const publicLimit = () => rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Demasiados intentos. Intente nuevamente en 15 minutos.' } });
const boss = (user) => ['administrador','jefatura'].includes(user.rol);
const event = async (tx, entity, id, user, action, comment = '', data = {}) => {
  const [row] = await tx`INSERT INTO eventos_ti (entidad,entidad_id,usuario_id,accion,comentario,datos)
    VALUES (${entity},${id},${user?.id || null},${action},${comment},${tx.json(data)}) RETURNING id`;
  return row.id;
};
const saveFile = async (tx, file, solicitudId, respuestaId = null) => {
  const name = file.originalname.replace(/[\x00-\x1f/\\]/g, '_').slice(0,200);
  await tx`INSERT INTO documentos_ti (solicitud_id,respuesta_id,nombre,mime,tamano,contenido)
    VALUES (${solicitudId},${respuestaId},${name},${file.mimetype},${file.buffer.length},${file.buffer})`;
};
const issueAccess = async (tx, id, minutes = 30) => {
  const token = newAccess();
  await tx`INSERT INTO solicitudes_ti_accesos (solicitud_id,token_hash,expires_at)
    VALUES (${id},${hashAccess(token)},now()+${minutes}*interval '1 minute')`;
  return token;
};
const lookupAccess = async (sql, body) => {
  const code = textField(body.codigo, 'Código', 80);
  const token = textField(body.clave, 'Clave de consulta', 100);
  const [row] = await sql`SELECT s.* FROM solicitudes_ti s JOIN solicitudes_ti_accesos a ON a.solicitud_id=s.id
    WHERE s.codigo=${code} AND a.token_hash=${hashAccess(token)} AND a.expires_at > now()`;
  if (!row) fail(404, 'Código o clave inválidos o vencidos');
  return row;
};
const detail = async (sql, row, publicView = false) => {
  const respuestas = await sql`SELECT r.id,r.acciones,r.comentario,r.created_at,u.nombre AS responsable FROM solicitudes_ti_respuestas r
    JOIN usuarios u ON u.id=r.usuario_id WHERE r.solicitud_id=${row.id} ORDER BY r.id`;
  const documentos = await sql`SELECT id,respuesta_id,nombre,mime,tamano FROM documentos_ti WHERE solicitud_id=${row.id} ORDER BY id`;
  if (publicView) return { codigo: row.codigo, estado: row.estado, created_at: row.created_at, respuestas, documentos,
    observaciones: await sql`SELECT accion,comentario,created_at FROM eventos_ti WHERE entidad='solicitud' AND entidad_id=${row.id} AND accion IN ('observar','rechazar') ORDER BY id` };
  const historial = await sql`SELECT e.*,u.nombre AS usuario FROM eventos_ti e LEFT JOIN usuarios u ON u.id=e.usuario_id
    WHERE entidad='solicitud' AND entidad_id=${row.id} ORDER BY e.id`;
  const pedidos = await sql`SELECT id,numero,estado FROM pedidos_ti WHERE solicitud_id=${row.id} ORDER BY id`;
  return { ...row, respuestas, documentos, historial, pedidos };
};
const sendFile = (res, file) => {
  if (!file) fail(404, 'Documento no encontrado');
  res.set({ 'Content-Type': file.mime, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.nombre)}`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.send(file.contenido);
};

export const createGestionTIRouter = (sql) => {
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const wrap = (fn) => async (req, res, next) => { try { await fn(req,res); } catch (error) { next(error); } };
  const requireBoss = (req) => { if (!boss(req.tiUser)) fail(403, 'Acción exclusiva de Jefatura'); };
  const canReadSolicitud = async (req, id) => {
    if (!positiveId(id)) fail(400, 'Identificador inválido');
    const [row] = await sql`SELECT * FROM solicitudes_ti WHERE id=${id}`;
    if (!row) fail(404, 'Solicitud no encontrada');
    if (!boss(req.tiUser) && req.tiUser.rol !== 'auditor' && Number(row.asignado_a) !== Number(req.tiUser.id)) fail(403, 'Solo puede consultar sus solicitudes asignadas');
    return row;
  };
  const getAssignee = async (tx, id) => {
    if (!positiveId(id)) fail(400, 'Seleccione un responsable de TI');
    const [user] = await tx`SELECT id,nombre,email FROM usuarios WHERE id=${id} AND es_ti=TRUE AND estado='activo' AND activo_login=TRUE FOR SHARE`;
    if (!user) fail(400, 'El responsable debe ser personal activo de TI');
    return user;
  };

  router.post('/solicitudes', publicLimit(), upload.single('documento'), wrap(async (req,res) => {
    let input;
    try { input = JSON.parse(req.body.datos); } catch { fail(400, 'Datos de formulario inválidos'); }
    const data = validateSolicitud(input || {});
    validateFile(req.file);
    const record = await sql.begin(async (tx) => {
      const equipment = (data.codigoActual || data.equipoCategoria).toLowerCase();
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`${data.beneficiarioDni}:${data.tipoSolicitud}:${equipment}`},0))`;
      const duplicates = await tx`SELECT codigo FROM solicitudes_ti WHERE beneficiario_dni=${data.beneficiarioDni}
        AND tipo=${data.tipoSolicitud} AND equipo_clave=${equipment} AND estado NOT IN ('atendida','cerrada','rechazada') LIMIT 1`;
      if (duplicates.length && input.confirmarDuplicado !== true) fail(409, 'Ya existe una solicitud en curso para el mismo beneficiario, tipo y equipo. ¿Desea registrarla de todas formas?', { duplicada: true });
      const [seq] = await tx`SELECT nextval('solicitudes_ti_codigo_seq') AS numero, to_char(now() AT TIME ZONE 'America/Lima','YYYY') AS anio`;
      const code = `SOL-${seq.anio}-${String(seq.numero).padStart(6,'0')}`;
      const [row] = await tx`INSERT INTO solicitudes_ti (codigo,tipo,beneficiario_dni,equipo_clave,correo,datos)
        VALUES (${code},${data.tipoSolicitud},${data.beneficiarioDni},${equipment},${data.solicitanteCorreo},${tx.json(data)}) RETURNING *`;
      await saveFile(tx, req.file, row.id);
      await event(tx,'solicitud',row.id,null,'registrar','Solicitud recibida', { duplicadoConfirmado: duplicates.length > 0 });
      await notifyHeads(tx, { key:`solicitud:${row.id}:recibida`, subject:`Nueva solicitud TI ${code}`, message:`Se recibió ${code}. Tipo: ${data.tipoSolicitud}. Solicitante: ${data.solicitanteNombre}. Revise la bandeja de Solicitudes TI.`, entity:'solicitud', id:row.id });
      const clave = await issueAccess(tx,row.id,60 * 24 * 7);
      await queueNotice(tx,{ key:`solicitud:${row.id}:constancia`, email:row.correo, subject:`Registro de solicitud ${code}`, message:`Su solicitud fue recibida. Código: ${code}. Clave de consulta (válida por 7 días): ${clave}. Consulte en la sección Seguimiento del formulario de TI.`, entity:'solicitud',id:row.id });
      return { ...row, clave };
    });
    res.status(201).json(record);
  }));
  router.post('/consulta/acceso', publicLimit(), wrap(async (req,res) => {
    const code = textField(req.body.codigo, 'Código', 80);
    const email = textField(req.body.correo, 'Correo', 300).toLowerCase();
    await sql.begin(async (tx) => {
      const [row] = await tx`SELECT id FROM solicitudes_ti WHERE codigo=${code} AND correo=${email}`;
      if (row) {
        // No generar un correo nuevo por cada clic repetido.
        const [recent] = await tx`SELECT id FROM solicitudes_ti_accesos WHERE solicitud_id=${row.id} AND created_at > now()-interval '1 minute'`;
        if (!recent) {
          const token = await issueAccess(tx,row.id);
          await queueNotice(tx,{ key:`acceso:${newAccess()}`,email,subject:`Consulta de solicitud ${code}`,message:`Su clave de consulta es ${token}. Válida durante 30 minutos.`,entity:'solicitud',id:row.id });
        }
      }
    });
    res.json({ message:'Si el código y correo coinciden, recibirá una clave de consulta por correo.' });
  }));
  router.post('/consulta', publicLimit(), wrap(async (req,res) => res.json(await detail(sql, await lookupAccess(sql,req.body),true))));
  router.post('/consulta/documentos/:id', publicLimit(), wrap(async (req,res) => {
    if (!positiveId(req.params.id)) fail(400,'Identificador inválido');
    const row = await lookupAccess(sql,req.body);
    const [file] = await sql`SELECT nombre,mime,contenido FROM documentos_ti WHERE id=${req.params.id} AND solicitud_id=${row.id}`;
    sendFile(res,file);
  }));

  router.use(authenticateToken);
  router.use(async (req,res,next) => {
    try {
      const [user] = await sql`SELECT id,nombre,email,rol,es_ti FROM usuarios WHERE id=${req.user.sub} AND estado='activo' AND activo_login=TRUE`;
      if (!user || (!user.es_ti && !['administrador','jefatura','auditor','almacen'].includes(user.rol))) fail(403,'No tiene acceso al módulo');
      req.tiUser = user; next();
    } catch (error) { next(error); }
  });
  router.get('/personal-ti', wrap(async (req,res) => {
    requireBoss(req);
    res.json(await sql`SELECT id,nombre FROM usuarios WHERE es_ti=TRUE AND estado='activo' AND activo_login=TRUE ORDER BY nombre`);
  }));
  router.get('/solicitudes', wrap(async (req,res) => {
    if (req.tiUser.rol === 'almacen' && !req.tiUser.es_ti) fail(403,'Acceso exclusivo de TI');
    const filter = boss(req.tiUser) || req.tiUser.rol === 'auditor' ? sql`` : sql`WHERE s.asignado_a=${req.tiUser.id}`;
    res.json(await sql`SELECT s.*,u.nombre AS responsable FROM solicitudes_ti s LEFT JOIN usuarios u ON u.id=s.asignado_a ${filter} ORDER BY s.id DESC LIMIT 500`);
  }));
  router.get('/solicitudes/:id', wrap(async (req,res) => res.json(await detail(sql,await canReadSolicitud(req,req.params.id)))));
  router.get('/documentos/:id', wrap(async (req,res) => {
    if (!positiveId(req.params.id)) fail(400,'Identificador inválido');
    const [metadata] = await sql`SELECT solicitud_id FROM documentos_ti WHERE id=${req.params.id}`;
    if (!metadata) fail(404,'Documento no encontrado');
    await canReadSolicitud(req,metadata.solicitud_id);
    const [file] = await sql`SELECT nombre,mime,contenido FROM documentos_ti WHERE id=${req.params.id}`;
    sendFile(res,file);
  }));
  router.post('/solicitudes/:id/acciones', upload.array('adjuntos',3), wrap(async (req,res) => {
    if (!positiveId(req.params.id)) fail(400,'Identificador inválido');
    let data;
    try { data = JSON.parse(req.body.datos); } catch { fail(400,'Datos inválidos'); }
    if (!data || typeof data !== 'object') fail(400,'Datos inválidos');
    for (const file of req.files || []) validateFile(file);
    const row = await sql.begin(async (tx) => {
      const [current] = await tx`SELECT * FROM solicitudes_ti WHERE id=${req.params.id} FOR UPDATE`;
      if (!current) fail(404,'Solicitud no encontrada');
      const next = solicitudTransition(current,data.accion,req.tiUser);
      const comment = textField(data.comentario,'Comentario / motivo',5000,['observar','rechazar','devolver'].includes(data.accion));
      const assignee = data.accion === 'asignar' ? await getAssignee(tx,data.usuarioId) : null;
      let responseId = null;
      if (data.accion === 'responder') {
        const actions = textField(data.acciones,'Acciones realizadas',5000);
        const [answer] = await tx`INSERT INTO solicitudes_ti_respuestas (solicitud_id,usuario_id,acciones,comentario)
          VALUES (${current.id},${req.tiUser.id},${actions},${comment}) RETURNING id`;
        responseId = answer.id;
      } else if (req.files?.length) fail(400,'Los adjuntos corresponden a una respuesta');
      for (const file of req.files || []) await saveFile(tx,file,current.id,responseId);
      const assignedId = assignee ? assignee.id : ['devolver','observar','rechazar'].includes(data.accion) ? null : current.asignado_a;
      const [updated] = await tx`UPDATE solicitudes_ti SET estado=${next},asignado_a=${assignedId},updated_at=now() WHERE id=${current.id} RETURNING *`;
      const eid = await event(tx,'solicitud',current.id,req.tiUser,data.accion,comment,{ anterior:current.estado,estado:next,asignado_a:assignedId });
      const notice = { key:`evento:${eid}`,subject:`Solicitud ${current.codigo}: ${next}`,message:`La solicitud ${current.codigo} pasó a ${next}. ${comment}${data.accion === 'responder' ? `\nAcciones realizadas: ${data.acciones}\nConsulte los adjuntos en Seguimiento.` : ''}`,entity:'solicitud',id:current.id };
      if (assignee) await queueNotice(tx,{ ...notice,userId:assignee.id,email:assignee.email });
      if (data.accion === 'devolver') await notifyHeads(tx,notice);
      if (['responder','observar','rechazar','cerrar'].includes(data.accion)) await queueNotice(tx,{ ...notice,email:current.correo });
      return updated;
    });
    res.json(row);
  }));

  router.get('/pedidos', wrap(async (req,res) => {
    res.json(await sql`SELECT p.*,u.nombre AS responsable,r.fecha AS recepcion_fecha,r.conformidad,r.observaciones AS recepcion_observaciones,
      ur.nombre AS recepcion_usuario,s.codigo AS solicitud_codigo,
      COALESCE((SELECT json_agg(json_build_object('id',b.id,'nombre',b.nombre,'codigo_patrimonial',b.codigo_patrimonial,'numero_serie',b.numero_serie))
        FROM pedidos_ti_bienes pb JOIN bienes_informaticos b ON b.id=pb.bien_id WHERE pb.pedido_id=p.id),'[]'::json) AS bienes
      FROM pedidos_ti p LEFT JOIN usuarios u ON u.id=p.asignado_a
      LEFT JOIN recepciones_ti r ON r.pedido_id=p.id LEFT JOIN usuarios ur ON ur.id=r.usuario_id
      LEFT JOIN solicitudes_ti s ON s.id=p.solicitud_id ORDER BY p.id DESC LIMIT 500`);
  }));
  router.post('/pedidos', wrap(async (req,res) => {
    requireBoss(req);
    const numero = textField(req.body.numero,'Número de pedido',100);
    const descripcion = textField(req.body.descripcion,'Descripción',5000);
    const cantidad = Number(req.body.cantidad);
    if (!Number.isSafeInteger(cantidad) || cantidad < 1 || cantidad > 100000) fail(400,'Cantidad inválida');
    const solicitudId = req.body.solicitudId || null;
    if (solicitudId && !positiveId(solicitudId)) fail(400,'Solicitud inválida');
    const record = await sql.begin(async (tx) => {
      if (solicitudId) {
        const [s] = await tx`SELECT id FROM solicitudes_ti WHERE id=${solicitudId} AND estado NOT IN ('rechazada','cerrada') FOR SHARE`;
        if (!s) fail(400,'Seleccione una solicitud vigente');
      }
      const [row] = await tx`INSERT INTO pedidos_ti (numero,descripcion,cantidad,solicitud_id,creado_por)
        VALUES (${numero},${descripcion},${cantidad},${solicitudId},${req.tiUser.id}) RETURNING *`;
      await event(tx,'pedido',row.id,req.tiUser,'registrar','Pedido solicitado');
      return row;
    });
    res.status(201).json(record);
  }));
  router.get('/pedidos/:id/historial', wrap(async (req,res) => {
    if (!positiveId(req.params.id)) fail(400,'Identificador inválido');
    res.json(await sql`SELECT e.*,u.nombre AS usuario FROM eventos_ti e LEFT JOIN usuarios u ON u.id=e.usuario_id
      WHERE entidad='pedido' AND entidad_id=${req.params.id} ORDER BY e.id`);
  }));
  router.post('/pedidos/:id/acciones', wrap(async (req,res) => {
    if (!positiveId(req.params.id)) fail(400,'Identificador inválido');
    const data = req.body;
    const row = await sql.begin(async (tx) => {
      const [current] = await tx`SELECT * FROM pedidos_ti WHERE id=${req.params.id} FOR UPDATE`;
      if (!current) fail(404,'Pedido no encontrado');
      const next = pedidoTransition(current,data.accion,req.tiUser);
      const comment = textField(data.observaciones,'Observaciones',5000,false);
      const assigned = data.accion === 'derivar' ? await getAssignee(tx,data.usuarioId) : null;
      let date = null;
      if (['llegada','recepcionar'].includes(data.accion)) {
        date = new Date(data.fecha);
        if (!data.fecha || Number.isNaN(date.getTime()) || date.getTime() > Date.now()+60000) fail(400,'Fecha inválida o futura');
        if (data.accion === 'recepcionar' && date < new Date(current.llegada_at)) fail(400,'La recepción no puede ser anterior a la llegada');
      }
      if (data.accion === 'recepcionar') {
        if (typeof data.conformidad !== 'boolean') fail(400,'Indique la conformidad');
        if (!data.conformidad && !comment) fail(400,'Indique las observaciones de la recepción no conforme');
        await tx`INSERT INTO recepciones_ti (pedido_id,usuario_id,fecha,conformidad,observaciones)
          VALUES (${current.id},${req.tiUser.id},${date},${data.conformidad},${comment})`;
      }
      const [updated] = await tx`UPDATE pedidos_ti SET estado=${next},asignado_a=${assigned?.id || current.asignado_a},
        llegada_at=${data.accion === 'llegada' ? date : current.llegada_at},
        llegada_por=${data.accion === 'llegada' ? req.tiUser.id : current.llegada_por},
        observaciones=${data.accion === 'llegada' ? comment : current.observaciones},updated_at=now() WHERE id=${current.id} RETURNING *`;
      const eid = await event(tx,'pedido',current.id,req.tiUser,data.accion,comment,{ anterior:current.estado,estado:next,asignado_a:updated.asignado_a,conformidad:data.conformidad ?? null });
      const notice = { key:`evento:${eid}`,subject:`Pedido ${current.numero}: ${next}`,message:`Pedido ${current.numero}. ${current.descripcion}. Cantidad: ${current.cantidad}. Estado: ${next}. Registrado por ${req.tiUser.nombre}. Fecha: ${date?.toISOString() || new Date().toISOString()}. ${comment}`,entity:'pedido',id:current.id };
      if (data.accion === 'llegada') await notifyHeads(tx,notice);
      if (assigned) await queueNotice(tx,{ ...notice,userId:assigned.id,email:assigned.email });
      return updated;
    });
    res.json(row);
  }));
  router.post('/pedidos/:id/bienes', wrap(async (req,res) => {
    requireBoss(req);
    if (!positiveId(req.params.id) || !positiveId(req.body.bienId)) fail(400,'Pedido o bien inválido');
    await sql.begin(async (tx) => {
      const [pedido] = await tx`SELECT * FROM pedidos_ti WHERE id=${req.params.id} FOR UPDATE`;
      if (!pedido) fail(404,'Pedido no encontrado');
      if (pedido.estado !== 'recepcionado') fail(409,'Primero debe recepcionar el pedido');
      const [bien] = await tx`SELECT id FROM bienes_informaticos WHERE id=${req.body.bienId} AND estado <> 'baja' FOR SHARE`;
      if (!bien) fail(400,'Bien no disponible');
      const [count] = await tx`SELECT count(*)::integer AS total FROM pedidos_ti_bienes WHERE pedido_id=${pedido.id}`;
      if (count.total >= pedido.cantidad) fail(409,'Ya se vinculó la cantidad total de bienes del pedido');
      await tx`INSERT INTO pedidos_ti_bienes (pedido_id,bien_id,vinculado_por) VALUES (${pedido.id},${bien.id},${req.tiUser.id})`;
      await event(tx,'pedido',pedido.id,req.tiUser,'vincular_bien',`Bien de inventario N.º ${bien.id}`,{ bien_id:bien.id });
    });
    res.json({ ok:true });
  }));
  router.get('/notificaciones', wrap(async (req,res) => {
    res.json(await sql`SELECT id,asunto,mensaje,entidad,entidad_id,leida_at,enviada_at,created_at,
      CASE WHEN enviada_at IS NULL THEN 'pendiente' ELSE 'enviada' END AS correo_estado
      FROM notificaciones_ti WHERE usuario_id=${req.tiUser.id} ORDER BY id DESC LIMIT 100`);
  }));
  router.post('/notificaciones/:id/leida', wrap(async (req,res) => {
    if (!positiveId(req.params.id)) fail(400,'Identificador inválido');
    await sql`UPDATE notificaciones_ti SET leida_at=COALESCE(leida_at,now()) WHERE id=${req.params.id} AND usuario_id=${req.tiUser.id}`;
    res.json({ ok:true });
  }));
  router.use((error,req,res,next) => {
    const status = error instanceof multer.MulterError ? 400 : error.code === '23505' ? 409 : error.status || 500;
    if (status === 403) void event(sql,'acceso',null,req.tiUser,'denegado',`${req.method} ${req.path}`).catch(console.error);
    if (status === 500) console.error('Gestión TI:',error);
    res.status(status).json({ error: error instanceof multer.MulterError ? 'Adjuntos inválidos: máximo 3 archivos de 10 MB' : error.code === '23505' ? 'El registro ya existe o ya fue procesado' : status === 500 ? 'No se pudo completar la operación' : error.message, ...(error.extra || {}) });
  });
  return router;
};
