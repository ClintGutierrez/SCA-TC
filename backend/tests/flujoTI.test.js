import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSolicitud, validateFile, solicitudTransition, pedidoTransition } from '../utils/flujoTI.js';

const jefe = { id:1,rol:'jefatura',es_ti:true };
const tecnico = { id:2,rol:'tecnico',es_ti:true };
const almacen = { id:3,rol:'almacen',es_ti:false };
const payload = { tipoSolicitud:'nuevo_usuario',equipoCategoria:'laptop',mismoSolicitante:true,solicitanteNombre:'Persona',solicitanteCorreo:'persona@tc.gob.pe',solicitanteDni:'12345678',solicitanteArea:'TI',solicitanteCargo:'Analista',sede:'Sede Central',oficina:'TI',tipoDocumento:'Memorando',numeroDocumento:'001',justificacion:'Incorporación' };

test('valida identificación, beneficiario y campos específicos por tipo', () => {
  const data=validateSolicitud(payload); assert.equal(data.beneficiarioDni,'12345678');
  assert.throws(() => validateSolicitud({ ...payload,solicitanteDni:'123' }),{ status:400 });
  assert.throws(() => validateSolicitud({ ...payload,tipoSolicitud:'cambio_equipo' }),{ status:400 });
  assert.throws(() => validateSolicitud({ ...payload,tipoSolicitud:'cambio_ubicacion',codigoActual:'EQ-1' }),{ status:400 });
  assert.throws(() => validateSolicitud({ ...payload,mismoSolicitante:false }),{ status:400 });
});
test('rechaza archivos vacíos, mayores a 10 MB y contenido incompatible con el MIME', () => {
  validateFile({ mimetype:'application/pdf',buffer:Buffer.from('%PDF-1.7\n') });
  assert.throws(() => validateFile(),{ status:400 });
  assert.throws(() => validateFile({ mimetype:'application/pdf',buffer:Buffer.from('<script>') }),{ status:400 });
  assert.throws(() => validateFile({ mimetype:'application/pdf',buffer:Buffer.alloc(10485761) }),{ status:400 });
});
test('solo el responsable puede iniciar, responder y devolver; responder exige atención iniciada', () => {
  assert.equal(solicitudTransition({ estado:'asignada',asignado_a:2 },'iniciar',tecnico),'en_atencion');
  assert.throws(() => solicitudTransition({ estado:'asignada',asignado_a:1 },'iniciar',tecnico),{ status:403 });
  assert.throws(() => solicitudTransition({ estado:'asignada',asignado_a:2 },'responder',tecnico),{ status:409 });
  assert.equal(solicitudTransition({ estado:'en_atencion',asignado_a:2 },'responder',tecnico),'atendida');
  assert.throws(() => solicitudTransition({ estado:'recibida' },'asignar',tecnico),{ status:403 });
  assert.equal(solicitudTransition({ estado:'atendida' },'cerrar',jefe),'cerrada');
  assert.throws(() => solicitudTransition({ estado:'cerrada' },'asignar',jefe),{ status:409 });
});
test('almacén registra llegada; cualquier personal TI recepciona una sola vez con o sin derivación', () => {
  assert.equal(pedidoTransition({ estado:'aprobado' },'llegada',almacen),'en_almacen');
  assert.equal(pedidoTransition({ estado:'en_almacen',asignado_a:1 },'recepcionar',tecnico),'recepcionado');
  assert.equal(pedidoTransition({ estado:'en_almacen',asignado_a:null },'recepcionar',tecnico),'recepcionado');
  assert.throws(() => pedidoTransition({ estado:'en_almacen' },'recepcionar',almacen),{ status:403 });
  assert.throws(() => pedidoTransition({ estado:'recepcionado' },'recepcionar',tecnico),{ status:409 });
  assert.throws(() => pedidoTransition({ estado:'en_almacen' },'llegada',almacen),{ status:409 });
});
