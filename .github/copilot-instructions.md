# Instrucciones del Proyecto - Sistema de Gestión de Inventario de Bienes Informáticos

## Descripción del Proyecto
Sistema full-stack de gestión de inventario de bienes informáticos para el Tribunal Constitucional del Perú, desarrollado con Node.js, React y Tailwind CSS.

## Stack Tecnológico
- **Backend**: Node.js + Express + PostgreSQL
- **Frontend**: React + Tailwind CSS + Vite
- **Base de Datos**: PostgreSQL
- **API**: RESTful

## Módulos Principales
1. Gestión de inventario de bienes informáticos
2. Control y seguimiento de depreciación
3. Asignación de equipos a usuarios
4. Módulo de mantenimiento y repotenciación
5. Generación de reportes para auditoría

## Estructura del Proyecto
```
proyecto TPG/
├── backend/           # Servidor Express + API
├── frontend/          # Aplicación React
├── .github/           # Configuración del repositorio
├── README.md          # Documentación principal
└── .env.example       # Variables de entorno
```

## Instrucciones de Instalación

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Variables de Entorno
Ver `.env.example` para configuración requerida.

## Desarrollo
- Puerto Backend: 5000
- Puerto Frontend: 3000
- Base de Datos: PostgreSQL en localhost:5432
