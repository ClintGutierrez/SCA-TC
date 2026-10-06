const CONEXIONES = ['USB', 'Inalámbrico', 'Bluetooth'];

const CAMPOS_COMPUTO = [
  { name: 'procesador', label: 'Procesador', required: true, placeholder: 'Intel Core i7 13va Gen' },
  { name: 'ram', label: 'Memoria RAM', required: true, placeholder: '16 GB DDR5' },
  { name: 'almacenamiento', label: 'Almacenamiento', required: true, placeholder: 'SSD 512 GB NVMe' },
];

export const GUIA_ESCANER = [
  ['Velocidad de escaneo', '15 a 30 páginas por minuto', '60 a más de 140 páginas por minuto'],
  ['Ciclo de trabajo diario', '50 a 1,000 páginas al día', '5,000 a más de 100,000 páginas al día'],
  ['Capacidad del alimentador (ADF)', '20 a 50 hojas', '100 a 500 hojas o más'],
  ['Durabilidad y rodillos', 'Materiales estándar, requieren mantenimiento frecuente', 'Componentes de alta resistencia, para millones de pasadas'],
  ['Manejo de papel', 'Sensible a grapas, papel arrugado o de distinto grosor', 'Avanzado, con sensores ultrasónicos contra atascos y doble alimentación'],
];

export const sugerirClasificacionEscaner = ({ velocidadPpm, cicloDiario, capacidadAdf } = {}) => {
  const datos = [
    [velocidadPpm, 30, 60],
    [cicloDiario, 1000, 5000],
    [capacidadAdf, 50, 100],
  ].filter(([valor]) => valor !== undefined && valor !== '');

  if (datos.length === 0) return null;
  if (datos.every(([valor, , minimoAlto]) => Number(valor) >= minimoAlto)) return 'Alto consumo';
  if (datos.every(([valor, maximoRegular]) => Number(valor) <= maximoRegular)) return 'Regular';
  return null;
};

export const TIPOS = [
  {
    value: 'laptop',
    label: 'Laptop',
    usaMac: true,
    campos: [
      ...CAMPOS_COMPUTO,
      { name: 'pantalla', label: 'Pantalla', placeholder: '15.6" FHD' },
      { name: 'sistemaOperativo', label: 'Sistema operativo', placeholder: 'Windows 11 Pro' },
    ],
  },
  {
    value: 'computadora',
    label: 'Computadora',
    usaMac: true,
    campos: [
      ...CAMPOS_COMPUTO,
      { name: 'sistemaOperativo', label: 'Sistema operativo', placeholder: 'Windows 11 Pro' },
    ],
  },
  {
    value: 'servidor',
    label: 'Servidor',
    usaMac: true,
    campos: [
      ...CAMPOS_COMPUTO,
      { name: 'formato', label: 'Formato', options: ['Rack', 'Torre', 'Blade'] },
      { name: 'sistemaOperativo', label: 'Sistema operativo', placeholder: 'Windows Server 2022' },
    ],
  },
  {
    value: 'switch',
    label: 'Switch',
    usaMac: true,
    campos: [
      { name: 'numPuertos', label: 'Número de puertos', required: true, type: 'number', placeholder: '24' },
      { name: 'velocidad', label: 'Velocidad', options: ['100 Mbps', '1 Gbps', '10 Gbps'] },
      { name: 'administrable', label: 'Administración', options: ['Administrable', 'No administrable'] },
      { name: 'poe', label: 'PoE', options: ['Sí', 'No'] },
    ],
  },
  {
    value: 'nas',
    label: 'NAS',
    usaMac: true,
    campos: [
      { name: 'bahias', label: 'Número de bahías', required: true, type: 'number', placeholder: '4' },
      { name: 'capacidadTotal', label: 'Capacidad total', required: true, placeholder: '16 TB' },
      { name: 'tipoDiscos', label: 'Tipo de discos', options: ['HDD', 'SSD', 'Mixto'] },
      { name: 'raid', label: 'Configuración RAID', placeholder: 'RAID 5' },
    ],
  },
  {
    value: 'camara',
    label: 'Cámara',
    usaMac: true,
    campos: [
      { name: 'tipoCamara', label: 'Tipo de cámara', required: true, options: ['IP', 'Analógica', 'Webcam'] },
      { name: 'resolucion', label: 'Resolución', required: true, placeholder: '4 MP (1080p)' },
      { name: 'visionNocturna', label: 'Visión nocturna', options: ['Sí', 'No'] },
    ],
  },
  {
    value: 'escaner',
    label: 'Escáner',
    usaMac: false,
    campos: [
      { name: 'clasificacion', label: 'Clasificación', required: true, options: ['Regular', 'Alto consumo'], botones: true, completo: true },
      { name: 'tipoEscaner', label: 'Tipo de escáner', options: ['Plano', 'Alimentador automático', 'Portátil'] },
      { name: 'velocidadPpm', label: 'Velocidad (páginas por minuto)', type: 'number', placeholder: '30' },
      { name: 'cicloDiario', label: 'Ciclo de trabajo (páginas al día)', type: 'number', placeholder: '1000' },
      { name: 'capacidadAdf', label: 'Capacidad del alimentador (hojas)', type: 'number', placeholder: '50' },
      { name: 'resolucionDpi', label: 'Resolución', placeholder: '600 dpi' },
    ],
  },
  {
    value: 'monitor',
    label: 'Monitor',
    usaMac: false,
    campos: [
      { name: 'tamano', label: 'Tamaño', required: true, placeholder: '24"' },
      { name: 'resolucion', label: 'Resolución', required: true, placeholder: '1920x1080' },
      { name: 'tipoPanel', label: 'Tipo de panel', options: ['IPS', 'VA', 'TN'] },
      { name: 'puertos', label: 'Puertos', placeholder: 'HDMI, DisplayPort' },
    ],
  },
  {
    value: 'impresora',
    label: 'Impresora',
    usaMac: true,
    campos: [
      { name: 'tecnologia', label: 'Tecnología', required: true, options: ['Láser', 'Inyección de tinta', 'Térmica'] },
      { name: 'color', label: 'Color', options: ['Color', 'Monocromo'] },
      { name: 'conectividad', label: 'Conectividad', placeholder: 'USB, Wi-Fi, Ethernet' },
    ],
  },
  {
    value: 'teclado',
    label: 'Teclado',
    usaMac: false,
    campos: [
      { name: 'conexion', label: 'Conexión', required: true, options: CONEXIONES },
      { name: 'tipoTeclado', label: 'Tipo de teclado', options: ['Membrana', 'Mecánico'] },
      { name: 'idioma', label: 'Idioma', placeholder: 'Español (Latinoamérica)' },
    ],
  },
  {
    value: 'mouse',
    label: 'Mouse',
    usaMac: false,
    campos: [
      { name: 'conexion', label: 'Conexión', required: true, options: CONEXIONES },
      { name: 'tipoMouse', label: 'Tipo de mouse', options: ['Óptico', 'Láser'] },
      { name: 'dpi', label: 'Resolución (DPI)', placeholder: '1600' },
    ],
  },
  {
    value: 'otro',
    label: 'Otro',
    usaMac: true,
    campos: [],
  },
];

export const getTipo = (value) => TIPOS.find((tipo) => tipo.value === value);