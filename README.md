# Sistema de Gestión de Inventario de Bienes Informáticos
## Tribunal Constitucional del Perú

### 🎯 Descripción del Proyecto

Sistema full-stack para la gestión integral de bienes informáticos, desarrollado como trabajo de investigación para obtener el grado de Bachiller. El sistema integra funcionalidades de inventario, control de depreciación, mantenimiento y generación de reportes para auditoría.

### 📋 Características Principales

- ✅ **Gestión de Inventario**: Registro detallado de bienes informáticos con información técnica
- ✅ **Control de Depreciación**: Cálculo automático de depreciación de activos
- ✅ **Gestión de Mantenimiento**: Registro y seguimiento de mantenimientos y repotenciaciones
- ✅ **Asignación de Equipos**: Control de asignación de bienes a usuarios
- ✅ **Gestión de Personal**: Directorio institucional independiente de las cuentas de acceso
- ✅ **Reportes para Auditoría**: Generación de reportes confiables para control y supervisión
- ✅ **Exportación de Datos**: Exportación a CSV para análisis externo
- ✅ **Dashboard**: Estadísticas en tiempo real

## 🛠 Stack Tecnológico

- **Backend**: Node.js + Express + PostgreSQL
- **Frontend**: React 18 + Tailwind CSS + Vite
- **API**: RESTful
- **Herramientas**: Axios, date-fns, PostCSS

## 🏗️ Estructura del Proyecto

```
proyecto TPG/
├── backend/                    # API REST con Node.js + Express
│   ├── server.js              # Servidor principal
│   ├── package.json           # Dependencias backend
│   ├── .env                   # Conexión privada a Supabase (no versionada)
│   └── migrations/
│       └── schema.sql         # Esquema de base de datos
├── frontend/                   # Aplicación React + Tailwind
│   ├── src/
│   │   ├── main.jsx           # Punto de entrada
│   │   ├── App.jsx            # Componente principal
│   │   ├── index.css          # Estilos globales
│   │   └── components/
│   │       ├── NavBar.jsx      # Navegación
│   │       ├── Dashboard.jsx   # Panel principal
│   │       ├── InventarioList.jsx  # Gestión de inventario
│   │       └── Reportes.jsx    # Reportes
│   ├── package.json           # Dependencias frontend
│   ├── vite.config.js         # Configuración Vite
│   ├── tailwind.config.js     # Configuración Tailwind
│   └── index.html             # HTML principal
├── .github/
│   └── copilot-instructions.md # Instrucciones del proyecto
└── README.md                   # Este archivo
```

## 🔧 Stack Tecnológico

### Backend
- **Node.js** - Runtime de JavaScript
- **Express.js** - Framework web
- **PostgreSQL** - Base de datos relacional
- **Postgres (npm)** - Cliente PostgreSQL

### Frontend
- **React 18** - Librería UI
- **Vite** - Herramienta de construcción
- **Tailwind CSS** - Framework CSS
- **Axios** - Cliente HTTP

## 📦 Instalación

### Requisitos Previos
- Node.js (v16 o superior)
- npm o yarn
- PostgreSQL (v12 o superior)

### Backend

1. Navega al directorio backend:
```bash
cd backend
```

2. Instala las dependencias:
```bash
npm install
```

3. Configura el archivo privado `backend/.env` con la conexión real a Supabase:
```bash
cd backend
```

4. Edita `backend/.env` con tus credenciales de Supabase:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=inventario_bienes
DB_USER=postgres
DB_PASSWORD=tu_contraseña
PORT=5000
```

5. Crea la base de datos y ejecuta las migraciones:
```bash
# Crear base de datos en PostgreSQL
createdb inventario_bienes

# Ejecutar schema
psql -U postgres -d inventario_bienes -f migrations/schema.sql
```

6. Inicia el servidor:
```bash
npm run dev
```

El servidor estará disponible en `http://localhost:5000`

### Frontend

1. En otra terminal, navega al directorio frontend:
```bash
cd frontend
```

2. Instala las dependencias:
```bash
npm install
```

3. Inicia el servidor de desarrollo:
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## 🚀 Uso

### Acceder a la Aplicación
- Abre tu navegador y ve a `http://localhost:3000`
- Verás el Dashboard con estadísticas principales

### Funcionalidades

#### Dashboard
- Visualización de estadísticas generales
- Total de bienes, activos e inactivos
- Valor total del inventario

#### Inventario
- Listar todos los bienes informáticos
- Agregar nuevos bienes
- Ver detalles de cada bien

#### Reportes
- Reporte de depreciación de activos
- Cálculo automático basado en antigüedad
- Exportación de datos para auditoría

## 📊 Módulos Implementados

### 1. Gestión de Inventario
- Registro de bienes informáticos
- Información técnica detallada
- Estados de los equipos
- Asignación a usuarios

### 2. Control de Depreciación
- Cálculo automático con método lineal (20% anual)
- Histórico de depreciación
- Reporte de valor actual de activos

### 3. Mantenimiento y Repotenciación
- Registro de intervenciones técnicas
- Seguimiento de costos
- Historial completo por equipo

### 4. Reportes y Auditoría
- Reportes de depreciación
- Auditoría de cambios
- Exportación de datos

## 🗄️ Esquema de Base de Datos

### Tablas Principales

**bienes_informaticos**
- Información de los equipos
- Datos técnicos y administrativos
- Estado y ubicación

**mantenimiento**
- Registro de intervenciones
- Costos y responsables
- Tipos de mantenimiento

**usuarios**
- Cuentas que pueden iniciar sesión en el sistema
- Roles, credenciales y permisos

**personal**
- Nombre, apellido y DNI
- Correo institucional y número celular
- Régimen laboral
- Oficina, área, sede y piso
- Estado activo o inactivo

**depreciacion**
- Cálculo de depreciación por bien
- Valores históricos

**asignaciones**
- Historial de asignaciones y devoluciones
- Relación opcional con el personal institucional
- Fechas de asignación y devolución

## 🔌 API Endpoints

### Bienes
- `GET /api/bienes` - Obtener todos los bienes
- `POST /api/bienes` - Crear nuevo bien
- `GET /api/bienes/:id` - Obtener un bien específico

### Mantenimiento
- `GET /api/mantenimiento` - Obtener registros de mantenimiento
- `POST /api/mantenimiento` - Crear registro de mantenimiento

### Reportes
- `GET /api/reportes/depreciacion` - Obtener reporte de depreciación

## 📝 Autor

**Clint Weslly Gutierrez Cruz**

Trabajo de investigación para obtener el grado de Bachiller en Informática

## 📄 Licencia

MIT

## 🤝 Contribuir

Este proyecto está en desarrollo. Para contribuir:

1. Crea una rama para tu feature
2. Realiza tus cambios
3. Envía un pull request

## 📞 Soporte

Para problemas o sugerencias, abre un issue en el repositorio.

---

**Última actualización:** Junio 2024

## Movimientos patrimoniales

El módulo de Movimientos centraliza asignaciones, cambios de responsable, retiros y préstamos. CAP, CAS, Personal de confianza y Servir se procesan directamente; para Locador de servicios y Practicante se exige jefe inmediato y correo registrados en Personal, y la solicitud queda pendiente hasta que dicho jefe la autorice. Cada registro genera un documento HTML imprimible desde el historial.

Para el envío automático por correo, configura SMTP únicamente en el entorno privado del backend:

```text
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
```

Si SMTP no está configurado, el movimiento seguirá registrado y el documento podrá imprimirse; la interfaz indicará que no se pudo enviar.

## Inicialización explícita de cuentas

El arranque del backend conserva las contraseñas, los roles y el estado de las cuentas existentes.
`SEED_DEFAULT_USERS` ya no activa la creación de cuentas. Para inicializar cuentas de desarrollo o pruebas,
prepare fuera del repositorio un archivo JSON privado con una lista de objetos que incluyan `nombre`,
`email`, `rol` y `password`. `departamento` y `es_ti` son opcionales. Las contraseñas deben tener al menos
8 caracteres y no superar 72 bytes UTF-8. No agregue ese archivo al control de versiones.

Desde `backend`, ejecute en PowerShell:

```powershell
$env:NODE_ENV = 'development'
npm run seed:users -- --file C:\privado\cuentas.json
```

El comando admite únicamente `development` y `test`. Las cuentas existentes, incluso las inactivas,
se omiten sin cambiar sus datos. Para producción, gestione las cuentas mediante el flujo administrativo
autorizado; este comando rechaza ese entorno.

## Integridad de costos y estado patrimonial

El registro de un bien exige su valor (0 si no tuvo costo). El registro y la edición de la ficha técnica
validan costos finitos mayores o iguales a cero, y la edición conserva el estado patrimonial. Las transiciones deben realizarse mediante los módulos correspondientes, con sus controles.

Para bases existentes, desde `backend` aplique únicamente la restricción adicional de costos con:

```powershell
npm run migrate:integridad
```

La migración también está incluida en `npm run migrate`. No modifica costos históricos: la restricción
`NOT VALID` impide nuevas inserciones o actualizaciones inválidas y permite revisar los registros anteriores
por separado. Tras conciliar esos registros, se puede validar la restricción completa en PostgreSQL.

La prueba de integración usa un esquema temporal independiente y elimina únicamente ese esquema al terminar:

```powershell
$env:TEST_INTEGRIDAD_DATABASE = '1'
node --test tests/integridad.integration.test.js
```

## Depreciación reproducible H05

Se mantiene la fórmula de saldo decreciente que ya utilizaba el sistema:
`valor_inicial × (1 − porcentaje_anual / 100)^(año_cálculo − año_base)`, redondeada a dos decimales.
El cálculo usa años calendario en `America/Lima`. El año base corresponde al alta de la depreciación,
no a la fecha de compra del bien. El método contable y sus tasas deben acordarse por separado con el
responsable funcional antes de usarlos como valoración contable oficial.

`ano_base` permanece fijo; `ano_actual` registra únicamente el último año calculado. Cada actualización
parte del valor inicial, por lo que repetirla o calcular cada año produce el mismo resultado que calcular
directamente el año final. Se aceptan importes entre cero y 9.999.999.999,99 y tasas entre 0 y 100 %, con
hasta dos decimales. Omitir la tasa usa 20 %; indicar 0 % conserva expresamente esa tasa.

Antes de usar el backend actualizado sobre una base existente, desde `backend` ejecute:

```powershell
npm run migrate:depreciacion
```

Esta migración también está incluida en `npm run migrate`. Recupera el año base desde `created_at`,
protege ese año frente a cambios e impide nuevos valores inválidos. No recalcula importes históricos
ni elimina registros duplicados. Si falta la fecha de creación, hay una cronología futura o inconsistente,
o existen varias depreciaciones para un bien, se rechaza la actualización con HTTP 409 para su conciliación.
Los registros importados deben revisarse si su fecha de creación no representa el inicio original.
Después de revisar los importes afectados por el cálculo anterior, su recálculo se realiza mediante
`PUT /api/depreciacion/:bienId`. El reporte admite bienes con valor inicial cero sin dividir entre cero.

Las pruebas unitarias y la integración optativa se ejecutan con:

```powershell
npm run test:depreciacion
$env:TEST_DEPRECIACION_DATABASE = '1'
node --test tests/depreciacion.integration.test.js
Remove-Item Env:TEST_DEPRECIACION_DATABASE
```

La integración crea y elimina únicamente un esquema temporal independiente; comprueba la migración,
actualizaciones concurrentes, altas repetidas, restricciones SQL y el reporte con costo cero.
