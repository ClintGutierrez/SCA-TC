export const TIPOS_SOLICITUD_TI = [
  ['nuevo_usuario', 'Equipo para nuevo usuario', 'Dotación inicial para incorporación de personal.'],
  ['asignacion_equipo', 'Asignación de equipo', 'Equipo o monitor adicional para personal en funciones.'],
  ['cambio_equipo', 'Cambio de equipo', 'Reemplazo de equipo asignado por falla u obsolescencia.'],
  ['cambio_ubicacion', 'Cambio de ubicación', 'Traslado físico de equipos entre sedes, pisos u oficinas.'],
  ['impresora_escaner', 'Asignación de impresora o escáner', 'Habilitación o asignación de equipo de impresión o digitalización.'],
  ['otro_servicio', 'Otro equipo o servicio de sistemas', 'Periféricos, punto de red, préstamo temporal u otros.'],
];

export const EQUIPOS_PERIFERICOS_TI = [
  ['laptop', 'Laptop'],
  ['computadora', 'Computadora de escritorio'],
  ['monitor', 'Monitor'],
  ['impresora', 'Impresora'],
  ['escaner', 'Escáner'],
  ['periferico', 'Periféricos (teclado, mouse, cámara)'],
  ['red_telefonia', 'Conectividad / Anexo IP / Switch'],
  ['otro', 'Otro equipo o servicio'],
];

export const TIPOS_DOCUMENTO_OFICIAL = [
  'Memorando',
  'Oficio',
  'Informe',
  'Formato de solicitud firmado',
  'Resolución',
];

export const SEDES_TC = [
  'Sede Central',
  'Centro de Lima',
  'Centro de estudios constitucionales',
  'Sede Arequipa',
];

export const AREAS_SUGERIDAS_TC = [
  'Secretaría General',
  'Gabinete de Asesores Jurisdiccionales',
  'Oficina de Tecnologías de la Información',
  'Dirección General de Administración',
  'Oficina de Gestión y Desarrollo Humano',
  'Oficina de Logística y Control Patrimonial',
  'Oficina de Contabilidad y Tesorería',
  'Centro de Estudios Constitucionales',
  'Procuraduría Pública',
  'Órgano de Control Institucional',
];

export const getTipoLabel = (id) => TIPOS_SOLICITUD_TI.find(([key]) => key === id)?.[1] || id;
export const getEquipoLabel = (id) => EQUIPOS_PERIFERICOS_TI.find(([key]) => key === id)?.[1] || id;
