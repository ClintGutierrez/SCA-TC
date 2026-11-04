# TESTING Y PRUEBAS

## Pruebas Manuales

### 1. Verificar Conectividad

```bash
# Verificar que el backend está corriendo
curl http://localhost:5000/api/health

# Respuesta esperada:
# {"status":"OK","message":"Servidor funcionando correctamente"}
```

### 2. Pruebas en Postman

#### Crear un Bien

**POST** `http://localhost:5000/api/bienes`

Headers:
```
Content-Type: application/json
```

Body:
```json
{
  "nombre": "Laptop HP",
  "descripcion": "Laptop para desarrollo",
  "tipo": "laptop",
  "marca": "HP",
  "modelo": "Pavilion 15",
  "numeroSerie": "SN123456",
  "fechaAdquisicion": "2023-01-15",
  "costo": 3500.00,
  "usuarioAsignado": "Juan Pérez",
  "ubicacion": "Oficina Principal"
}
```

#### Obtener Todos los Bienes

**GET** `http://localhost:5000/api/bienes`

#### Actualizar un Bien

**PUT** `http://localhost:5000/api/bienes/1`

Body: (incluir campos a actualizar)
```json
{
  "estado": "inactivo"
}
```

#### Eliminar un Bien

**DELETE** `http://localhost:5000/api/bienes/1`

### 3. Pruebas de Reportes

#### Reporte de Inventario

**GET** `http://localhost:5000/api/reportes/inventario`

Respuesta esperada:
```json
{
  "total_bienes": 5,
  "activos": 4,
  "inactivos": 1,
  "en_reparacion": 0,
  "valor_total": "12500.00"
}
```

#### Reporte de Depreciación

**GET** `http://localhost:5000/api/reportes/depreciacion`

### 4. Pruebas en el Frontend

1. **Dashboard**
   - [ ] Las tarjetas muestran números correctos
   - [ ] Los totales corresponden con la base de datos

2. **Inventario**
   - [ ] Listar todos los bienes
   - [ ] Crear nuevo bien
   - [ ] Editar bien existente
   - [ ] Eliminar bien
   - [ ] Filtros funcionen (si están implementados)

3. **Reportes**
   - [ ] Mostrar reporte de inventario
   - [ ] Mostrar reporte de depreciación
   - [ ] Exportar a CSV
   - [ ] Cambiar entre pestañas

## Casos de Prueba

### Crear Bien Válido
- Datos: nombre, tipo, fecha, costo
- Resultado esperado: Bien creado en BD, aparece en listado

### Crear Bien Sin Campos Requeridos
- Datos: Solo nombre
- Resultado esperado: Error "Campo requerido"

### Actualizar Bien No Existente
- ID: 999
- Resultado esperado: Error 404 "Bien no encontrado"

### Calcular Depreciación
- Bien con costo: $1000, comprado hace 2 años
- Porcentaje: 20% anual
- Resultado esperado: Valor actual = $640 (1000 * 0.8^2)

## Pruebas Automáticas (Futuro)

Cuando se configure Jest/Vitest:

```javascript
// backend/__tests__/bienes.test.js
import request from 'supertest';
import app from '../server';

describe('API de Bienes', () => {
  test('GET /api/bienes debe retornar array', async () => {
    const res = await request(app).get('/api/bienes');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/bienes debe crear bien', async () => {
    const res = await request(app)
      .post('/api/bienes')
      .send({
        nombre: 'Test',
        tipo: 'computadora',
        fechaAdquisicion: '2023-01-01',
        costo: 1000
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });
});
```

## Performance Testing

### Cargar 1000 Bienes

```javascript
// Script para agregar datos de prueba
for (let i = 1; i <= 1000; i++) {
  await api.createBien({
    nombre: `Equipo ${i}`,
    tipo: 'computadora',
    fechaAdquisicion: '2023-01-01',
    costo: 2500
  });
}
```

Medir: Tiempo de carga en dashboard y listados

## Checklist de Pruebas

### Backend
- [ ] Health check funciona
- [ ] CRUD de bienes funciona completamente
- [ ] CRUD de mantenimiento funciona
- [ ] Cálculo de depreciación correcto
- [ ] Reportes retornan datos correctos
- [ ] Manejo de errores apropiado
- [ ] Validación de datos

### Frontend
- [ ] Dashboard muestra datos correctamente
- [ ] Formularios validan datos
- [ ] Listados cargan correctamente
- [ ] Botones editar/eliminar funcionan
- [ ] Reportes se exportan a CSV
- [ ] Navegación entre vistas funciona
- [ ] Responsive en mobile (opcional)

### Base de Datos
- [ ] Tablas creadas correctamente
- [ ] Índices funcionan
- [ ] Constraints integridad referencial
- [ ] Migraciones se ejecutan sin errores

### Seguridad
- [ ] CORS configurado correctamente
- [ ] Validación de entrada de datos
- [ ] Manejo seguro de errores
- [ ] Variables sensibles no expuestas

## Reportar Bugs

Al encontrar un bug, incluir:
1. Pasos para reproducir
2. Comportamiento esperado
3. Comportamiento actual
4. Ambiente: Windows/Linux, versión Node, etc.
5. Screenshot/log de error

---

**Última actualización**: Junio 2026
