const secured = (summary) => ({ summary, tags:['Gestión TI'], security:[{ bearerAuth:[] }], responses:{ 200:{ description:'Operación completada' },400:{ description:'Datos inválidos' },403:{ description:'Sin permisos' },409:{ description:'Estado incompatible o registro duplicado' } } });
const jsonBody = { required:true,content:{ 'application/json':{ schema:{ type:'object' } } } };
const multipart = (response = false) => ({ required:true,content:{ 'multipart/form-data':{ schema:{ type:'object',required:['datos',...(response ? [] : ['documento'])],properties:{ datos:{ type:'string',description:response ? 'JSON: accion (asignar/iniciar/responder/devolver/observar/rechazar/cerrar), usuarioId, comentario, acciones' : 'JSON del formulario; confirmarDuplicado=true permite confirmar una advertencia de duplicado' },[response ? 'adjuntos' : 'documento']:response ? { type:'array',maxItems:3,items:{ type:'string',format:'binary' } } : { type:'string',format:'binary' } } } } } });
const id = { name:'id',in:'path',required:true,schema:{ type:'integer',minimum:1 } };
export const gestionTIPaths = {
  '/api/gestion-ti/solicitudes':{
    get:secured('Listar solicitudes: Jefatura y auditor ven todas; TI ve sus asignadas'),
    post:{ summary:'Registrar solicitud pública con documento oficial de hasta 10 MB',tags:['Gestión TI'],requestBody:multipart(),responses:{ 201:{ description:'Solicitud recibida, código único y clave privada de consulta válida 7 días' },400:{ description:'Validación fallida' },409:{ description:'Duplicada: confirmar o cancelar' } } },
  },
  '/api/gestion-ti/solicitudes/{id}':{ parameters:[id],get:secured('Detalle, respuestas, documentos, historial y pedidos vinculados') },
  '/api/gestion-ti/solicitudes/{id}/acciones':{ parameters:[id],post:{ ...secured('Ejecutar transición de solicitud según estado y responsable'),requestBody:multipart(true) } },
  '/api/gestion-ti/personal-ti':{ get:secured('Personal activo de TI disponible para asignación; exclusivo de Jefatura') },
  '/api/gestion-ti/documentos/{id}':{ parameters:[id],get:{ ...secured('Descargar archivo privado con control de acceso por solicitud'),responses:{ 200:{ description:'Archivo binario para descarga' } } } },
  '/api/gestion-ti/consulta/acceso':{ post:{ summary:'Solicitar clave al correo registrado (respuesta genérica, clave válida 30 minutos)',tags:['Gestión TI'],requestBody:jsonBody,responses:{ 200:{ description:'Si coinciden código y correo, se encola el envío' } } } },
  '/api/gestion-ti/consulta':{ post:{ summary:'Consultar estado y respuesta con codigo y clave privada',tags:['Gestión TI'],requestBody:jsonBody,responses:{ 200:{ description:'Estado, respuestas, observaciones y metadatos de adjuntos' },404:{ description:'Código o clave incorrectos o vencidos' } } } },
  '/api/gestion-ti/consulta/documentos/{id}':{ parameters:[id],post:{ summary:'Descargar documento de la solicitud identificada por codigo y clave',tags:['Gestión TI'],requestBody:jsonBody,responses:{ 200:{ description:'Archivo binario' },404:{ description:'Documento o acceso inválidos' } } } },
  '/api/gestion-ti/pedidos':{ get:secured('Listar pedidos y recepciones'),post:{ ...secured('Crear pedido solicitado: numero, descripcion, cantidad, solicitudId opcional'),requestBody:jsonBody } },
  '/api/gestion-ti/pedidos/{id}/acciones':{ parameters:[id],post:{ ...secured('Acciones: aprobar, llegada, derivar y recepcionar. Fecha ISO; recepción exige conformidad booleana'),requestBody:jsonBody } },
  '/api/gestion-ti/pedidos/{id}/historial':{ parameters:[id],get:secured('Consultar bitácora del pedido') },
  '/api/gestion-ti/pedidos/{id}/bienes':{ parameters:[id],post:{ ...secured('Vincular bienId del inventario a pedido recepcionado, sin superar cantidad'),requestBody:jsonBody } },
  '/api/gestion-ti/notificaciones':{ get:secured('Alertas internas del usuario y estado de entrega del correo') },
  '/api/gestion-ti/notificaciones/{id}/leida':{ parameters:[id],post:secured('Marcar una alerta propia como leída') },
};
