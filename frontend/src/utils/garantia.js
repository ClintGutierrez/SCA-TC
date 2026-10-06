const aFecha = (valor) => {
  const [anio, mes, dia] = String(valor).slice(0, 10).split('-').map(Number);
  return new Date(anio, mes - 1, dia);
};

const sumarAnios = (fecha, anios) => {
  const anio = fecha.getFullYear() + anios;
  const ultimoDia = new Date(anio, fecha.getMonth() + 1, 0).getDate();
  return new Date(anio, fecha.getMonth(), Math.min(fecha.getDate(), ultimoDia));
};

const diferencia = (desde, hasta) => {
  let anios = hasta.getFullYear() - desde.getFullYear();
  let meses = hasta.getMonth() - desde.getMonth();
  let dias = hasta.getDate() - desde.getDate();

  if (dias < 0) {
    meses -= 1;
    dias += new Date(hasta.getFullYear(), hasta.getMonth(), 0).getDate();
  }
  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }
  return { anios, meses, dias };
};

const unidad = (cantidad, singular, plural) => `${cantidad} ${cantidad === 1 ? singular : plural}`;

const describir = ({ anios, meses, dias }) => {
  const partes = [];
  if (anios) partes.push(unidad(anios, 'año', 'años'));
  if (meses) partes.push(unidad(meses, 'mes', 'meses'));
  if (dias) partes.push(unidad(dias, 'día', 'días'));

  if (partes.length === 0) return '0 días';
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
};

export const calcularGarantia = (fechaCompra, garantiaAnios) => {
  if (!fechaCompra || garantiaAnios === '' || garantiaAnios == null) return null;

  const anios = Number(garantiaAnios);
  if (Number.isNaN(anios)) return null;
  if (anios === 0) return { estado: 'sin_garantia', etiqueta: 'Sin garantía', detalle: '' };

  const fin = sumarAnios(aFecha(fechaCompra), anios);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const hasta = fin.toLocaleDateString('es-PE');

  if (fin >= hoy) {
    return {
      estado: 'vigente',
      etiqueta: 'Vigente',
      detalle: fin.getTime() === hoy.getTime()
        ? `Vence hoy (${hasta})`
        : `Quedan ${describir(diferencia(hoy, fin))} (hasta el ${hasta})`,
    };
  }

  return {
    estado: 'vencida',
    etiqueta: 'Vencida',
    detalle: `Venció hace ${describir(diferencia(fin, hoy))} (el ${hasta})`,
  };
};