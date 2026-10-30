import test from 'node:test';
import assert from 'node:assert/strict';
import { nuevaSolicitudTI, validarPasoSolicitudTI, errorArchivoTI, normalizarClaveTI, normalizarCodigoTI, validarConsultaTI, MAX_ARCHIVO_TI } from '../src/utils/solicitudTIForm.js';
import { crearConstanciaTI } from '../src/utils/constanciaTI.js';

const archivo = { name: 'Memorando.pdf', size: 1200, type: 'application/pdf' };
const completo = () => ({ ...nuevaSolicitudTI(), solicitanteNombre: 'Persona de prueba', solicitanteDni: '00000011', solicitanteCorreo: 'prueba@example.com', solicitanteArea: 'TI', solicitanteCargo: 'Analista', mismoSolicitante: true, oficina: 'Oficina 202', equipoDetalle: 'Laptop para incorporación', justificacion: 'Labores administrativas', numeroDocumento: 'MEM-PRUEBA-2026' });

test('cada paso identifica los campos faltantes y el caso completo permite llegar a revisión', () => {
  assert.ok(validarPasoSolicitudTI(nuevaSolicitudTI(), null, 1).solicitanteNombre);
  assert.ok(validarPasoSolicitudTI(nuevaSolicitudTI(), null, 2).documento);
  for (const step of [0, 1, 2]) assert.deepEqual(validarPasoSolicitudTI(completo(), archivo, step), {});
  assert.ok(validarPasoSolicitudTI({ ...completo(), tipoSolicitud: 'inexistente' }, archivo, 0).tipoSolicitud);
});

test('los datos del beneficiario solo se exigen cuando es otra persona', () => {
  const form = { ...completo(), mismoSolicitante: false };
  const errors = validarPasoSolicitudTI(form, archivo, 1);
  assert.ok(errors.beneficiarioNombre); assert.ok(errors.beneficiarioDni); assert.ok(errors.beneficiarioCargo);
  assert.deepEqual(validarPasoSolicitudTI({ ...form, beneficiarioNombre: 'Beneficiaria de prueba', beneficiarioDni: '00000012', beneficiarioCargo: 'Asistente' }, archivo, 1), {});
});

test('traslados y reemplazos exigen identificar el equipo y el traslado exige origen', () => {
  const traslado = { ...completo(), tipoSolicitud: 'cambio_ubicacion' };
  const errors = validarPasoSolicitudTI(traslado, archivo, 2);
  assert.ok(errors.codigoActual); assert.ok(errors.oficinaOrigen);
  assert.deepEqual(validarPasoSolicitudTI({ ...traslado, codigoActual: 'EQ-PRUEBA', oficinaOrigen: 'Oficina 101' }, archivo, 2), {});
  assert.ok(validarPasoSolicitudTI({ ...completo(), tipoSolicitud: 'cambio_equipo' }, archivo, 2).codigoActual);
  assert.equal(validarPasoSolicitudTI(completo(), archivo, 2).codigoActual, undefined);
});

test('no se admite una laptop en la solicitud de impresora o escáner ni textos demasiado largos', () => {
  assert.ok(validarPasoSolicitudTI({ ...completo(), tipoSolicitud: 'impresora_escaner' }, archivo, 2).equipoCategoria);
  assert.equal(validarPasoSolicitudTI({ ...completo(), tipoSolicitud: 'impresora_escaner', equipoCategoria: 'escaner' }, archivo, 2).equipoCategoria, undefined);
  assert.ok(validarPasoSolicitudTI({ ...completo(), justificacion: 'x'.repeat(5001) }, archivo, 2).justificacion);
});

test('el adjunto es obligatorio y respeta formato, contenido y límite de 10 MB', () => {
  assert.ok(errorArchivoTI(null));
  assert.ok(errorArchivoTI({ ...archivo, size: 0 }));
  assert.ok(errorArchivoTI({ ...archivo, type: 'text/plain' }));
  assert.ok(errorArchivoTI({ ...archivo, size: MAX_ARCHIVO_TI + 1 }));
  assert.equal(errorArchivoTI({ ...archivo, size: MAX_ARCHIVO_TI }), '');
});

test('la consulta admite código pegado con guiones tipográficos y clave hexadecimal con espacios de salto de línea', () => {
  const clave = 'ab'.repeat(24);
  assert.equal(normalizarCodigoTI(' sol–2026–000001 '), 'SOL-2026-000001');
  assert.equal(normalizarClaveTI(` ${clave.toUpperCase().slice(0, 24)}\n${clave.toUpperCase().slice(24)} `), clave);
  assert.deepEqual(validarConsultaTI({ codigo: 'sol–2026–000001', clave: clave.toUpperCase() }), {});
  assert.ok(validarConsultaTI({ codigo: '000001', clave: clave.slice(1) }).codigo);
  assert.ok(validarConsultaTI({ codigo: 'SOL-2026-000001', clave: clave.slice(1) }).clave);
});

test('recuperar la clave exige el correo, sin exigir la clave perdida', () => {
  assert.deepEqual(validarConsultaTI({ codigo: 'SOL-2026-000001', correo: 'prueba@example.com' }, true), {});
  assert.ok(validarConsultaTI({ codigo: 'SOL-2026-000001', correo: '' }, true).correo);
});

test('la constancia PDF contiene el número y la clave y pagina requerimientos extensos', async () => {
  const clave = 'cd'.repeat(24);
  const pdf = await crearConstanciaTI({ codigo: 'SOL-2026-000001', clave, created_at: '2026-10-29T15:00:00Z', datos: { ...completo(), justificacion: 'Detalle de prueba para verificar el salto de página. '.repeat(90) }, archivo: { nombre: archivo.name } });
  const content = pdf.output();
  assert.match(content, /^%PDF-/);
  assert.ok(content.includes('SOL-2026-000001'));
  assert.ok(content.includes(clave));
  assert.ok(pdf.getNumberOfPages() > 1);
});
