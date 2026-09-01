# GUÍA DE INSTALACIÓN Y CONFIGURACIÓN

## Requisitos Previos

- **Node.js** v16 o superior (descargar de https://nodejs.org/)
- **PostgreSQL** v12 o superior (descargar de https://www.postgresql.org/download/)
- **npm** (viene con Node.js)

## Instalación Paso a Paso

### 1. Configurar Base de Datos PostgreSQL

Abre una terminal de PostgreSQL o pgAdmin y ejecuta:

```sql
CREATE DATABASE inventario_bienes;
```

### 2. Clonar/Descargar el Proyecto

```bash
cd "ruta/del/proyecto"
```

### 3. Configurar Variables de Entorno

Copia el archivo `.env.example` a `.env`:

```bash
cp .env.example .env
```

Edita el archivo `.env` con tus configuraciones (generalmente solo necesitas cambiar la contraseña de PostgreSQL si es diferente).

Agrega también un `JWT_SECRET` largo y aleatorio, y configura `FRONTEND_URL` si el frontend no corre en `http://localhost:5173`.

### 4. Instalar Dependencias

Opción A - Script automático:
```bash
npm run setup
```

Opción B - Manual:
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
cd ..
```

### 5. Ejecutar Migraciones de Base de Datos

```bash
npm run backend:migrate
```

## Ejecutar el Proyecto

### En Windows (PowerShell - Recomendado)

**Abrir 2 terminales separadas:**

**Terminal 1 - Backend:**
```bash
npm run backend:dev
# Debe mostrar: ✓ Conectado a PostgreSQL y 🚀 Servidor ejecutándose en http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
npm run frontend:dev
# Debe mostrar: VITE v5.0.0 ready in xxx ms
# La aplicación se abrirá en http://localhost:3000
```

### En Windows (CMD)

Igual que PowerShell pero usando `cmd.exe`

### En Linux/Mac

```bash
# Terminal 1
npm run backend:dev

# Terminal 2
npm run frontend:dev
```

## Verificar que todo funciona

1. Abre http://localhost:3000 en tu navegador
2. Deberías ver el Dashboard con 0 bienes
3. Intenta agregar un bien desde "Inventario"
4. Verifica que aparezca en el listado

## Solución de Problemas

### "Error: Database does not exist"
- Asegúrate de haber creado la base de datos en PostgreSQL
- Verifica que DB_NAME en .env coincida con el nombre de la base de datos

### "Error: connect ECONNREFUSED"
- PostgreSQL no está corriendo
- En Windows: Abre "Servicios" (services.msc) y reinicia "postgresql-x64-15" (o similar)
- En Linux: `sudo service postgresql start`

### "Error: listen EADDRINUSE"
- El puerto 5000 o 3000 ya está en uso
- Cambia el puerto en el archivo .env o cierra la aplicación que lo usa

### "npm: command not found"
- Node.js no está instalado correctamente
- Descarga e instala desde https://nodejs.org/
- Reinicia la terminal después de instalar

## Estructura de Carpetas Importante

```
proyecto TPG/
├── backend/          ← Servidor Node.js
├── frontend/         ← Aplicación React
├── .env              ← Variables de entorno (crear desde .env.example)
└── package.json      ← Scripts del proyecto
```

## Scripts Útiles

```bash
# Desarrollo
npm run backend:dev      # Ejecutar backend en modo desarrollo
npm run frontend:dev     # Ejecutar frontend en modo desarrollo

# Producción
npm run backend:start    # Ejecutar backend en producción
npm run frontend:build   # Construir frontend para producción

# Instalación
npm run setup            # Instalar todas las dependencias
npm run backend:migrate  # Ejecutar migraciones de BD

# Instalación individual
npm run backend:install  # Instalar solo backend
npm run frontend:install # Instalar solo frontend
```

## Variables de Entorno Disponibles

En el archivo `.env`:

- `BACKEND_PORT`: Puerto del servidor (default: 5000)
- `NODE_ENV`: Ambiente (development/production)
- `DB_HOST`: Host de PostgreSQL (default: localhost)
- `DB_PORT`: Puerto de PostgreSQL (default: 5432)
- `DB_NAME`: Nombre de la base de datos (default: inventario_bienes)
- `DB_USER`: Usuario de PostgreSQL (default: postgres)
- `DB_PASSWORD`: Contraseña de PostgreSQL
- `VITE_API_URL`: URL del API desde el frontend

## Acceso a la Aplicación

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/api/health

## Datos de Prueba

Puedes agregar bienes manualmente desde la interfaz:
1. Click en "Inventario"
2. Click en "+ Agregar Bien"
3. Completa el formulario
4. Click en "Guardar"

## Soporte y Contacto

Para reportar problemas o dudas, contactar al desarrollador del proyecto.

---

**Última actualización**: Junio 2026
