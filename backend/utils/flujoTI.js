import crypto from 'node:crypto';

export const TIPOS_TI = new Set(['nuevo_usuario', 'asignacion_equipo', 'cambio_equipo', 'cambio_ubicacion', 'impresora_escaner', 'otro_servicio']);
export const EQUIPOS_TI = new Set(['laptop', 'computadora', 'monitor', 'impresora', 'escaner', 'periferico', 'red_telefonia', 'otro']);
export const fail = (status, message, extra = {}) => { throw Object.assign(new Error(message), { status, extra }); };
export const hashAccess = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
export const newAccess = () => crypto.randomBytes(24).toString('hex');
export const positiveId = (value) => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
export const textField = (value, label, max = 300, required = true) => {
  if (value !== undefined && typeof value !== 'string') fail(400, `${label}: valor inválido`);
  const result = (value || '').trim();
  if ((required && !result) || result.length > max) fail(400, `${label}: campo obligatorio o demasiado largo (máximo ${max})`);
  return result;
};
export const validateSolicitud = (body) => {
  const data = {};
  if (!TIPOS_TI.has(body.tipoSolicitud)) fail(400, 'Tipo de solicitud inválido');
  if (!EQUIPOS_TI.has(body.equipoCategoria)) fail(400, 'Categoría de equipo inválida');
  data.tipoSolicitud = body.tipoSolicitud;
  data.equipoCategoria = body.equipoCategoria;
  data.mismoSolicitante = body.mismoSolicitante === true;
  for (const key of ['solicitanteNombre','solicitanteCorreo','solicitanteDni','solicitanteArea','solicitanteCargo','sede','oficina','tipoDocumento','numeroDocumento']) {
    data[key] = textField(body[key], key);
  }
  data.solicitanteCorreo = data.solicitanteCorreo.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.solicitanteCorreo)) fail(400, 'Correo inválido');
  if (!/^\d{8}$/.test(data.solicitanteDni)) fail(400, 'DNI del solicitante inválido');
  if (!['Memorando','Oficio','Informe','Formato de solicitud firmado','Resolución'].includes(data.tipoDocumento)) fail(400, 'Tipo de documento oficial inválido');
  for (const suffix of ['Nombre','Dni','Cargo']) {
    data[`beneficiario${suffix}`] = data.mismoSolicitante ? data[`solicitante${suffix}`] : textField(body[`beneficiario${suffix}`], `Beneficiario ${suffix}`, 300, suffix !== 'Cargo');
  }
  if (!/^\d{8}$/.test(data.beneficiarioDni)) fail(400, 'DNI del beneficiario inválido');
  data.justificacion = textField(body.justificacion, 'Justificación', 5000);
  data.equipoDetalle = textField(body.equipoDetalle, 'Detalle del equipo', 3000, false);
  data.codigoActual = textField(body.codigoActual, 'Código o serie del equipo', 150, ['cambio_equipo','cambio_ubicacion'].includes(data.tipoSolicitud));
  for (const key of ['sedeOrigen','oficinaOrigen']) data[key] = textField(body[key], key, 300, data.tipoSolicitud === 'cambio_ubicacion');
  if (data.tipoSolicitud === 'impresora_escaner' && !['impresora','escaner'].includes(data.equipoCategoria)) fail(400, 'Seleccione impresora o escáner');
  return data;
};

export const validateFile = (file, required = true) => {
  if (!file) { if (required) fail(400, 'Debe adjuntar un documento oficial'); return; }
  const b = file.buffer;
  if (!b?.length || b.length > 10 * 1024 * 1024) fail(400, 'El archivo debe tener contenido y no superar 10 MB');
  const valid = {
    'application/pdf': b.subarray(0,5).toString() === '%PDF-',
    'image/jpeg': b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    'image/png': b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
    'image/webp': b.subarray(0,4).toString() === 'RIFF' && b.subarray(8,12).toString() === 'WEBP',
  };
  if (!valid[file.mimetype]) fail(400, 'Formato inválido: use PDF, JPG, PNG o WEBP');
};

export const solicitudTransition = (row, action, user) => {
  const boss = ['administrador','jefatura'].includes(user.rol);
  const assigned = user.es_ti && Number(row.asignado_a) === Number(user.id);
  if (['asignar','observar','rechazar','cerrar'].includes(action) && !boss) fail(403, 'Acción exclusiva de Jefatura');
  if (['iniciar','responder','devolver'].includes(action) && !assigned) fail(403, 'Solo el responsable asignado puede realizar esta acción');
  const transitions = {
    asignar: { recibida:'asignada', asignada:'asignada', en_atencion:'asignada', observada:'asignada' },
    iniciar: { asignada:'en_atencion' },
    responder: { en_atencion:'atendida' },
    devolver: { asignada:'recibida', en_atencion:'recibida' },
    observar: { recibida:'observada', asignada:'observada', en_atencion:'observada' },
    rechazar: { recibida:'rechazada', asignada:'rechazada', en_atencion:'rechazada', observada:'rechazada' },
    cerrar: { atendida:'cerrada' },
  };
  const next = transitions[action]?.[row.estado];
  if (!next) fail(409, 'La acción no corresponde al estado actual. Actualice la bandeja.');
  return next;
};

export const pedidoTransition = (row, action, user) => {
  const boss = ['administrador','jefatura'].includes(user.rol);
  if (action === 'aprobar' && boss && row.estado === 'solicitado') return 'aprobado';
  if (action === 'llegada' && ['almacen','administrador'].includes(user.rol) && ['solicitado','aprobado'].includes(row.estado)) return 'en_almacen';
  if (action === 'derivar' && boss && row.estado === 'en_almacen') return 'en_almacen';
  if (action === 'recepcionar' && user.es_ti && row.estado === 'en_almacen') return 'recepcionado';
  if ((action === 'recepcionar' && !user.es_ti) || (action === 'derivar' && !boss) || (action === 'aprobar' && !boss) || (action === 'llegada' && !['almacen','administrador'].includes(user.rol))) fail(403, 'No tiene permisos para esta acción');
  fail(409, 'El pedido ya cambió de estado o la acción no corresponde. Actualice la bandeja.');
};
