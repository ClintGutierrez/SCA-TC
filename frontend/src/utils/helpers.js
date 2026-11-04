import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export const formatearFecha = (fecha) => {
  if (!fecha) return '-';
  return formatDistanceToNow(new Date(fecha), { addSuffix: true, locale: es });
};

export const formatearMoneda = (valor) => {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(valor || 0);
};

export const calcularEdad = (fechaInicio) => {
  if (!fechaInicio) return 0;
  const hoy = new Date();
  const inicio = new Date(fechaInicio);
  let edad = hoy.getFullYear() - inicio.getFullYear();
  const mes = hoy.getMonth() - inicio.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < inicio.getDate())) {
    edad--;
  }
  return edad;
};

export const generarReportePDF = (datos, titulo) => {
  // Implementación futura con librería de PDF
  console.log(`Generando reporte: ${titulo}`);
};
