import { EQUIPOS_PERIFERICOS_TI, SEDES_TC, TIPOS_DOCUMENTO_OFICIAL, TIPOS_SOLICITUD_TI } from './solicitudesStorage.js';

export const PASOS_SOLICITUD_TI = ['Tipo de solicitud', 'Datos personales', 'Requerimiento', 'Revisar y enviar'];
export const MAX_ARCHIVO_TI = 10 * 1024 * 1024;
const FORMATOS_TI = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const nuevaSolicitudTI = () => ({
  tipoSolicitud: 'nuevo_usuario', solicitanteNombre: '', solicitanteCorreo: '', solicitanteDni: '',
  solicitanteArea: '', solicitanteCargo: '', mismoSolicitante: false, beneficiarioNombre: '',
  beneficiarioDni: '', beneficiarioCargo: '', sede: 'Sede Central', oficina: '',
  sedeOrigen: 'Sede Central', oficinaOrigen: '', equipoCategoria: 'laptop', codigoActual: '',
  equipoDetalle: '', justificacion: '', tipoDocumento: 'Memorando', numeroDocumento: '',
});

export const errorArchivoTI = (file) => {
  if (!file) return 'Adjunta el documento oficial que sustenta tu solicitud.';
  if (!FORMATOS_TI.has(file.type)) return 'Selecciona un archivo PDF, JPG, PNG o WEBP.';
  if (file.size === 0) return 'El archivo está vacío. Selecciona otro documento.';
  if (file.size > MAX_ARCHIVO_TI) return 'El archivo supera los 10 MB. Reduce su tamaño o selecciona otro.';
  return '';
};

export const validarPasoSolicitudTI = (form, file, step) => {
  const errors = {};
  const required = (key, message, max = 300) => {
    const value = String(form[key] || '').trim();
    if (!value) errors[key] = message;
    else if (value.length > max) errors[key] = `Usa como máximo ${max} caracteres.`;
  };
  if (step === 0) {
    if (!TIPOS_SOLICITUD_TI.some(([id]) => id === form.tipoSolicitud)) errors.tipoSolicitud = 'Selecciona un tipo de solicitud.';
  }
  if (step === 1) {
    required('solicitanteNombre', 'Escribe tus nombres y apellidos.');
    if (!/^\d{8}$/.test(form.solicitanteDni)) errors.solicitanteDni = 'El DNI debe tener 8 dígitos.';
    required('solicitanteCorreo', 'Escribe tu correo institucional.');
    if (form.solicitanteCorreo && !EMAIL.test(form.solicitanteCorreo.trim())) errors.solicitanteCorreo = 'Escribe un correo válido, por ejemplo nombre@tc.gob.pe.';
    required('solicitanteArea', 'Indica el área a la que perteneces.');
    required('solicitanteCargo', 'Indica tu cargo.');
    if (!form.mismoSolicitante) {
      required('beneficiarioNombre', 'Escribe los nombres y apellidos del beneficiario.');
      if (!/^\d{8}$/.test(form.beneficiarioDni)) errors.beneficiarioDni = 'El DNI del beneficiario debe tener 8 dígitos.';
      required('beneficiarioCargo', 'Indica el cargo o régimen del beneficiario.');
    }
  }
  if (step === 2) {
    if (!SEDES_TC.includes(form.sede)) errors.sede = 'Selecciona una sede.';
    required('oficina', 'Indica la oficina y el piso de destino.');
    if (form.tipoSolicitud === 'cambio_ubicacion') {
      if (!SEDES_TC.includes(form.sedeOrigen)) errors.sedeOrigen = 'Selecciona la sede de origen.';
      required('oficinaOrigen', 'Indica la oficina y el piso de origen.');
    }
    if (!EQUIPOS_PERIFERICOS_TI.some(([id]) => id === form.equipoCategoria)) errors.equipoCategoria = 'Selecciona el equipo o servicio.';
    if (form.tipoSolicitud === 'impresora_escaner' && !['impresora', 'escaner'].includes(form.equipoCategoria)) errors.equipoCategoria = 'Selecciona impresora o escáner.';
    if (['cambio_equipo', 'cambio_ubicacion'].includes(form.tipoSolicitud)) required('codigoActual', 'Indica el código patrimonial o la serie del equipo.', 150);
    else if (form.codigoActual.length > 150) errors.codigoActual = 'Usa como máximo 150 caracteres.';
    required('equipoDetalle', 'Describe qué equipo o servicio necesitas.', 3000);
    required('justificacion', 'Explica para qué necesitas este requerimiento.', 5000);
    if (!TIPOS_DOCUMENTO_OFICIAL.includes(form.tipoDocumento)) errors.tipoDocumento = 'Selecciona el tipo de documento oficial.';
    required('numeroDocumento', 'Escribe el número o la referencia del documento.');
    const fileError = errorArchivoTI(file);
    if (fileError) errors.documento = fileError;
  }
  return errors;
};

export const normalizarCodigoTI = (value = '') => value.normalize('NFKC').trim().replace(/[‐‑‒–—−]/g, '-').toUpperCase();
export const normalizarClaveTI = (value = '') => value.replace(/\s/g, '').toLowerCase();

export const validarConsultaTI = ({ codigo, clave, correo }, recuperar = false) => {
  const errors = {};
  if (!/^SOL-\d{4}-\d{6,}$/.test(normalizarCodigoTI(codigo))) errors.codigo = 'Escribe el número completo, por ejemplo SOL-2026-000001.';
  if (recuperar) {
    if (!EMAIL.test(String(correo || '').trim())) errors.correo = 'Escribe el correo que registraste en la solicitud.';
  } else if (!/^[a-f0-9]{48}$/.test(normalizarClaveTI(clave))) errors.clave = 'Pega la clave privada completa de 48 caracteres que aparece en tu constancia.';
  return errors;
};
