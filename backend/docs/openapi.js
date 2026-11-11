import { gestionTIPaths } from './gestionTI.js';
import { vinculoLaboralPaths } from './vinculoLaboral.js';

const secured = (summary, tags, responses = { 200: { description: 'Operacion exitosa' } }) => ({
  summary,
  tags,
  security: [{ bearerAuth: [] }],
  responses,
});

const reportesResponses = {
  200: { description: 'Operacion exitosa' },
  401: { description: 'No autenticado' },
  403: { description: 'Permisos insuficientes' },
};

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
    { name: 'Vínculo laboral', description: 'CUS12: períodos del personal, vigencia, historial y auditoría' },
    { name: 'Gestión TI', description: 'Solicitudes, pedidos, documentos privados y notificaciones' },
    { name: 'Health', description: 'Estado del servidor' },
    { name: 'Autenticacion', description: 'Inicio y cierre de sesion' },
    { name: 'Usuarios', description: 'Gestion de usuarios' },
    { name: 'Bienes', description: 'Gestion de bienes informaticos' },
    { name: 'Mantenimiento', description: 'Gestion de mantenimientos' },
    { name: 'Depreciacion', description: 'Gestion de depreciacion' },
    { name: 'Reportes', description: 'Reportes del sistema' },
  ],
  paths: {
    ...vinculoLaboralPaths,
    ...gestionTIPaths,
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
        ...secured('Crear depreciacion desde el ano de adquisicion del bien', ['Depreciacion'], {
          201: { description: 'Depreciacion creada' },
          400: { description: 'Datos invalidos' },
          401: { description: 'No autenticado' },
          403: { description: 'Permisos insuficientes' },
          404: { description: 'Bien no encontrado' },
          409: { description: 'El bien ya tiene depreciacion registrada o su fecha de adquisicion no es valida' },
        }),
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['bienId', 'valorInicial'], properties: {
              bienId: { type: 'integer', minimum: 1 },
              valorInicial: { type: 'number', minimum: 0, maximum: 9999999999.99, multipleOf: 0.01 },
              porcentajeAnual: { type: 'number', minimum: 0, maximum: 100, multipleOf: 0.01, default: 20 },
            },
          } } },
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
      put: secured('Recalcular en linea recta desde el ano de adquisicion', ['Depreciacion'], {
        200: { description: 'Importe recalculado para el ano calendario actual en America/Lima' },
        400: { description: 'Identificador invalido' },
        404: { description: 'Depreciacion no encontrada' },
        409: { description: 'Base distinta del ano de adquisicion, cronologia o registros duplicados requieren conciliacion' },
      }),
    },
    '/api/reportes/inventario': {
      get: secured('Generar reporte de inventario (administrador, jefatura, tecnico, auditor)', ['Reportes'], reportesResponses),
    },
    '/api/reportes/depreciacion': {
      get: secured('Generar reporte de depreciacion (administrador, jefatura, tecnico, auditor)', ['Reportes'], reportesResponses),
    },
    '/api/reportes/asignaciones': {
      get: secured('Generar reporte de asignaciones (administrador, jefatura, tecnico, auditor)', ['Reportes'], reportesResponses),
    },
    '/api/reportes/mantenimiento': {
      get: secured('Generar reporte de mantenimiento (administrador, jefatura, tecnico, auditor)', ['Reportes'], reportesResponses),
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
};
