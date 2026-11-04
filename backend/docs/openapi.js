const secured = (summary, tags, responses = { 200: { description: 'Operacion exitosa' } }) => ({
  summary,
  tags,
  security: [{ bearerAuth: [] }],
  responses,
});

const idParameter = (name = 'id') => ({
  name,
  in: 'path',
  required: true,
  schema: { type: 'string' },
});

const crudPaths = (resource, tag, options = {}) => ({
  [`/api/${resource}`]: {
    get: secured(`Listar ${tag.toLowerCase()}`, [tag]),
    post: {
      ...secured(`Crear ${tag.toLowerCase()}`, [tag], {
        201: { description: 'Recurso creado' },
        400: { description: 'Datos invalidos' },
        401: { description: 'No autenticado' },
        403: { description: 'Permisos insuficientes' },
      }),
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object' } } },
      },
    },
  },
  [`/api/${resource}/{id}`]: {
    parameters: [idParameter()],
    get: secured(`Obtener ${tag.toLowerCase()}`, [tag]),
    put: {
      ...secured(`Actualizar ${tag.toLowerCase()}`, [tag], {
        200: { description: 'Recurso actualizado' },
        400: { description: 'Datos invalidos' },
        401: { description: 'No autenticado' },
        403: { description: 'Permisos insuficientes' },
      }),
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object' } } },
      },
    },
    delete: options.noDelete ? undefined : secured(`Eliminar ${tag.toLowerCase()}`, [tag], {
      200: { description: 'Recurso eliminado' },
      401: { description: 'No autenticado' },
      403: { description: 'Permisos insuficientes' },
    }),
  },
});

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'API de Inventario de Bienes Informaticos',
    version: '1.0.0',
    description: 'API REST para la gestion del inventario del Tribunal Constitucional del Peru.',
  },
  servers: [{ url: 'http://localhost:5000', description: 'Servidor local' }],
  tags: [
    { name: 'Health', description: 'Estado del servidor' },
    { name: 'Autenticacion', description: 'Inicio y cierre de sesion' },
    { name: 'Usuarios', description: 'Gestion de usuarios' },
    { name: 'Bienes', description: 'Gestion de bienes informaticos' },
    { name: 'Mantenimiento', description: 'Gestion de mantenimientos' },
    { name: 'Depreciacion', description: 'Gestion de depreciacion' },
    { name: 'Reportes', description: 'Reportes del sistema' },
    { name: 'Pedidos', description: 'Seguimiento de pedidos de almacén y recepción técnica' },
    { name: 'Notificaciones', description: 'Notificaciones del usuario autenticado' },
  ],
  paths: {
    '/api/health': {
      get: {
        summary: 'Verificar estado del servidor',
        tags: ['Health'],
        responses: { 200: { description: 'Servidor funcionando correctamente' } },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Iniciar sesion',
        tags: ['Autenticacion'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: {
          200: { description: 'Sesion iniciada' },
          401: { description: 'Credenciales invalidas' },
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        summary: 'Renovar token de acceso',
        tags: ['Autenticacion'],
        responses: { 200: { description: 'Token renovado' } },
      },
    },
    '/api/auth/logout': {
      post: {
        summary: 'Cerrar sesion',
        tags: ['Autenticacion'],
        responses: { 200: { description: 'Sesion cerrada' } },
      },
    },
    '/api/auth/me': {
      get: secured('Consultar usuario autenticado', ['Autenticacion']),
    },
    ...crudPaths('usuarios', 'Usuarios'),
    ...crudPaths('bienes', 'Bienes'),
    '/api/mantenimiento': {
      get: secured('Listar mantenimientos', ['Mantenimiento']),
      post: {
        ...secured('Crear mantenimiento', ['Mantenimiento'], {
          201: { description: 'Mantenimiento creado' },
          400: { description: 'Datos invalidos' },
          401: { description: 'No autenticado' },
          403: { description: 'Permisos insuficientes' },
        }),
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
      },
    },
    '/api/mantenimiento/{id}': {
      parameters: [idParameter()],
      delete: secured('Eliminar mantenimiento', ['Mantenimiento'], {
        200: { description: 'Mantenimiento eliminado' },
        401: { description: 'No autenticado' },
        403: { description: 'Permisos insuficientes' },
      }),
    },
    '/api/depreciacion': {
      get: secured('Listar depreciacion', ['Depreciacion']),
      post: {
        ...secured('Crear depreciacion', ['Depreciacion'], {
          201: { description: 'Depreciacion creada' },
          400: { description: 'Datos invalidos' },
          401: { description: 'No autenticado' },
          403: { description: 'Permisos insuficientes' },
        }),
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
      },
    },
    '/api/mantenimiento/bien/{bienId}': {
      parameters: [idParameter('bienId')],
      get: secured('Listar mantenimientos de un bien', ['Mantenimiento']),
    },
    '/api/depreciacion/{bienId}': {
      parameters: [idParameter('bienId')],
      get: secured('Obtener depreciacion de un bien', ['Depreciacion']),
      put: secured('Actualizar depreciacion de un bien', ['Depreciacion']),
    },
    '/api/pedidos': {
      get: {
        ...secured('Listar pedidos', ['Pedidos']),
        parameters: [
          { name: 'estado', in: 'query', schema: { type: 'string', enum: ['solicitado', 'en_almacen', 'recepcionado', 'cancelado'] } },
          { name: 'search', in: 'query', description: 'Búsqueda parcial por número de pedido', schema: { type: 'string' } },
        ],
      },
      post: {
        ...secured('Crear pedido', ['Pedidos'], {
          201: { description: 'Pedido creado' },
          400: { description: 'Datos inválidos' },
          403: { description: 'Permisos insuficientes' },
          409: { description: 'El número de pedido ya existe' },
        }),
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['numero_pedido', 'descripcion', 'cantidad'],
                properties: {
                  numero_pedido: { type: 'string' },
                  descripcion: { type: 'string' },
                  cantidad: { type: 'integer', minimum: 1 },
                },
              },
            },
          },
        },
      },
    },
    '/api/pedidos/{id}': {
      parameters: [idParameter()],
      get: secured('Obtener detalle de pedido', ['Pedidos'], {
        200: { description: 'Detalle del pedido' },
        404: { description: 'Pedido no encontrado' },
      }),
    },
    '/api/pedidos/{id}/llegada': {
      parameters: [idParameter()],
      put: {
        ...secured('Registrar llegada a almacén y notificar a jefatura', ['Pedidos'], {
          200: { description: 'Llegada registrada y notificaciones creadas' },
          403: { description: 'Solo el rol almacén puede registrar la llegada' },
          404: { description: 'Pedido no encontrado' },
          409: { description: 'Pedido fuera del estado solicitado' },
        }),
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  fecha_llegada: { type: 'string', format: 'date-time' },
                  observaciones_almacen: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    '/api/pedidos/{id}/derivar': {
      parameters: [idParameter()],
      put: {
        ...secured('Derivar recepción a un usuario de TI', ['Pedidos'], {
          200: { description: 'Pedido derivado y notificación creada' },
          400: { description: 'Usuario destinatario inválido' },
          403: { description: 'Solo jefatura puede derivar pedidos' },
          404: { description: 'Pedido no encontrado' },
          409: { description: 'Pedido fuera del estado en almacén' },
        }),
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['derivado_a_usuario_id'],
                properties: {
                  derivado_a_usuario_id: { type: 'integer' },
                  observaciones_derivacion: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    '/api/pedidos/{id}/recepcionar': {
      parameters: [idParameter()],
      put: {
        ...secured('Registrar recepción técnica', ['Pedidos'], {
          200: { description: 'Recepción registrada' },
          400: { description: 'Conformidad inválida' },
          403: { description: 'Permisos insuficientes' },
          404: { description: 'Pedido no encontrado' },
          409: { description: 'Pedido fuera del estado en almacén o ya recepcionado' },
        }),
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['conformidad'],
                properties: {
                  conformidad: { type: 'string', enum: ['conforme', 'observado', 'no_conforme'] },
                  observaciones_recepcion: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    '/api/notificaciones': {
      get: {
        ...secured('Listar notificaciones del usuario autenticado', ['Notificaciones']),
        parameters: [{ name: 'leida', in: 'query', schema: { type: 'boolean' } }],
      },
    },
    '/api/notificaciones/count': {
      get: secured('Contar notificaciones no leídas', ['Notificaciones']),
    },
    '/api/notificaciones/leer-todas': {
      put: secured('Marcar todas las notificaciones como leídas', ['Notificaciones']),
    },
    '/api/notificaciones/{id}/leer': {
      parameters: [idParameter()],
      put: secured('Marcar una notificación como leída', ['Notificaciones'], {
        200: { description: 'Notificación marcada como leída' },
        404: { description: 'Notificación no encontrada para el usuario' },
      }),
    },
    '/api/reportes/inventario': {
      get: secured('Generar reporte de inventario', ['Reportes']),
    },
    '/api/reportes/depreciacion': {
      get: secured('Generar reporte de depreciacion', ['Reportes']),
    },
    '/api/reportes/asignaciones': {
      get: secured('Generar reporte de asignaciones', ['Reportes']),
    },
    '/api/reportes/mantenimiento': {
      get: secured('Generar reporte de mantenimiento', ['Reportes']),
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
};
