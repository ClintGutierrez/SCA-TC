const secured = (summary) => ({ summary, tags:['Gestión TI'], security:[{ bearerAuth:[] }], responses:{ 200:{ description:'Operación completada' },400:{ description:'Datos inválidos' },403:{ description:'Sin permisos' },409:{ description:'Estado incompatible o registro duplicado' } } });
const formAuthErrors = { 401:{ description:'Sesión requerida o vencida' },403:{ description:'Cuenta deshabilitada' } };
const jsonBody = { required:true,content:{ 'application/json':{ schema:{ type:'object' } } } };
const consultaBody = { required:true,content:{ 'application/json':{ schema:{
  type:'object',required:['codigo','dni'],properties:{
    codigo:{ type:'string',description:'Número de registro de la solicitud' },
    dni:{ type:'string',pattern:'^\\d{8}$',description:'DNI de quien registró la solicitud' },
  },
} } } };
const multipart = (response = false) => ({ required:true,content:{ 'multipart/form-data':{ schema:{ type:'object',required:['datos',...(response ? [] : ['documento'])],properties:{ datos:{ type:'string',description:response ? 'JSON: accion (asignar/iniciar/responder/devolver/observar/rechazar/cerrar), usuarioId, comentario, acciones' : 'JSON del formulario; confirmarDuplicado=true permite confirmar una advertencia de duplicado' },[response ? 'adjuntos' : 'documento']:response ? { type:'array',maxItems:3,items:{ type:'string',format:'binary' } } : { type:'string',format:'binary' } } } } } });
const id = { name:'id',in:'path',required:true,schema:{ type:'integer',minimum:1 } };
export const gestionTIPaths = {
  '/api/gestion-ti/solicitudes':{
    get:secured('Listar solicitudes: Jefatura y auditor ven todas; TI ve sus asignadas'),
    post:{ ...secured('Registrar una solicitud con documento oficial de hasta 10 MB'),requestBody:multipart(),responses:{ 201:{ description:'Solicitud recibida con número de registro único' },400:{ description:'Validación fallida' },...formAuthErrors,409:{ description:'Duplicada: confirmar o cancelar' } } },
  },
  '/api/gestion-ti/solicitudes/{id}':{ parameters:[id],get:secured('Detalle, respuestas, documentos, historial y pedidos vinculados') },
  '/api/gestion-ti/solicitudes/{id}/acciones':{ parameters:[id],post:{ ...secured('Ejecutar transición de solicitud según estado y responsable'),requestBody:multipart(true) } },
  '/api/gestion-ti/personal-ti':{ get:secured('Personal activo de TI disponible para asignación; exclusivo de Jefatura') },
  '/api/gestion-ti/documentos/{id}':{ parameters:[id],get:{ ...secured('Descargar archivo privado con control de acceso por solicitud'),responses:{ 200:{ description:'Archivo binario para descarga' } } } },
  '/api/gestion-ti/consulta':{ post:{ ...secured('Consultar la solicitud con número de registro y DNI del solicitante'),requestBody:consultaBody,responses:{ 200:{ description:'Estado, respuestas, observaciones y metadatos de adjuntos' },400:{ description:'Datos de consulta inválidos' },...formAuthErrors,404:{ description:'El número de registro y el DNI no coinciden' } } } },
  '/api/gestion-ti/consulta/documentos/{id}':{ parameters:[id],post:{ ...secured('Descargar un documento con número de registro y DNI del solicitante'),requestBody:consultaBody,responses:{ 200:{ description:'Archivo binario' },400:{ description:'Datos de consulta inválidos' },...formAuthErrors,404:{ description:'Documento o acceso inválidos' } } } },
  '/api/gestion-ti/pedidos':{ get:secured('Listar pedidos y recepciones'),post:{ ...secured('Crear pedido solicitado: numero, descripcion, cantidad, solicitudId opcional'),requestBody:jsonBody } },
  '/api/gestion-ti/pedidos/{id}/acciones':{ parameters:[id],post:{ ...secured('Acciones: aprobar, llegada, derivar y recepcionar. Fecha ISO; recepción exige conformidad booleana'),requestBody:jsonBody } },
  '/api/gestion-ti/pedidos/{id}/historial':{ parameters:[id],get:secured('Consultar bitácora del pedido') },
  '/api/gestion-ti/pedidos/{id}/bienes':{ parameters:[id],post:{ ...secured('Vincular bienId del inventario a pedido recepcionado, sin superar cantidad'),requestBody:jsonBody } },
  '/api/gestion-ti/notificaciones':{ get:secured('Alertas internas del usuario y estado de entrega del correo') },
  '/api/gestion-ti/notificaciones/{id}/leida':{ parameters:[id],post:secured('Marcar una alerta propia como leída') },
};
