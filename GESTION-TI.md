 # Gestión Documentaria y Almacén

El formulario `/solicitud` registra solicitudes en PostgreSQL. Jefatura las asigna a personal activo de TI; el responsable inicia la atención, responde con adjuntos o devuelve la solicitud con un motivo. Las solicitudes y los pedidos comparten alertas internas y una cola persistente de correo con reintentos.

## Instalación

Con la conexión privada de `backend/.env` configurada, ejecutar desde `backend`:

```powershell
npm run migrate:gestion-ti
```

Esta migración añade las tablas y la columna `usuarios.es_ti`. La instalación completa con `npm run migrate` también la incluye. Reiniciar el backend después de actualizar el código. No es necesario cambiar el almacenamiento externo de evidencias de bajas.

Los documentos oficiales y los adjuntos de respuestas se almacenan privados en `documentos_ti` como BYTEA. Su registro es atómico con el trámite. Las tablas nuevas tienen RLS habilitado y carecen de políticas públicas; el backend debe conectarse como propietario de las tablas o mediante un rol de servicio con permisos adecuados. Las descargas siempre pasan por los controles de la API. Cada archivo admite hasta 10 MB; una respuesta admite hasta tres archivos. Se verifica el tipo declarado y la firma PDF, JPEG, PNG o WEBP.

## Operación

1. El solicitante completa el formulario con identificación y documento oficial. Recibe un número único y una clave privada de consulta válida por siete días. La constancia también queda en la cola de correo.
2. En **Solicitudes TI**, Jefatura asigna una cuenta activa de TI y puede incluir indicaciones. Los técnicos ven únicamente sus solicitudes asignadas; Jefatura y auditoría pueden consultar todas.
3. El responsable inicia la atención y registra acciones realizadas, comentario y adjuntos. Para devolver, observar o rechazar se exige motivo. La respuesta se consulta en **Seguimiento de solicitud** del formulario.
4. El solicitante puede solicitar una nueva clave al correo registrado. Esa clave vence a los 30 minutos; el número de registro por sí solo no da acceso a los documentos. La respuesta de recuperación no revela si una solicitud existe.
5. Si hay compra, Jefatura registra un pedido desde el detalle de la solicitud o en **Pedidos y Almacén**. Puede aprobarlo. También se admiten pedidos sin solicitud vinculada.
6. Una cuenta con rol **Almacén** registra la llegada de un pedido solicitado o aprobado. Jefatura recibe una alerta y puede derivar la recepción. Cualquier cuenta marcada como personal de TI puede recepcionar, aunque no sea la persona de la derivación.
7. La recepción exige fecha y conformidad. Si no es conforme, exige observaciones. Se rechazan fechas futuras o anteriores a la llegada. La recepción es única y los registros se bloquean dentro de una transacción para resolver intentos simultáneos.
8. Después de recepcionar, Jefatura registra los bienes en Inventario, los vincula al pedido desde su detalle y continúa la entrega en Movimientos. Un bien no se vincula a dos pedidos y no se permite superar la cantidad solicitada. La recepción no crea asignaciones patrimoniales automáticamente.

En **Usuarios**, el administrador puede crear cuentas con rol Almacén. Jefatura y técnicos pertenecen a TI; para otros roles existe la casilla **Pertenece al personal de TI**. Los permisos del módulo se comprueban con el estado actual de la cuenta en cada petición, incluso si el JWT todavía no venció.

Los estados de solicitudes son `recibida`, `asignada`, `en_atencion`, `atendida`, `cerrada`, `observada` y `rechazada`. Los pedidos usan `solicitado`, `aprobado`, `en_almacen` y `recepcionado`. Cada acción conserva usuario, fecha, motivo y transición en el historial. No se ofrece borrado de trámites.

Los registros anteriores de `localStorage` permanecen en el navegador y no se importan automáticamente: algunos podían contener solo el nombre del adjunto. Las nuevas bandejas muestran exclusivamente registros persistidos en el servidor.

## Correo y alertas

Configurar únicamente en el entorno privado del backend:

```dotenv
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
```

El proceso revisa la cola cada 15 segundos. Las credenciales son opcionales si el servidor SMTP permite el envío sin autenticación. Si no hay SMTP o falla, el trámite queda guardado, la alerta interna sigue visible y el correo se reintenta con espera creciente de hasta una hora. La pantalla de notificaciones muestra si el correo fue enviado o está pendiente. Como en otros sistemas SMTP con reintentos, un fallo de conexión tras la aceptación remota puede producir una entrega repetida; la clave única del evento evita duplicar los registros de alerta en la base de datos.

Jefatura recibe las alertas de solicitudes nuevas y llegada de pedidos. Si no hay cuentas activas de Jefatura se usan las cuentas administradoras activas. Las asignaciones alertan a su responsable y las respuestas, observaciones y rechazos notifican al solicitante. Las bandejas se actualizan cada 30 segundos y permiten actualizar manualmente.

## Verificación

Desde `backend`:

```powershell
npm test
$env:TEST_TI_DATABASE='1'
node --test tests/gestionTI.integration.test.js
Remove-Item Env:TEST_TI_DATABASE
```

La integración crea un esquema aislado con prefijo aleatorio `sca_ti_test_`, prueba la API sobre HTTP local y lo elimina en `finally`. No usa ni elimina registros de negocio. Requiere acceso PostgreSQL con permiso para crear esquemas. Verifica validaciones, privacidad de adjuntos, duplicados confirmables, asignación, devolución, respuesta, rechazo, cuentas deshabilitadas, llegada y recepción concurrentes, vinculación de bienes y alertas propias.

Desde `frontend`, ejecutar `npm run build`. Los endpoints están documentados en `/api-docs`, bajo Gestión TI.
