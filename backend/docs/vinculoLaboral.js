const responses = {
  200: { description: 'Operación exitosa' }, 400: { description: 'Campos, fechas o versión inválidos' },
  401: { description: 'No autenticado' }, 403: { description: 'Sin permiso o cuenta deshabilitada' },
  404: { description: 'Personal o vínculo no encontrado' }, 409: { description: 'Solapamiento, versión desactualizada o conflicto con asignaciones' },
};
const parameter = (name) => ({ name, in: 'path', required: true, schema: { type: 'integer', minimum: 1 } });
const operation = (summary) => ({ summary, tags: ['Vínculo laboral'], security: [{ bearerAuth: [] }], responses });
const requestBody = (updating) => ({ required: true, content: { 'application/json': { schema: {
  type: 'object', required: ['tipo_vinculo', 'fecha_inicio', 'estado', ...(updating ? ['version', 'motivo_cambio'] : [])],
  properties: {
    tipo_vinculo: { type: 'string', enum: ['CAS', 'CAP', 'Practicante', 'Locador de servicios', 'Personal de confianza', 'Servir'] },
    fecha_inicio: { type: 'string', format: 'date' }, fecha_fin: { type: 'string', format: 'date', nullable: true },
    estado: { type: 'string', enum: ['vigente', 'finalizado'], description: 'Habilitación manual. La vigencia efectiva depende también de las fechas.' },
    observaciones: { type: 'string', maxLength: 2000 }, motivo_cambio: { type: 'string', maxLength: 500 }, version: { type: 'integer', minimum: 1 },
  },
} } } });

export const vinculoLaboralPaths = {
  '/api/personal/{id}/vinculos': {
    parameters: [parameter('id')],
    get: { ...operation('Consultar personal, períodos laborales e historial'), description: 'Administración, Jefatura/TI, Técnico, Almacén/Logística y Auditor (consulta).' },
    post: { ...operation('Registrar un período laboral'), description: 'Administración, Jefatura/TI, Técnico y Almacén/Logística. No admite períodos habilitados superpuestos.',
      responses: { ...responses, 201: { description: 'Vínculo registrado con historial y auditoría' } }, requestBody: requestBody(false) },
  },
  '/api/personal/{id}/vinculos/{vinculoId}': {
    parameters: [parameter('id'), parameter('vinculoId')],
    put: { ...operation('Actualizar o finalizar un vínculo con motivo y control de versión'), requestBody: requestBody(true) },
  },
};
