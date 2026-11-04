import { getEquipoLabel, getTipoLabel } from './solicitudesStorage.js';

export const crearConstanciaTI = async (registro) => {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF();
  const data = registro.datos;
  const width = 174;
  let y = 22;
  const write = (text, { size = 10, bold = false, after = 5 } = {}) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(String(text || ''), width);
    for (const line of lines) {
      if (y > 272) { pdf.addPage(); y = 22; }
      pdf.text(line, 18, y);
      y += size * 0.46;
    }
    y += after;
  };
  write('SCA-TC | Tribunal Constitucional del Perú', { bold: true });
  write('Constancia de registro de solicitud TI', { size: 18, bold: true, after: 8 });
  write(`Número de registro: ${registro.codigo}`, { size: 13, bold: true });
  write(`Registrada el ${new Date(registro.created_at).toLocaleString('es-PE', { timeZone: 'America/Lima' })} (hora de Lima)`);
  write('Estado al registrar: Recibida');
  write('Datos para consultar tu solicitud', { size: 12, bold: true });
  write(`Clave privada: ${registro.clave}`, { size: 9 });
  write('Esta clave inicial es válida por siete días desde el registro. Permite consultar el trámite y sus documentos. Conserva esta constancia en un lugar privado.');
  write('Abre el formulario de Solicitudes TI y selecciona Consultar solicitud. Ingresa el número de registro y la clave; también puedes solicitar otra clave al correo registrado.');
  write('Resumen del requerimiento', { size: 12, bold: true });
  for (const text of [
    `Tipo: ${getTipoLabel(data.tipoSolicitud)}`,
    `Solicitante: ${data.solicitanteNombre} | DNI ${data.solicitanteDni}`,
    `Correo: ${data.solicitanteCorreo}`,
    `Área y cargo: ${data.solicitanteArea} | ${data.solicitanteCargo}`,
    `Beneficiario: ${data.mismoSolicitante ? data.solicitanteNombre : data.beneficiarioNombre}`,
    `Equipo o servicio: ${getEquipoLabel(data.equipoCategoria)}`,
    ...(data.codigoActual ? [`Código o serie: ${data.codigoActual}`] : []),
    ...(data.tipoSolicitud === 'cambio_ubicacion' ? [`Origen: ${data.sedeOrigen} | ${data.oficinaOrigen}`] : []),
    `Destino: ${data.sede} | ${data.oficina}`,
    `Detalle: ${data.equipoDetalle}`,
    `Justificación: ${data.justificacion}`,
    `Documento: ${data.tipoDocumento} ${data.numeroDocumento}`,
    `Archivo registrado: ${registro.archivo.nombre}`,
  ]) write(text);
  write('La constancia acredita el registro de la solicitud. La atención y la respuesta se consultan mediante el seguimiento.');
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); pdf.setFontSize(8); pdf.setTextColor(100);
    pdf.text(`SCA-TC | Constancia privada | Página ${page} de ${pages}`, 18, 286);
  }
  return pdf;
};
