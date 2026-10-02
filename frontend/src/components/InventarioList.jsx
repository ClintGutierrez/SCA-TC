import { useState } from 'react';
import * as api from '../services/api';

const text = (key, label, placeholder, tooltip) => ({ key, label, type: 'text', placeholder, tooltip });
const number = (key, label, placeholder, tooltip) => ({ key, label, type: 'number', placeholder, tooltip });
const select = (key, label, options, tooltip) => ({ key, label, type: 'select', options, tooltip });

const SPECS_POR_TIPO = {
  laptop: [
    text('procesador', 'Procesador', 'Ej: Intel Core i7-1355U (10 nucleos)', 'Modelo y generacion del procesador'),
    text('ram_capacidad', 'RAM (Capacidad)', 'Ej: 16 GB', 'Capacidad total de memoria RAM instalada'),
    select('ram_tipo', 'RAM (Tipo)', ['DDR4', 'DDR5', 'LPDDR5'], 'Tecnologia de la memoria RAM'),
    text('disco_capacidad', 'Disco (Capacidad)', 'Ej: 512 GB', 'Capacidad del disco de almacenamiento'),
    select('disco_tipo', 'Disco (Tipo)', ['SSD NVMe M.2', 'SSD SATA', 'HDD', 'eMMC'], 'Tipo de tecnologia del disco'),
    text('tarjeta_video', 'Tarjeta de Video', 'Ej: Intel Iris Xe Graphics', 'GPU integrada o dedicada'),
    text('sistema_operativo', 'Sistema Operativo', 'Ej: Windows 11 Pro 64-bit', 'Sistema operativo preinstalado'),
    text('pantalla_tamano', 'Pantalla (Tamaño)', 'Ej: 14.0 pulgadas', 'Tamano diagonal de la pantalla en pulgadas'),
    text('pantalla_resolucion', 'Pantalla (Resolucion)', 'Ej: FHD (1920x1080) IPS', 'Resolucion y tipo de panel de la pantalla'),
    text('bateria_salud', 'Bateria (Salud)', 'Ej: 95%', 'Porcentaje de salud actual de la bateria'),
    text('cargador_watts', 'Cargador', 'Ej: 65W USB-C', 'Potencia y tipo de conector del cargador'),
    text('camara_web', 'Camara Web', 'Ej: FHD 1080p con obturador', 'Resolucion y caracteristicas de la camara integrada'),
  ],
  computadora: [
    text('procesador', 'Procesador', 'Ej: AMD Ryzen 7 5700G (8 nucleos)', 'Modelo y generacion del procesador'),
    text('ram_capacidad', 'RAM (Capacidad)', 'Ej: 32 GB', 'Capacidad total de memoria RAM instalada'),
    select('ram_tipo', 'RAM (Tipo)', ['DDR4', 'DDR5'], 'Tecnologia de la memoria RAM'),
    text('disco_capacidad', 'Disco (Capacidad)', 'Ej: 1 TB', 'Capacidad del disco de almacenamiento'),
    select('disco_tipo', 'Disco (Tipo)', ['SSD NVMe M.2', 'SSD SATA', 'HDD'], 'Tipo de tecnologia del disco'),
    text('tarjeta_video', 'Tarjeta de Video', 'Ej: NVIDIA GeForce RTX 3060 12GB', 'GPU dedicada o integrada'),
    text('sistema_operativo', 'Sistema Operativo', 'Ej: Windows 11 Pro 64-bit', 'Sistema operativo preinstalado'),
    select('factor_forma', 'Factor de Forma', ['Mid Tower', 'Mini Tower', 'SFF', 'Mini PC'], 'Tipo de gabinete o case del equipo'),
    text('placa_madre', 'Placa Madre', 'Ej: ASUS TUF B550-PLUS', 'Marca y modelo de la placa madre'),
    text('fuente_poder', 'Fuente de Poder', 'Ej: 650W 80 Plus Bronze', 'Potencia y certificacion de la fuente'),
    text('conectividad_red', 'Conectividad Red', 'Ej: Ethernet Gigabit + Wi-Fi 6', 'Interfaces de red disponibles'),
  ],
  all_in_one: [
    text('procesador', 'Procesador', 'Ej: Intel Core i5-13500 (14 nucleos)', 'Modelo y generacion del procesador'),
    text('ram_capacidad', 'RAM (Capacidad)', 'Ej: 16 GB', 'Capacidad total de memoria RAM instalada'),
    select('ram_tipo', 'RAM (Tipo)', ['DDR4', 'DDR5'], 'Tecnologia de la memoria RAM'),
    text('disco_capacidad', 'Disco (Capacidad)', 'Ej: 512 GB', 'Capacidad del disco de almacenamiento'),
    select('disco_tipo', 'Disco (Tipo)', ['SSD NVMe M.2', 'SSD SATA'], 'Tipo de tecnologia del disco'),
    text('tarjeta_video', 'Tarjeta de Video', 'Ej: Intel UHD Graphics 770', 'GPU integrada del equipo'),
    text('sistema_operativo', 'Sistema Operativo', 'Ej: Windows 11 Pro 64-bit', 'Sistema operativo preinstalado'),
    text('pantalla_tamano', 'Pantalla (Tamaño)', 'Ej: 23.8 pulgadas', 'Tamano diagonal de la pantalla integrada'),
    text('pantalla_resolucion', 'Pantalla (Resolucion)', 'Ej: FHD (1920x1080) IPS', 'Resolucion y tipo de panel'),
    select('es_pantalla_tactil', 'Pantalla Tactil', ['No', 'Si'], 'Indica si la pantalla soporta entrada tactil'),
    text('camara_web', 'Camara Web', 'Ej: 5MP retractil integrada', 'Resolucion y tipo de camara integrada'),
    text('parlantes', 'Parlantes', 'Ej: Bang & Olufsen integrados', 'Marca o tipo de parlantes integrados'),
    text('fuente_poder', 'Fuente de Poder', 'Ej: 210W interna 80 Plus Platinum', 'Potencia y tipo de fuente de alimentacion'),
  ],
  router: [
    number('puertos_lan', 'Puertos LAN', 'Ej: 4', 'Cantidad de puertos Ethernet LAN'),
    number('puertos_sfp', 'Puertos SFP', 'Ej: 1', 'Cantidad de puertos de fibra optica SFP'),
    text('velocidad_puertos', 'Velocidad de Puertos', 'Ej: 10/100/1000 Mbps Gigabit', 'Velocidad maxima de los puertos de red'),
    text('procesador', 'Procesador', 'Ej: Dual-Core 880 MHz MT7621A', 'Procesador embebido del router'),
    text('memoria_ram', 'Memoria RAM', 'Ej: 256 MB RAM', 'Memoria RAM del dispositivo de red'),
    text('almacenamiento', 'Almacenamiento', 'Ej: 16 MB Flash', 'Almacenamiento interno Flash/NAND'),
    text('soporte_poe', 'Soporte PoE', 'Ej: PoE pasivo 802.3af/at', 'Tipo de Power over Ethernet soportado'),
    text('sistema_operativo', 'Sistema Operativo', 'Ej: RouterOS Nivel 4', 'Firmware o sistema operativo del router'),
  ],
  impresora: [
    select('tipo_impresion', 'Tipo de Impresion', ['Laser monocromatica', 'Laser color', 'Inyeccion de tinta', 'Matricial', 'Termica'], 'Tecnologia de impresion'),
    text('conectividad', 'Conectividad', 'Ej: Ethernet / Wi-Fi / USB', 'Interfaces de conexion disponibles'),
    text('velocidad_ppm', 'Velocidad (PPM)', 'Ej: 38 ppm', 'Paginas por minuto que puede imprimir'),
    text('tamano_papel', 'Tamaño de Papel', 'Ej: A4, Carta, Oficio', 'Tamanos de papel soportados'),
    text('resolucion', 'Resolucion', 'Ej: 1200 x 1200 dpi', 'Resolucion maxima de impresion en DPI'),
    select('duplex', 'Impresion Duplex', ['Si', 'No'], 'Indica si soporta impresion a doble cara automatica'),
    select('escaner_integrado', 'Escaner Integrado', ['Si', 'No'], 'Indica si tiene escaner o copiadora integrada'),
  ],
  teclado: [
    select('tipo_switch', 'Tipo de Switch', ['Membrana', 'Mecanico Cherry MX', 'Mecanico Outemu', 'Tijera', 'Chiclet'], 'Tecnologia del mecanismo de teclas'),
    select('conexion', 'Conexion', ['USB', 'Bluetooth', 'USB + Bluetooth', 'Inalambrico 2.4GHz', 'PS/2'], 'Tipo de conectividad del teclado'),
    text('idioma', 'Idioma/Layout', 'Ej: Español Latinoamerica', 'Distribucion de teclas e idioma del teclado'),
    select('con_pad_numerico', 'Pad Numerico', ['Si', 'No'], 'Indica si el teclado tiene seccion numerica'),
    select('retroiluminacion', 'Retroiluminacion', ['No', 'Blanca', 'RGB'], 'Tipo de iluminacion de las teclas'),
  ],
  monitor: [
    text('pantalla_tamano', 'Tamaño de Pantalla', 'Ej: 24 pulgadas', 'Tamaño diagonal del monitor en pulgadas'),
    text('pantalla_resolucion', 'Resolucion', 'Ej: FHD (1920x1080)', 'Resolucion nativa del panel'),
    select('tipo_panel', 'Tipo de Panel', ['IPS', 'VA', 'TN', 'OLED'], 'Tecnologia del panel de la pantalla'),
    text('frecuencia_hz', 'Frecuencia (Hz)', 'Ej: 75 Hz', 'Tasa de refresco del monitor'),
    text('puertos_video', 'Puertos de Video', 'Ej: HDMI, DisplayPort, VGA', 'Entradas de video disponibles'),
    select('es_curvo', 'Pantalla Curva', ['No', 'Si'], 'Indica si el monitor tiene pantalla curva'),
  ],
  servidor: [
    text('procesador', 'Procesador', 'Ej: Intel Xeon E-2388G (8 nucleos)', 'Modelo del procesador del servidor'),
    text('ram_capacidad', 'RAM (Capacidad)', 'Ej: 64 GB', 'Capacidad total de memoria RAM instalada'),
    select('ram_tipo', 'RAM (Tipo)', ['DDR4 ECC', 'DDR5 ECC', 'DDR4', 'DDR5'], 'Tecnologia de la memoria (ECC para servidores)'),
    text('disco_capacidad', 'Disco (Capacidad)', 'Ej: 2 x 1 TB', 'Capacidad total de almacenamiento (puede ser multiples discos)'),
    select('disco_tipo', 'Disco (Tipo)', ['SSD NVMe', 'SSD SATA', 'HDD SAS', 'HDD SATA'], 'Tipo de disco del servidor'),
    select('raid', 'Configuracion RAID', ['Sin RAID', 'RAID 0', 'RAID 1', 'RAID 5', 'RAID 10'], 'Configuracion de redundancia de discos'),
    text('sistema_operativo', 'Sistema Operativo', 'Ej: Windows Server 2022 / Ubuntu Server 22', 'Sistema operativo del servidor'),
    select('factor_forma', 'Factor de Forma', ['Rack 1U', 'Rack 2U', 'Rack 4U', 'Torre'], 'Formato fisico del servidor'),
    text('fuente_poder', 'Fuente de Poder', 'Ej: 2 x 750W redundante 80 Plus Platinum', 'Potencia y redundancia de las fuentes'),
    text('puertos_red', 'Puertos de Red', 'Ej: 2 x Gigabit + 1 x iLO/IPMI', 'Interfaces de red y gestion remota'),
  ],
  escaner: [
    select('tipo_escaneo', 'Tipo de Escaneo', ['Plano (Flatbed)', 'Alimentador (ADF)', 'Portatil', 'De red'], 'Formato o mecanismo del escaner'),
    text('resolucion', 'Resolucion', 'Ej: 600 x 600 dpi', 'Resolucion optica maxima de escaneo en DPI'),
    text('velocidad_ppm', 'Velocidad (PPM)', 'Ej: 25 ppm', 'Paginas por minuto que puede escanear'),
    text('tamano_papel', 'Tamano de Papel', 'Ej: A4, Carta, Oficio', 'Tamanos de papel soportados'),
    text('conectividad', 'Conectividad', 'Ej: USB 3.0 / Ethernet / Wi-Fi', 'Interfaces de conexion disponibles'),
    select('duplex', 'Escaneo Duplex', ['Si', 'No'], 'Indica si soporta escaneo a doble cara automatico'),
  ],
  mouse: [
    select('tipo_sensor', 'Tipo de Sensor', ['Optico', 'Laser', 'BlueTrack'], 'Tecnologia del sensor de seguimiento'),
    select('conexion', 'Conexion', ['USB', 'Bluetooth', 'Inalambrico 2.4GHz', 'USB + Bluetooth'], 'Tipo de conectividad del mouse'),
    text('dpi', 'DPI', 'Ej: 1600 DPI', 'Sensibilidad maxima del sensor en DPI'),
    text('botones', 'Botones', 'Ej: 5 botones + scroll', 'Cantidad de botones programables'),
    select('ergonomia', 'Ergonomia', ['Estandar', 'Ergonomico', 'Vertical', 'Ambidiestro'], 'Diseno ergonomico del mouse'),
  ],
  switch_: [
    text('puertos', 'Cantidad de Puertos', 'Ej: 24 puertos + 4 SFP', 'Total de puertos Ethernet y SFP disponibles'),
    select('velocidad_puertos', 'Velocidad de Puertos', ['Fast Ethernet 100Mbps', 'Gigabit 1Gbps', '10 Gigabit'], 'Velocidad maxima de los puertos'),
    select('gestionable', 'Gestionable', ['No gestionable', 'Smart Managed', 'Gestionable L2', 'Gestionable L3'], 'Nivel de administracion del switch'),
    select('soporte_poe', 'Soporte PoE', ['No', 'PoE (802.3af)', 'PoE+ (802.3at)', 'PoE++ (802.3bt)'], 'Tipo de Power over Ethernet soportado'),
    select('rack_montable', 'Montaje en Rack', ['Si', 'No'], 'Indica si el switch se puede montar en rack 19 pulgadas'),
    text('presupuesto_poe', 'Presupuesto PoE', 'Ej: 370W', 'Potencia total disponible para puertos PoE'),
  ],
  nas: [
    text('bahias_disco', 'Bahias de Disco', 'Ej: 4 bahias 3.5" hot-swap', 'Cantidad y tipo de bahias para discos'),
    text('capacidad_total', 'Capacidad Total', 'Ej: 4 x 4 TB = 16 TB bruto', 'Capacidad bruta total instalada'),
    text('procesador', 'Procesador', 'Ej: Intel Celeron J4125 Quad-Core', 'Procesador embebido del NAS'),
    text('memoria_ram', 'Memoria RAM', 'Ej: 4 GB DDR4', 'Memoria RAM del dispositivo NAS'),
    text('raid_soportado', 'RAID Soportado', 'Ej: RAID 0, 1, 5, 6, 10, JBOD', 'Niveles de RAID que soporta el NAS'),
    text('conectividad', 'Conectividad', 'Ej: 2 x Gigabit Ethernet + USB 3.2', 'Interfaces de red y puertos de expansion'),
    text('sistema_operativo', 'Sistema Operativo', 'Ej: Synology DSM 7 / QNAP QTS 5', 'Sistema operativo o firmware del NAS'),
  ],
  camara: [
    select('tipo_camara', 'Tipo de Camara', ['Seguridad IP (Domo)', 'Seguridad IP (Bullet)', 'Seguridad IP (PTZ)', 'Webcam USB', 'Videoconferencia'], 'Formato y uso principal de la camara'),
    text('resolucion', 'Resolucion', 'Ej: 4MP (2560x1440)', 'Resolucion maxima de video o imagen'),
    text('conectividad', 'Conectividad', 'Ej: Ethernet PoE / Wi-Fi / USB', 'Interfaces de conexion de la camara'),
    select('vision_nocturna', 'Vision Nocturna', ['No', 'IR hasta 30m', 'IR hasta 50m', 'ColorVu / Starlight'], 'Capacidad de captura en condiciones de baja luz'),
    text('angulo_vision', 'Angulo de Vision', 'Ej: 108 grados horizontal', 'Campo visual horizontal de la camara'),
    text('almacenamiento', 'Almacenamiento', 'Ej: MicroSD hasta 256GB / NVR', 'Donde se almacenan las grabaciones'),
    text('grado_proteccion', 'Proteccion IP', 'Ej: IP67 (exterior)', 'Grado de proteccion contra agua y polvo'),
  ],
};

const TIPOS_DISPONIBLES = [
  { value: '', label: 'Todos' },
  { value: 'laptop', label: 'Laptop' },
  { value: 'computadora', label: 'Computadora' },
  { value: 'all_in_one', label: 'All in One' },
  { value: 'servidor', label: 'Servidor' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'impresora', label: 'Impresora' },
  { value: 'escaner', label: 'Escaner' },
  { value: 'teclado', label: 'Teclado' },
  { value: 'mouse', label: 'Mouse' },
  { value: 'router', label: 'Router' },
  { value: 'switch_', label: 'Switch' },
  { value: 'nas', label: 'NAS' },
  { value: 'camara', label: 'Camara' },
];

const SPEC_LABELS = Object.fromEntries(
  Object.values(SPECS_POR_TIPO).flat().map(({ key, label }) => [key, label]),
);
const SPEC_ICONS = {
  procesador: 'cpu',
  ram_capacidad: 'memory',
  ram_tipo: 'memory',
  memoria_ram: 'memory',
  disco_capacidad: 'disk',
  disco_tipo: 'disk',
  pantalla_tamano: 'display',
  pantalla_resolucion: 'display',
  camara_web: 'camera',
  tipo_camara: 'camera',
  conectividad: 'display',
  conectividad_red: 'display',
  puertos_red: 'display',
};
const formatSpecLabel = (key) => SPEC_LABELS[key] || key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

function validateField(name, value) {
  const errors = {};
  if (['nombre', 'tipo', 'fechaAdquisicion', 'costo'].includes(name) && !value) {
    errors[name] = 'Este campo es obligatorio';
  }
  if (name === 'direccionMac' && value && !/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(value)) {
    errors[name] = 'Formato invalido. Usa: AA:BB:CC:DD:EE:FF';
  }
  if (name === 'imagenUrl' && value) {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol');
    } catch {
      errors[name] = 'URL invalida';
    }
  }
  if (name === 'costo' && value && Number(value) < 0) {
    errors[name] = 'El costo no puede ser negativo';
  }
  if (name === 'numeroSerie' && value && value.length < 2) {
    errors[name] = 'El numero de serie es muy corto';
  }
  return errors;
}

function fieldClass(hasError) {
  return `w-full rounded-lg border px-4 py-2.5 focus:outline-none focus:ring-2 transition ${
    hasError
      ? 'border-red-500 bg-red-50 focus:ring-red-400'
      : 'border-slate-300 focus:ring-blue-500'
  }`;
}

function Icon({ name, className = 'h-4 w-4' }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.75,
    viewBox: '0 0 24 24',
    className,
    'aria-hidden': true,
  };
  const icons = {
    eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
    plus: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
    loader: <><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></>,
    save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    inactive: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></>,
    inbox: <><path d="M4 4h16l2 11h-6l-2 3h-4l-2-3H2L4 4Z" /><path d="M2 15h6l2 3h4l2-3h6" /></>,
    camera: <><path d="M14 5h-4L8 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-4l-2-2Z" /><circle cx="12" cy="13" r="3" /></>,
    cpu: <><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 9h6v6H9zM9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4" /></>,
    memory: <><path d="M4 7h16v10H4zM7 10v4m4-4v4m4-4v4m4-4v4M7 17v3m5-3v3m5-3v3" /></>,
    disk: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 15h.01M11 15h.01M15 15h2" /></>,
    display: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
    monitor: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    coin: <><circle cx="12" cy="12" r="9" /><path d="M16 8.5c-.8-.7-1.8-1-3-1-1.7 0-3 .8-3 2s1.3 2 3 2 3 .8 3 2-1.3 2-3 2c-1.2 0-2.2-.3-3-1m3-8v13" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9a2.5 2.5 0 1 1 4.2 1.8c-1 .9-1.8 1.2-1.8 2.7M12 17h.01" /></>,
    filter: <><path d="M4 6h16M7 12h10m-7 6h4" /><circle cx="8" cy="6" r="1" /><circle cx="14" cy="12" r="1" /><circle cx="11" cy="18" r="1" /></>,
  };

  return <svg {...common}>{icons[name]}</svg>;
}

function DetailGrid({ rows }) {
  const details = rows.filter(([, value]) => value !== null && value !== undefined && value !== '');
  if (details.length === 0) return null;

  return (
    <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {details.map(([label, value, icon]) => (
        <div key={label} className="flex items-start gap-2">
          {icon && <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />}
          <dt className="shrink-0 font-medium text-slate-500">{label}:</dt>
          <dd className="break-words text-slate-800">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DetailSection({ title, rows }) {
  const details = rows.filter(([, value]) => value !== null && value !== undefined && value !== '');
  if (details.length === 0) return null;
  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <DetailGrid rows={details} />
    </section>
  );
}

function specificationRows(specifications) {
  return Object.entries(specifications || {})
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => [
      formatSpecLabel(key),
      typeof value === 'object' ? JSON.stringify(value) : String(value),
      SPEC_ICONS[key] || 'display',
    ]);
}

export default function InventarioList({ bienes, onRefresh, canCreate, canEdit, canDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [historyBien, setHistoryBien] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [specsBien, setSpecsBien] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    tipo: '',
    marca: '',
    modelo: '',
    numeroSerie: '',
    fechaAdquisicion: '',
    costo: '',
    usuarioAsignado: '',
    ubicacion: '',
    especificaciones: {},
    imagenUrl: '',
    codigoPatrimonial: '',
    direccionMac: '',
    ordenCompra: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => name === 'tipo'
      ? { ...prev, tipo: value, especificaciones: {} }
      : { ...prev, [name]: value });
    setFormErrors(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleFieldBlur = (e) => {
    const { name, value } = e.target;
    setFormErrors(prev => {
      const next = { ...prev };
      delete next[name];
      return { ...next, ...validateField(name, value) };
    });
  };

  const handleSpecChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      especificaciones: { ...prev.especificaciones, [key]: value },
    }));
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      descripcion: '',
      tipo: '',
      marca: '',
      modelo: '',
      numeroSerie: '',
      fechaAdquisicion: '',
      costo: '',
      usuarioAsignado: '',
      ubicacion: '',
      especificaciones: {},
      imagenUrl: '',
      codigoPatrimonial: '',
      direccionMac: '',
      ordenCompra: '',
    });
    setFormErrors({});
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fieldsToValidate = ['nombre', 'tipo', 'fechaAdquisicion', 'costo', 'direccionMac', 'imagenUrl', 'numeroSerie'];
    const errors = fieldsToValidate.reduce((allErrors, name) => ({
      ...allErrors,
      ...validateField(name, formData[name]),
    }), {});
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      if (editingId) {
        const response = await api.updateBien(editingId, formData);
        setSuccessMessage(response.data.message);
      } else {
        await api.createBien(formData);
      }
      resetForm();
      onRefresh();
    } catch (error) {
      console.error('Error:', error);
      alert(error?.response?.data?.error || 'Error al guardar el bien');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (bien) => {
    const parsedSpecifications = typeof bien.especificaciones === 'string'
      ? JSON.parse(bien.especificaciones)
      : bien.especificaciones;
    const especificaciones = parsedSpecifications && typeof parsedSpecifications === 'object' && !Array.isArray(parsedSpecifications)
      ? parsedSpecifications
      : {};
    setFormData({
      nombre: bien.nombre,
      descripcion: bien.descripcion,
      tipo: bien.tipo,
      marca: bien.marca,
      modelo: bien.modelo,
      numeroSerie: bien.numero_serie,
      fechaAdquisicion: bien.fecha_adquisicion?.slice(0, 10) || '',
      costo: bien.costo,
      usuarioAsignado: bien.usuario_asignado,
      ubicacion: bien.ubicacion,
      especificaciones,
      imagenUrl: bien.imagen_url || '',
      codigoPatrimonial: bien.codigo_patrimonial || '',
      direccionMac: bien.direccion_mac || '',
      ordenCompra: bien.orden_compra || '',
    });
    setFormErrors({});
    setEditingId(bien.id);
    setShowForm(true);
  };

  const handleShowHistory = async (bien) => {
    setHistoryBien(bien);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const response = await api.getHistorialBien(bien.id);
      setHistory(response.data);
    } catch (error) {
      console.error('Error cargando historial:', error);
      setHistoryBien(null);
      alert(error?.response?.data?.error || 'Error al cargar el historial del bien');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este bien?')) {
      setLoading(true);
      try {
        await api.deleteBien(id);
        onRefresh();
      } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar el bien');
      } finally {
        setLoading(false);
      }
    }
  };

  const bienesFiltrados = filtroTipo
    ? bienes.filter((bien) => bien.tipo === filtroTipo)
    : bienes;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Inventario de Bienes</h1>
          <p className="text-slate-600 mt-2">Total: {bienesFiltrados.length} equipos</p>
        </div>
        {canCreate ? (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
            disabled={loading}
          >
            <Icon name="plus" className="h-5 w-5" /> Agregar Equipo
          </button>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
            Modo lectura para tu perfil
          </div>
        )}
      </div>

      {/* Formulario */}
      {successMessage && (
        <div role="status" className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          <span>{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage('')} aria-label="Cerrar mensaje" className="ml-4 text-green-700 hover:text-green-900">
            <Icon name="close" />
          </button>
        </div>
      )}

      {showForm && (canCreate || canEdit) && (
        <div
          className={editingId ? 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4' : ''}
          role={editingId ? 'presentation' : undefined}
          onClick={editingId ? (event) => {
            if (event.target === event.currentTarget) resetForm();
          } : undefined}
        >
          <section
            className={`bg-white rounded-xl shadow-md border border-slate-200 p-6 overflow-hidden ${editingId ? 'max-h-[90vh] w-full max-w-4xl overflow-y-auto' : ''}`}
            role={editingId ? 'dialog' : undefined}
            aria-modal={editingId ? 'true' : undefined}
            aria-labelledby="asset-form-title"
          >
          <h3 id="asset-form-title" className="text-xl font-bold text-slate-900 mb-6">
            {editingId ? 'Actualizar Ficha Técnica de Bien Informático' : 'Registrar Nuevo Bien'}
          </h3>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nombre *</label>
                <input
                  type="text"
                  name="nombre"
                  placeholder="Nombre del equipo"
                  value={formData.nombre}
                  onChange={handleInputChange}
                  onBlur={handleFieldBlur}
                  onFocus={() => setFormErrors(prev => ({ ...prev, nombre: undefined }))}
                  autoFocus={Boolean(editingId)}
                  className={fieldClass(Boolean(formErrors.nombre))}
                />
                {formErrors.nombre && <p className="mt-1 text-xs text-red-600">{formErrors.nombre}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tipo *</label>
                <select
                  name="tipo"
                  value={formData.tipo}
                  onChange={handleInputChange}
                  onBlur={handleFieldBlur}
                  onFocus={() => setFormErrors(prev => ({ ...prev, tipo: undefined }))}
                  className={fieldClass(Boolean(formErrors.tipo))}
                >
                  <option value="">Selecciona tipo</option>
                  <option value="laptop">Laptop</option>
                  <option value="computadora">Computadora (Torre / Escritorio)</option>
                  <option value="all_in_one">All in One (Todo en Uno)</option>
                  <option value="servidor">Servidor</option>
                  <option value="monitor">Monitor</option>
                  <option value="impresora">Impresora</option>
                  <option value="escaner">Escaner</option>
                  <option value="teclado">Teclado</option>
                  <option value="mouse">Mouse</option>
                  <option value="router">Router</option>
                  <option value="switch_">Switch de Red</option>
                  <option value="nas">NAS (Almacenamiento en Red)</option>
                  <option value="camara">Camara</option>
                  <option value="otro">Otro</option>
                </select>
                {formErrors.tipo && <p className="mt-1 text-xs text-red-600">{formErrors.tipo}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Marca</label>
                <input
                  type="text"
                  name="marca"
                  placeholder="Marca"
                  value={formData.marca}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Modelo</label>
                <input
                  type="text"
                  name="modelo"
                  placeholder="Modelo"
                  value={formData.modelo}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Serie</label>
                <input
                  type="text"
                  name="numeroSerie"
                  placeholder="Número de serie"
                  value={formData.numeroSerie}
                  onChange={handleInputChange}
                  onBlur={handleFieldBlur}
                  onFocus={() => setFormErrors(prev => ({ ...prev, numeroSerie: undefined }))}
                  className={fieldClass(Boolean(formErrors.numeroSerie))}
                />
                {formErrors.numeroSerie && <p className="mt-1 text-xs text-red-600">{formErrors.numeroSerie}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Descripción</label>
              <textarea
                name="descripcion"
                placeholder="Descripción del equipo"
                value={formData.descripcion}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                rows="3"
              />
            </div>

            {SPECS_POR_TIPO[formData.tipo] && (
              <section className="space-y-4 border-t border-slate-200 pt-5">
                <div>
                  <h4 className="text-lg font-semibold text-slate-900">
                    Especificaciones Tecnicas - {TIPOS_DISPONIBLES.find(({ value }) => value === formData.tipo)?.label || formData.tipo}
                  </h4>
                  <p className="mt-1 text-sm text-slate-500">Los campos se adaptan segun el tipo seleccionado.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {SPECS_POR_TIPO[formData.tipo].map((spec) => (
                    <div key={spec.key}>
                      <label htmlFor={`spec-${spec.key}`} className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                        <Icon name={SPEC_ICONS[spec.key] || 'display'} />
                        {spec.label}
                        <span title={spec.tooltip} aria-label={spec.tooltip} className="cursor-help text-slate-400">
                          <Icon name="help" className="h-4 w-4" />
                        </span>
                      </label>
                      {spec.type === 'select' ? (
                        <select
                          id={`spec-${spec.key}`}
                          value={formData.especificaciones[spec.key] ?? ''}
                          onChange={(event) => handleSpecChange(spec.key, event.target.value)}
                          title={spec.tooltip}
                          className={fieldClass(false)}
                        >
                          <option value="">Selecciona...</option>
                          {spec.options.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      ) : (
                        <input
                          id={`spec-${spec.key}`}
                          type={spec.type}
                          placeholder={spec.placeholder}
                          title={spec.tooltip}
                          value={formData.especificaciones[spec.key] ?? ''}
                          onChange={(event) => handleSpecChange(spec.key, event.target.value)}
                          className={fieldClass(false)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-4 border-t border-slate-200 pt-5">
              <h4 className="text-lg font-semibold text-slate-900">Datos Adicionales</h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Imagen (URL)</label>
                  <input
                    type="url"
                    name="imagenUrl"
                    placeholder="https://..."
                    value={formData.imagenUrl}
                    onChange={handleInputChange}
                    onBlur={handleFieldBlur}
                    onFocus={() => setFormErrors(prev => ({ ...prev, imagenUrl: undefined }))}
                    className={fieldClass(Boolean(formErrors.imagenUrl))}
                  />
                  {formErrors.imagenUrl && <p className="mt-1 text-xs text-red-600">{formErrors.imagenUrl}</p>}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Codigo Patrimonial</label>
                  <input type="text" name="codigoPatrimonial" placeholder="PAT-LAP-002" value={formData.codigoPatrimonial} onChange={handleInputChange} className={fieldClass(false)} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Direccion MAC</label>
                  <input
                    type="text"
                    name="direccionMac"
                    placeholder="AA:BB:CC:DD:EE:FF"
                    value={formData.direccionMac}
                    onChange={handleInputChange}
                    onBlur={handleFieldBlur}
                    onFocus={() => setFormErrors(prev => ({ ...prev, direccionMac: undefined }))}
                    className={fieldClass(Boolean(formErrors.direccionMac))}
                  />
                  {formErrors.direccionMac && <p className="mt-1 text-xs text-red-600">{formErrors.direccionMac}</p>}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Orden de Compra</label>
                  <input type="text" name="ordenCompra" placeholder="OC-2026-0045" value={formData.ordenCompra} onChange={handleInputChange} className={fieldClass(false)} />
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Fecha de Adquisición *</label>
                <input
                  type="date"
                  name="fechaAdquisicion"
                  value={formData.fechaAdquisicion}
                  onChange={handleInputChange}
                  onBlur={handleFieldBlur}
                  onFocus={() => setFormErrors(prev => ({ ...prev, fechaAdquisicion: undefined }))}
                  className={fieldClass(Boolean(formErrors.fechaAdquisicion))}
                />
                {formErrors.fechaAdquisicion && <p className="mt-1 text-xs text-red-600">{formErrors.fechaAdquisicion}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Costo (S/) *</label>
                <input
                  type="number"
                  name="costo"
                  placeholder="0.00"
                  step="0.01"
                  value={formData.costo}
                  onChange={handleInputChange}
                  onBlur={handleFieldBlur}
                  onFocus={() => setFormErrors(prev => ({ ...prev, costo: undefined }))}
                  className={fieldClass(Boolean(formErrors.costo))}
                />
                {formErrors.costo && <p className="mt-1 text-xs text-red-600">{formErrors.costo}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Usuario Asignado</label>
                <input
                  type="text"
                  name="usuarioAsignado"
                  placeholder="Usuario o departamento"
                  value={formData.usuarioAsignado}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Ubicación</label>
                <input
                  type="text"
                  name="ubicacion"
                  placeholder="Ubicación física"
                  value={formData.ubicacion}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-200">
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50"
                disabled={loading}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon name={loading ? 'loader' : 'save'} />
                  {loading ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Guardar'}
                </span>
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-slate-300 hover:bg-slate-400 text-slate-800 px-6 py-2.5 rounded-lg font-semibold transition-all duration-200"
              >
                <span className="inline-flex items-center gap-2"><Icon name="close" /> Cancelar</span>
              </button>
            </div>
          </form>
          </section>
        </div>
      )}

      {/* Tabla */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <label htmlFor="filter-type" className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          <Icon name="filter" /> Filtrar por tipo:
        </label>
        <select
          id="filter-type"
          value={filtroTipo}
          onChange={(event) => setFiltroTipo(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {TIPOS_DISPONIBLES.map(({ value, label }) => (
            <option key={value || 'all'} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
              <tr>
                <th className="px-6 py-4 text-left font-semibold">Equipo</th>
                <th className="px-6 py-4 text-left font-semibold">Tipo</th>
                <th className="px-6 py-4 text-left font-semibold">Marca/Modelo</th>
                <th className="px-6 py-4 text-right font-semibold">Costo</th>
                <th className="px-6 py-4 text-left font-semibold">Asignado a</th>
                <th className="px-6 py-4 text-center font-semibold">Estado</th>
                <th className="px-6 py-4 text-center font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {bienesFiltrados && bienesFiltrados.length > 0 ? (
                bienesFiltrados.map(bien => (
                  <tr key={bien.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 font-medium text-slate-900">{bien.nombre}</td>
                    <td className="px-6 py-4 text-slate-600">
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                        {bien.tipo}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-sm">
                      {bien.marca || '-'} {bien.modelo ? `/ ${bien.modelo}` : ''}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900">
                      S/ {Number(bien.costo || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {bien.usuario_asignado || <span className="text-slate-400">Sin asignar</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                        bien.estado === 'activo'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        <span className="inline-flex items-center gap-1">
                          <Icon name={bien.estado === 'activo' ? 'check' : 'inactive'} />
                          {bien.estado === 'activo' ? 'Activo' : 'Inactivo'}
                        </span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-wrap gap-2 justify-center">
                        <button
                          type="button"
                          onClick={() => setSpecsBien(bien)}
                          className="inline-flex items-center gap-1 rounded px-3 py-1 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 hover:text-indigo-800"
                        >
                          <Icon name="eye" /> Ver Especificaciones
                        </button>
                        {canEdit && (['baja', 'dado_de_baja'].includes(String(bien.estado).toLowerCase()) ? (
                          <span className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800" title="Bien dado de baja - Ficha bloqueada">
                            Ficha bloqueada
                          </span>
                        ) : (
                          <button
                            onClick={() => handleEdit(bien)}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1 rounded transition font-semibold text-sm"
                            disabled={loading}
                          >
                            <span className="inline-flex items-center gap-1"><Icon name="edit" /> Actualizar Ficha Técnica</span>
                          </button>
                        ))}
                        <button
                          onClick={() => handleShowHistory(bien)}
                          className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-1 rounded transition font-semibold text-sm"
                          disabled={historyLoading}
                        >
                          <span className="inline-flex items-center gap-1"><Icon name="clock" /> Historial</span>
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(bien.id)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded transition font-semibold text-sm"
                            disabled={loading}
                          >
                            <span className="inline-flex items-center gap-1"><Icon name="trash" /> Eliminar</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-slate-500">
                    <Icon name="inbox" className="mx-auto h-8 w-8 text-slate-400" />
                    <p className="mt-2">{filtroTipo ? 'No hay bienes de este tipo' : 'No hay bienes registrados'}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {specsBien && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onClick={() => setSpecsBien(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="specs-title"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="specs-title" className="text-xl font-bold text-slate-900">Especificaciones Técnicas</h2>
                <p className="mt-1 text-sm text-slate-600">{specsBien.nombre}</p>
              </div>
              <button type="button" onClick={() => setSpecsBien(null)} aria-label="Cerrar especificaciones" className="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                <Icon name="close" />
              </button>
            </div>
            <div className="mb-5 grid grid-cols-1 gap-5 rounded-lg border border-slate-200 p-4 sm:grid-cols-[10rem_1fr]">
              <div className="flex h-36 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                {specsBien.imagen_url ? (
                  <img src={specsBien.imagen_url} alt={`Imagen de ${specsBien.nombre}`} className="h-full w-full object-cover" />
                ) : (
                  <Icon name="camera" className="h-10 w-10 text-slate-400" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{specsBien.nombre}</h3>
                <DetailGrid rows={[
                  ['Marca', specsBien.marca],
                  ['Modelo', specsBien.modelo],
                  ['Serie', specsBien.numero_serie],
                  ['Estado', specsBien.estado],
                  ['Cod. Patrimonial', specsBien.codigo_patrimonial],
                ]} />
              </div>
            </div>
            <div className="space-y-4">
              <DetailSection title="Especificaciones Técnicas" rows={specificationRows(specsBien.especificaciones)} />
              <DetailSection title="Administrativo" rows={[
                ['Ubicación', specsBien.ubicacion, 'pin'],
                ['Asignado', specsBien.usuario_asignado, 'user'],
                ['Costo', specsBien.costo !== null && specsBien.costo !== undefined && specsBien.costo !== '' ? `S/ ${Number(specsBien.costo).toFixed(2)}` : '', 'coin'],
                ['Direccion MAC', specsBien.direccion_mac],
                ['Orden de Compra', specsBien.orden_compra],
              ]} />
            </div>
          </section>
        </div>
      )}

      {historyBien && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onClick={() => setHistoryBien(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-title"
            className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="history-title" className="text-xl font-bold text-slate-900">Historial de ficha técnica</h2>
                <p className="mt-1 text-sm text-slate-600">{historyBien.nombre}</p>
              </div>
              <button type="button" onClick={() => setHistoryBien(null)} aria-label="Cerrar historial" className="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                <Icon name="close" />
              </button>
            </div>
            {historyLoading ? (
              <p className="py-8 text-center text-slate-500">Cargando historial...</p>
            ) : history.length === 0 ? (
              <p className="py-8 text-center text-slate-500">Este bien aún no tiene versiones anteriores.</p>
            ) : (
              <ol className="space-y-4">
                {history.map((version) => {
                  const previous = typeof version.datos_anteriores === 'string'
                    ? JSON.parse(version.datos_anteriores)
                    : version.datos_anteriores;
                  const specifications = typeof previous.especificaciones === 'string'
                    ? JSON.parse(previous.especificaciones)
                    : previous.especificaciones || {};
                  return (
                    <li key={version.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-sm font-semibold text-slate-900">
                        <Icon name="calendar" className="h-4 w-4 text-slate-500" />
                        <span>{new Date(version.created_at).toLocaleString('es-PE')} · {version.modificado_por_nombre || 'Usuario no disponible'}</span>
                      </div>
                      {previous.imagen_url && (
                        <img src={previous.imagen_url} alt={`Imagen histórica de ${previous.nombre || historyBien.nombre}`} className="my-3 h-24 w-36 rounded-md border border-slate-200 object-cover" />
                      )}
                      <div className="mt-4 space-y-4">
                        <DetailSection title="Datos Generales" rows={[
                          ['Nombre', previous.nombre],
                          ['Tipo', previous.tipo],
                          ['Marca / Modelo', [previous.marca, previous.modelo].filter(Boolean).join(' / ')],
                          ['Número de serie', previous.numero_serie],
                          ['Cod. Patrimonial', previous.codigo_patrimonial],
                          ['Descripción', previous.descripcion],
                        ]} />
                        <DetailSection title="Especificaciones Técnicas" rows={specificationRows(specifications)} />
                        <DetailSection title="Administrativo" rows={[
                          ['Fecha de adquisición', previous.fecha_adquisicion],
                          ['Costo', previous.costo !== null && previous.costo !== undefined && previous.costo !== '' ? `S/ ${Number(previous.costo).toFixed(2)}` : ''],
                          ['Asignado a', previous.usuario_asignado, 'user'],
                          ['Ubicación', previous.ubicacion, 'pin'],
                          ['Direccion MAC', previous.direccion_mac],
                          ['Orden de Compra', previous.orden_compra],
                        ]} />
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
