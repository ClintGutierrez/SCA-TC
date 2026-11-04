# GUÍA DE DESARROLLO

## Estructura del Código

### Backend

#### Controladores (`/backend/controllers/`)
- Contienen la lógica de negocio
- Cada controlador maneja una entidad específica
- Ejemplo: `bienesController.js` maneja las operaciones CRUD de bienes

#### Rutas (`/backend/routes/`)
- Definen los endpoints de la API
- Usan los controladores para procesar las solicitudes
- Ejemplo: `bienes.js` define GET, POST, PUT, DELETE para bienes

#### Migraciones (`/backend/migrations/`)
- `schema.sql`: Define la estructura de la base de datos
- `run.js`: Script que ejecuta las migraciones

### Frontend

#### Componentes (`/frontend/src/components/`)
- `Dashboard.jsx`: Vista principal con estadísticas
- `InventarioList.jsx`: Listado y gestión de bienes
- `Reportes.jsx`: Generación y visualización de reportes
- `NavBar.jsx`: Navegación principal
- `Mantenimiento.jsx`: Gestión de mantenimientos (opcional)

#### Servicios (`/frontend/src/services/`)
- `api.js`: Cliente API que hace llamadas al backend

#### Utilidades (`/frontend/src/utils/`)
- `helpers.js`: Funciones auxiliares

## Convenciones de Código

### Nombres de Variables
- camelCase para variables y funciones
- UPPER_SNAKE_CASE para constantes
- PascalCase para componentes React

### Estructura de Componentes
```javascript
import { useState, useEffect } from 'react';
import * as api from '../services/api';

export default function MiComponente({ prop1, prop2 }) {
  const [state, setState] = useState(null);
  
  useEffect(() => {
    // Efectos secundarios
  }, []);
  
  const handleEvent = () => {
    // Lógica
  };
  
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

### Estilos
- Usar Tailwind CSS para todos los estilos
- Clases de utilidad: `flex`, `grid`, `px-4`, `py-2`, etc.
- Colores: azul para primario, verde para éxito, rojo para error

## Flujo de Desarrollo

### Agregar una Nueva Funcionalidad

1. **Backend**
   - Crear controlador en `/backend/controllers/`
   - Crear rutas en `/backend/routes/`
   - Registrar rutas en `server.js`
   - Migrar BD si es necesario

2. **Frontend**
   - Crear componente en `/frontend/src/components/`
   - Agregar métodos API en `/frontend/src/services/api.js`
   - Integrar en `App.jsx` o NavBar

3. **Testing**
   - Probar endpoints con Postman o similar
   - Probar interfaz en el navegador

### Ejemplos de Uso

**Obtener datos del API:**
```javascript
const [data, setData] = useState([]);

useEffect(() => {
  api.getBienes().then(res => setData(res.data));
}, []);
```

**Crear registro:**
```javascript
const handleCreate = async (formData) => {
  try {
    await api.createBien(formData);
    alert('Creado exitosamente');
  } catch (error) {
    alert('Error: ' + error.message);
  }
};
```

## Variables de Entorno para Desarrollo

En `.env`:
```
NODE_ENV=development
DB_HOST=localhost
VITE_API_URL=http://localhost:5000
```

## Debugging

### Backend
```javascript
console.log('Mensaje:', variable);
```

### Frontend
- Abrir DevTools (F12)
- Ir a Console para ver errores
- Usar Network para ver solicitudes HTTP

## Dependencias Principales

### Backend
- **express**: Framework web
- **postgres**: Cliente de base de datos
- **cors**: Manejo de CORS
- **dotenv**: Variables de entorno
- **date-fns**: Manejo de fechas

### Frontend
- **react**: Librería UI
- **axios**: Cliente HTTP
- **tailwindcss**: Framework CSS
- **vite**: Bundler

## Comandos Útiles

```bash
# Backend
npm install              # Instalar dependencias
npm run dev              # Ejecutar en desarrollo
npm start                # Ejecutar en producción
npm run migrate          # Ejecutar migraciones

# Frontend
npm install              # Instalar dependencias
npm run dev              # Ejecutar en desarrollo
npm run build            # Construir para producción
npm run preview          # Vista previa de build
```

## Mejoras Futuras Sugeridas

- [ ] Autenticación y autorización
- [ ] Búsqueda avanzada y filtros
- [ ] Notificaciones en tiempo real
- [ ] Gráficos más detallados
- [ ] Exportación a PDF
- [ ] Historial de cambios
- [ ] Alertas automáticas (ej: equipos próximos a depreciar)

## Referencia de API

Ver endpoints disponibles en la sección "Endpoints API" del README.md

---

**Última actualización**: Junio 2026
