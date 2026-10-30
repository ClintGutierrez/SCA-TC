# CUS12 — Registrar / Actualizar Vínculo Laboral de Personal

Implementación y precisiones técnicas de la especificación «ECUS-CUS12_Registrar Actualizar Vínculo Laboral de Personal», versión 1.0. El documento original se conserva sin modificaciones. Estas reglas resuelven las diferencias encontradas entre su flujo, el prototipo y los módulos existentes.

## Uso

1. Iniciar sesión y abrir **Personal**.
2. Buscar al trabajador por DNI o nombre. Debe estar registrado previamente; no necesita una cuenta de acceso al sistema.
3. Pulsar **Vínculo laboral** en su fila.
4. Elegir **Registrar vínculo** o **Actualizar** en un período existente.
5. Completar tipo, inicio, término cuando corresponda, estado y observaciones opcionales. Las actualizaciones requieren un motivo.
6. Guardar. El sistema valida, persiste el período, conserva los valores anteriores y nuevos en el historial y registra la operación en Auditoría, todo en una transacción.
7. Consultar el estado efectivo y el historial en la misma pantalla. Los cambios se usan en futuras asignaciones y movimientos.

El campo **Cargo** se administra al registrar o editar Personal y se muestra como información del trabajador en el formulario del vínculo.

## Permisos

- **Administrador, Jefatura, Técnico:** registrar, consultar y actualizar vínculos. Jefatura y Técnico corresponden a los actores TI existentes.
- **Almacén:** registrar, consultar y actualizar vínculos; corresponde al actor Logística en el catálogo actual de roles. No se crea una segunda categoría de acceso con el mismo propósito.
- **Auditor:** consultar períodos e historial; no puede modificar.
- El CRUD general de Personal sigue reservado a Administrador/Jefatura. La pertenencia al sistema y el estado de la cuenta se verifican también en el servidor para las operaciones de Personal.

## Reglas de fechas y estados

- Se conserva el catálogo existente: CAS, CAP, Practicante, Locador de servicios, Personal de confianza y Servir. CAS/CAP son los regímenes que requieren obligatoriamente un vínculo documentado para asignar equipos (RF-18).
- Las fechas de inicio y término son inclusivas. El término no puede ser anterior al inicio. Se validan fechas reales de calendario.
- Se permite término vacío para un período sin fin definido; es una decisión del registro, no una afirmación sobre la duración legal de un régimen.
- El estado del registro es **Habilitado** o **Finalizado**. En la API se envía `estado: "vigente"` para habilitar y `estado: "finalizado"` para cerrar; el booleano histórico `vigente` representa esa habilitación manual.
- La **vigencia efectiva**, calculada al consultar según la fecha de Lima, distingue **Programado**, **Vigente**, **Vencido** y **Finalizado**. No se necesita un proceso nocturno para detectar vencimientos.
- Para finalizar manualmente se exige una fecha de término que no sea futura. Para un cese futuro, se deja habilitado con la fecha de término correspondiente y el vencimiento se calcula automáticamente.
- No pueden superponerse dos períodos habilitados del mismo trabajador, incluso si sus regímenes difieren. Antes de registrar una renovación se ajusta el término del período anterior. Una renovación se registra como un período nuevo; una corrección se realiza con **Actualizar** y motivo.
- Los vínculos no se eliminan desde la aplicación. Finalizar un vínculo no borra asignaciones anteriores ni marca automáticamente al trabajador como inactivo.
- Cada actualización envía la versión que se consultó. Si otro operador modificó el registro, se rechaza con HTTP 409 y se deben recargar los datos.

## Integración con bienes

- Asignaciones, préstamos y reemplazos consultan el vínculo para la fecha del movimiento en el backend. CAS/CAP sin período habilitado que cubra esa fecha reciben HTTP 409.
- Para otros regímenes se conserva el flujo previo mientras no tengan vínculos registrados; desde que se registra el primero, también se valida su período. Las autorizaciones de Practicante/Locador permanecen vigentes.
- Las asignaciones y los movimientos nuevos guardan el identificador del vínculo utilizado. Cambiar un período no puede cambiar el régimen o excluir la fecha de una asignación que ya lo utilizó.
- Al aprobar un movimiento pendiente se vuelve a verificar el estado del trabajador y del vínculo, incluida su vigencia actual. Se comprueba también que el bien siga disponible.
- Las devoluciones, retiros y retornos siguen siendo posibles cuando el trabajador está inactivo o el vínculo finalizó. El vencimiento no registra una devolución ficticia ni libera el equipo automáticamente.
- El régimen vigente de Personal se obtiene del período actual. Un período futuro no reemplaza anticipadamente el régimen mostrado. El campo del régimen queda bloqueado al editar los datos generales para evitar cambios sin fechas ni historial.

## Base de datos y puesta en marcha

Desde `backend`, ejecutar:

```powershell
npm run migrate:cus12
```

La migración también está incluida en `npm run migrate` para instalaciones completas. Reiniciar el backend después de actualizar el código.

La migración es aditiva: agrega `personal_id`, metadatos, versión e historial a `vinculo_laboral`, y referencias al vínculo en asignaciones y movimientos. Conserva `usuario_id` para los registros antiguos. Estos registros no se asocian automáticamente a Personal ni habilitan asignaciones: una cuenta del sistema no identifica de forma suficiente al trabajador. El comando informa cuántos están pendientes de revisión. Los trabajadores existentes deben tener sus fechas contractuales reales registradas antes de nuevas asignaciones CAS/CAP.

La consulta de Auditoría incluye las acciones de operadores que después fueron deshabilitados. El filtro de módulos incluye `personal` y `vinculo_laboral`.

## API

- `GET /api/personal/:id/vinculos`: datos del trabajador, períodos, historial y fecha de consulta.
- `POST /api/personal/:id/vinculos`: registrar período.
- `PUT /api/personal/:id/vinculos/:vinculoId`: actualizar con `version` y `motivo_cambio`.
- Campos de entrada: `tipo_vinculo`, `fecha_inicio`, `fecha_fin` opcional, `estado`, `observaciones` opcional; `version` y `motivo_cambio` obligatorios para actualizar.
- La respuesta distingue `estado` administrativo y `estado_vigencia` efectivo. Swagger documenta estas rutas en `/api-docs`.

## Verificación

```powershell
# Desde backend: pruebas unitarias
npm test
# Prueba HTTP y PostgreSQL: crea y elimina únicamente un esquema temporal propio
$env:TEST_CUS12_DATABASE='1'
node --test tests/vinculoLaboral.integration.test.js
# Desde frontend
npm test
npm run build
```

La prueba de integración verifica conservación de vínculos antiguos, migración repetible, permisos de TI/Logística/Auditor, fechas inválidas, superposición y concurrencia, historial, auditoría, cambios de régimen, vigencia al asignar/aprobar y devoluciones tras el cese. Los datos de prueba no se insertan en las tablas reales.

## Ajustes propuestos a la especificación

Incorporar estas reglas de vigencia, permisos, renovación, concurrencia y excepciones al ECUS. Agregar RNF-02 al listado de requerimientos, ya que el flujo lo referencia. Hacer explícita la validación definitiva después de **Guardar**. Incluir Cargo y Observaciones en la descripción del prototipo. Unificar la nomenclatura CUS/CU de los casos relacionados y corregir el ejemplo que muestra como vigente un período cuya fecha de término ya pasó para la fecha consultada.
