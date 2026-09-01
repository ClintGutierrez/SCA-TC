# Sistema de Gestión de Inventario de Bienes Informáticos
## Tribunal Constitucional del Perú

### 🎯 Descripción del Proyecto

Sistema full-stack para la gestión integral de bienes informáticos, desarrollado como trabajo de investigación para obtener el grado de Bachiller. El sistema integra funcionalidades de inventario, control de depreciación, mantenimiento y generación de reportes para auditoría.

### 📋 Características Principales

- ✅ **Gestión de Inventario**: Registro detallado de bienes informáticos con información técnica
- ✅ **Control de Depreciación**: Cálculo automático de depreciación de activos
- ✅ **Gestión de Mantenimiento**: Registro y seguimiento de mantenimientos y repotenciaciones
- ✅ **Asignación de Equipos**: Control de asignación de bienes a usuarios
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
│   ├── .env.example           # Variables de entorno
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

3. Configura las variables de entorno (copia .env.example a .env):
```bash
cp .env.example .env
```

4. Edita `.env` con tus credenciales de PostgreSQL:
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
- Personal que usa los equipos
- Departamentos y roles

**depreciacion**
- Cálculo de depreciación por bien
- Valores históricos

**asignaciones**
- Asignación de equipos a usuarios
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
