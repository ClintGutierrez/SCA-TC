import { responderError } from '../utils/errores.js';
import { anoLima, calcularDepreciacion } from '../utils/depreciacion.js';

const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;

const CLASIFICACIONES_ESCANER = ['Regular', 'Alto consumo'];
const NUMERICOS = ['numPuertos', 'bahias', 'velocidadPpm', 'cicloDiario', 'capacidadAdf'];
const COMPUTO = ['procesador', 'ram', 'almacenamiento'];

const TIPOS = {
  laptop: { mac: true, requeridos: COMPUTO, opcionales: ['pantalla', 'sistemaOperativo'] },
  computadora: { mac: true, requeridos: COMPUTO, opcionales: ['sistemaOperativo'] },
  servidor: { mac: true, requeridos: COMPUTO, opcionales: ['formato', 'sistemaOperativo'] },
  switch: { mac: true, requeridos: ['numPuertos'], opcionales: ['velocidad', 'administrable', 'poe'] },
  nas: { mac: true, requeridos: ['bahias', 'capacidadTotal'], opcionales: ['tipoDiscos', 'raid'] },
  camara: { mac: true, requeridos: ['tipoCamara', 'resolucion'], opcionales: ['visionNocturna'] },
  escaner: {
    mac: false,
    requeridos: ['clasificacion'],
    opcionales: ['tipoEscaner', 'velocidadPpm', 'cicloDiario', 'capacidadAdf', 'resolucionDpi'],
  },
  monitor: { mac: false, requeridos: ['tamano', 'resolucion'], opcionales: ['tipoPanel', 'puertos'] },
  impresora: { mac: true, requeridos: ['tecnologia'], opcionales: ['color', 'conectividad'] },
  teclado: { mac: false, requeridos: ['conexion'], opcionales: ['tipoTeclado', 'idioma'] },
  mouse: { mac: false, requeridos: ['conexion'], opcionales: ['tipoMouse', 'dpi'] },
  otro: { mac: true, requeridos: [], opcionales: [] },
};

const limpiar = (valor) => (typeof valor === 'string' ? valor.trim() : valor);

const costoValido = (valor) => (typeof valor === 'number' || (typeof valor === 'string' && valor.trim() !== ''))
  && Number.isFinite(Number(valor)) && Number(valor) >= 0;

const fechaValida = (texto) => {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
};

const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);

// Reglas comunes a registrar y editar. Cada una devuelve el mensaje de error o null.
const errorFecha = (texto) => {
  if (!fechaValida(texto)) return 'La fecha no es válida';
  if (texto > new Date().toISOString().slice(0, 10)) return 'La fecha no puede ser futura';
  return null;
};

const errorGarantia = (anios) => (Number.isInteger(anios) && anios >= 0 && anios <= 10
  ? null : 'Debe ser un número entero entre 0 y 10');

const errorMac = (mac) => (mac && !MAC_REGEX.test(mac) ? 'Formato de MAC inválido (ej. A1:B2:C3:D4:E5:F6)' : null);

const normalizarMac = (mac) => (mac ? mac.toUpperCase().replace(/-/g, ':') : null);

const errorImagenUrl = (url) => {
  if (!url) return null;
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol) ? null : 'La URL debe empezar con http:// o https://';
  } catch {
    return 'La URL no es válida';
  }
};

// Especificaciones libres del editor: objeto plano con valores simples y cortos.
const errorEspecificaciones = (valor) => {
  if (!esObjeto(valor)) return 'Las especificaciones no tienen el formato esperado';
  const entradas = Object.entries(valor);
  if (entradas.length > 50) return 'Hay demasiadas especificaciones';
  const valida = ([clave, dato]) => clave.length <= 100 && (dato === null
    || typeof dato === 'boolean' || (typeof dato === 'number' && Number.isFinite(dato))
    || (typeof dato === 'string' && dato.length <= 300));
  return entradas.every(valida) ? null : 'Las especificaciones no tienen el formato esperado';
};

// Valida los detalles técnicos según el tipo de bien y devuelve solo las claves de ese tipo.
// Con exigirRequeridos=false se usa para conservar lo compatible al cambiar de tipo.
const validarDetalles = (config, recibidos, { exigirRequeridos = true } = {}) => {
  const detalles = {};
  const campos = {};
  const datos = esObjeto(recibidos) ? recibidos : {};

  [...config.requeridos, ...config.opcionales].forEach((clave) => {
    const bruto = limpiar(datos[clave]);
    const vacio = bruto === undefined || bruto === null || String(bruto) === '';

    if (vacio) {
      if (exigirRequeridos && config.requeridos.includes(clave)) campos[`detalles.${clave}`] = 'Este campo es obligatorio';
      return;
    }

    if (clave === 'clasificacion' && !CLASIFICACIONES_ESCANER.includes(bruto)) {
      campos[`detalles.${clave}`] = 'Elige Regular o Alto consumo';
      return;
    }

    if (NUMERICOS.includes(clave)) {
      const numero = Number(bruto);
      if (typeof bruto === 'boolean' || Number.isNaN(numero) || numero < 0) {
        campos[`detalles.${clave}`] = 'Debe ser un número mayor o igual a 0';
      } else {
        detalles[clave] = numero;
      }
      return;
    }

    detalles[clave] = String(bruto).slice(0, 100);
  });

  return { detalles, campos };
};

const anioDe = (fecha) => {
  if (fecha instanceof Date) return Number.isNaN(fecha.getTime()) ? null : fecha.getUTCFullYear();
  return typeof fecha === 'string' && /^\d{4}/.test(fecha) ? Number(fecha.slice(0, 4)) : null;
};

// Si cambia el año de adquisición, la depreciación del bien se concilia en la misma transacción
// (como la migración 20261110_depreciacion_ano_adquisicion): nuevo año base, importe recalculado
// en línea recta y registro en audit_log. Así el bien y su depreciación nunca quedan descuadrados.
const conciliarDepreciacion = async (tx, bienId, anoAdquisicion, user) => {
  const filas = await tx`SELECT * FROM depreciacion WHERE bien_id = ${bienId} ORDER BY id FOR UPDATE`;
  if (!filas.length) return;
  if (filas.length > 1) {
    throw Object.assign(new Error('El bien tiene varias depreciaciones; concilie sus registros antes de cambiar la fecha'), { status: 409 });
  }
  const actual = filas[0];
  if (Number(actual.ano_base) === anoAdquisicion) return;

  const anoActual = Math.max(Number(actual.ano_actual), anoAdquisicion);
  let valorActual;
  try {
    if (!Number.isInteger(anoActual) || anoActual > anoLima()) throw new Error('Año de cálculo inválido');
    valorActual = calcularDepreciacion(actual.valor_inicial, actual.porcentaje_anual, anoActual - anoAdquisicion);
  } catch {
    throw Object.assign(new Error('La depreciación del bien tiene datos inválidos; revísela antes de cambiar la fecha'), { status: 409 });
  }

  await tx`SELECT set_config('app.conciliar_ano_base', 'on', true)`;
  await tx`
    UPDATE depreciacion SET ano_base = ${anoAdquisicion}, ano_actual = ${anoActual},
      valor_actual = ${valorActual}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${actual.id}
  `;
  await tx`SELECT set_config('app.conciliar_ano_base', 'off', true)`;
  const userId = user?.sub ?? user?.id ?? null;
  await tx`
    INSERT INTO audit_log (usuario_id, tabla_afectada, operacion, registro_id, datos_anteriores, datos_nuevos)
    VALUES (${userId}, 'depreciacion', 'CONCILIAR_ANO_ADQUISICION', ${actual.id},
      ${tx.json({ bien_id: bienId, ano_base: actual.ano_base, ano_actual: actual.ano_actual, valor_actual: actual.valor_actual })},
      ${tx.json({ bien_id: bienId, ano_base: anoAdquisicion, ano_actual: anoActual, valor_actual: valorActual })})
  `;
};

const setAuditUser = async (transaction, user) => {
  const userId = user?.sub ?? user?.id;
  await transaction`SELECT set_config('app.audit_user_id', ${userId ? String(userId) : ''}, true)`;
};

export const getBienes = async (req, res, sql) => {
  try {
    const bienes = await sql`SELECT * FROM bienes_informaticos ORDER BY created_at DESC`;
    res.json(bienes);
  } catch (error) {
    return responderError(res, error, 'bienes.getBienes');
  }
};

export const getBienById = async (req, res, sql) => {
  try {
    const { id } = req.params;
    const bien = await sql`SELECT * FROM bienes_informaticos WHERE id = ${id}`;
    if (bien.length === 0) {
      return res.status(404).json({ error: 'Bien no encontrado' });
    }
    res.json(bien[0]);
  } catch (error) {
    return responderError(res, error, 'bienes.getBienById');
  }
};

// CU-03 Registrar Bien Informático
export const createBien = async (req, res, sql) => {
  const body = req.body || {};
  const codigoPatrimonial = limpiar(body.codigoPatrimonial);
  const numeroSerie = limpiar(body.numeroSerie);
  const tipo = limpiar(body.tipo);
  const config = Object.hasOwn(TIPOS, tipo) ? TIPOS[tipo] : null;
  const marca = limpiar(body.marca);
  const modelo = limpiar(body.modelo);
  const ubicacion = limpiar(body.ubicacion);
  const descripcion = limpiar(body.especificaciones) || null;
  const ordenCompra = limpiar(body.ordenCompra) || null;
  const macIngresada = config?.mac ? limpiar(body.direccionMac) : null;
  const valor = body.valor === '' || body.valor == null ? null : Number(body.valor);
  const fechaCompra = limpiar(body.fechaCompra);
  const garantiaAnios =
    body.garantiaAnios === '' || body.garantiaAnios == null ? null : Number(body.garantiaAnios);

  const campos = {};
  if (!codigoPatrimonial) campos.codigoPatrimonial = 'El código patrimonial es obligatorio';
  if (!numeroSerie) campos.numeroSerie = 'El número de serie es obligatorio';
  if (!tipo) campos.tipo = 'El tipo de bien es obligatorio';
  else if (!config) campos.tipo = 'El tipo de bien no es válido';
  if (!marca) campos.marca = 'La marca es obligatoria';
  if (!modelo) campos.modelo = 'El modelo es obligatorio';
  if (!ubicacion) campos.ubicacion = 'La ubicación / sede inicial es obligatoria';
  const errorMacIngresada = errorMac(macIngresada);
  if (errorMacIngresada) campos.direccionMac = errorMacIngresada;
  if (valor === null) campos.valor = 'El valor es obligatorio (0 si no tuvo costo)';
  else if (!costoValido(body.valor)) campos.valor = 'El valor debe ser un número mayor o igual a 0';

  if (!fechaCompra) campos.fechaCompra = 'La fecha de compra es obligatoria';
  else {
    const errorFechaCompra = errorFecha(fechaCompra);
    if (errorFechaCompra) campos.fechaCompra = errorFechaCompra.replace('La fecha', 'La fecha de compra');
  }

  if (garantiaAnios === null) campos.garantiaAnios = 'Los años de garantía son obligatorios (0 si no tiene)';
  else if (errorGarantia(garantiaAnios)) campos.garantiaAnios = errorGarantia(garantiaAnios);

  let detalles = {};
  if (config) {
    const resultado = validarDetalles(config, body.detalles);
    detalles = resultado.detalles;
    Object.assign(campos, resultado.campos);
  }

  if (Object.keys(campos).length > 0) {
    return res.status(400).json({ error: 'Datos incompletos o inválidos', campos });
  }

  const direccionMac = normalizarMac(macIngresada);
  const nombre = `${tipo} ${marca} ${modelo}`;
  try {
    const bien = await sql.begin(async (tx) => {
      await setAuditUser(tx, req.user);
      const [nuevo] = await tx`
        INSERT INTO bienes_informaticos
          (codigo_patrimonial, numero_serie, nombre, descripcion, tipo, marca, modelo,
           direccion_mac, orden_compra, especificaciones, detalles, fecha_adquisicion, garantia_anios,
           costo, estado, ubicacion)
        VALUES
          (${codigoPatrimonial}, ${numeroSerie}, ${nombre}, ${descripcion}, ${tipo}, ${marca}, ${modelo},
           ${direccionMac}, ${ordenCompra}, ${tx.json({})}, ${tx.json(detalles)}, ${fechaCompra}, ${garantiaAnios},
           ${valor}, 'activo', ${ubicacion})
        RETURNING *
      `;

      return nuevo;
    });

    res.status(201).json(bien);
  } catch (error) {
    if (error.code === '23505') {
      const esCodigo = String(error.constraint_name || '').includes('codigo');
      return res.status(409).json({
        error: esCodigo
          ? 'El código patrimonial ya está registrado'
          : 'El número de serie ya está registrado',
        campo: esCodigo ? 'codigoPatrimonial' : 'numeroSerie',
      });
    }

    console.error('Error al registrar bien:', error);
    res.status(500).json({ error: 'No se pudo registrar el bien. Intente nuevamente.' });
  }
};

export const updateBien = async (req, res, sql) => {
  try {
    const { id } = req.params;
    const body = esObjeto(req.body) ? req.body : {};
    const sent = (key) => Object.hasOwn(body, key);
    const value = (key, fallback) => (sent(key) ? limpiar(body[key]) : fallback);
    const result = await sql.begin(async (transaction) => {
      await setAuditUser(transaction, req.user);
      const current = await transaction`SELECT * FROM bienes_informaticos WHERE id = ${id} FOR UPDATE`;
      if (!current.length) return { status: 404, error: 'Bien no encontrado' };
      const previous = current[0];
      if (['baja', 'dado_de_baja'].includes(String(previous.estado).toLowerCase())) {
        return { status: 403, error: 'No se puede modificar la ficha técnica de un bien dado de baja' };
      }
      if (sent('estado') && body.estado !== previous.estado) {
        return { status: 409, error: 'El estado del bien se gestiona desde Bajas, Movimientos o Mantenimiento' };
      }
      const values = {
        nombre: value('nombre', previous.nombre), descripcion: value('descripcion', previous.descripcion),
        tipo: value('tipo', previous.tipo), marca: value('marca', previous.marca),
        modelo: value('modelo', previous.modelo), numeroSerie: value('numeroSerie', previous.numero_serie),
        fechaAdquisicion: value('fechaAdquisicion', previous.fecha_adquisicion), costo: value('costo', previous.costo),
        usuarioAsignado: value('usuarioAsignado', previous.usuario_asignado),
        ubicacion: value('ubicacion', previous.ubicacion), especificaciones: value('especificaciones', previous.especificaciones || {}),
        imagenUrl: value('imagenUrl', previous.imagen_url), codigoPatrimonial: value('codigoPatrimonial', previous.codigo_patrimonial),
        direccionMac: value('direccionMac', previous.direccion_mac), ordenCompra: value('ordenCompra', previous.orden_compra),
        detalles: value('detalles', previous.detalles || {}),
        garantiaAnios: value('garantiaAnios', previous.garantia_anios),
      };
      if (!String(values.nombre || '').trim() || !String(values.tipo || '').trim() ||
          !values.fechaAdquisicion || values.costo === null || values.costo === '') {
        return { status: 400, error: 'Nombre, tipo, fecha de adquisición y costo son obligatorios' };
      }
      if (!costoValido(values.costo)) {
        return { status: 400, error: 'El costo debe ser un número finito mayor o igual a 0' };
      }

      // Mismas reglas que al registrar. Solo se validan los campos enviados, para que una
      // ficha antigua con datos incompletos pueda seguir editándose en lo demás.
      const campos = {};
      const tipoCambio = sent('tipo') && values.tipo !== previous.tipo;
      const config = Object.hasOwn(TIPOS, values.tipo) ? TIPOS[values.tipo] : null;
      // Un tipo antiguo que no está en la lista se conserva, pero no se puede elegir uno nuevo inválido.
      if (tipoCambio && !config) campos.tipo = 'El tipo de bien no es válido';

      for (const [clave, columna, etiqueta] of [
        ['codigoPatrimonial', 'codigo_patrimonial', 'El código patrimonial'],
        ['numeroSerie', 'numero_serie', 'El número de serie'],
      ]) {
        if (sent(clave) && !values[clave] && previous[columna]) campos[clave] = `${etiqueta} no se puede quitar`;
      }
      if (sent('fechaAdquisicion')) {
        const error = errorFecha(values.fechaAdquisicion);
        if (error) campos.fechaAdquisicion = error;
      }
      if (sent('garantiaAnios')) {
        const anios = values.garantiaAnios === '' || values.garantiaAnios == null ? null : Number(values.garantiaAnios);
        if (anios === null) campos.garantiaAnios = 'Los años de garantía son obligatorios (0 si no tiene)';
        else if (errorGarantia(anios)) campos.garantiaAnios = errorGarantia(anios);
        else values.garantiaAnios = anios;
      }
      if (sent('direccionMac')) {
        if (typeof values.direccionMac !== 'string' && values.direccionMac != null) campos.direccionMac = 'La dirección MAC no es válida';
        else if (errorMac(values.direccionMac)) campos.direccionMac = errorMac(values.direccionMac);
        else values.direccionMac = normalizarMac(values.direccionMac);
      }
      if (sent('imagenUrl')) {
        if (typeof values.imagenUrl !== 'string' && values.imagenUrl != null) campos.imagenUrl = 'La URL no es válida';
        else if (errorImagenUrl(values.imagenUrl)) campos.imagenUrl = errorImagenUrl(values.imagenUrl);
      }
      if (sent('especificaciones')) {
        const error = errorEspecificaciones(values.especificaciones ?? {});
        if (error) campos.especificaciones = error;
      }
      for (const clave of ['nombre', 'descripcion', 'marca', 'modelo', 'numeroSerie', 'ubicacion', 'codigoPatrimonial', 'ordenCompra', 'usuarioAsignado']) {
        if (sent(clave) && values[clave] != null && typeof values[clave] !== 'string') campos[clave] = 'El valor no es válido';
      }

      // Detalles técnicos: si se envían, se validan completos contra el tipo; si solo cambia
      // el tipo, se conservan únicamente los detalles compatibles con el nuevo tipo.
      if (sent('detalles')) {
        if (!esObjeto(values.detalles)) campos.detalles = 'Los detalles no tienen el formato esperado';
        else if (!config) {
          if (Object.keys(values.detalles).length) campos.tipo = 'Elige un tipo de bien válido para registrar sus detalles';
        } else {
          const resultado = validarDetalles(config, values.detalles);
          Object.assign(campos, resultado.campos);
          values.detalles = resultado.detalles;
        }
      } else if (tipoCambio && config) {
        values.detalles = validarDetalles(config, previous.detalles, { exigirRequeridos: false }).detalles;
      }

      if (Object.keys(campos).length) return { status: 400, error: 'Datos incompletos o inválidos', campos };

      const anoNuevo = anioDe(values.fechaAdquisicion);
      if (sent('fechaAdquisicion') && anoNuevo !== anioDe(previous.fecha_adquisicion)) {
        await conciliarDepreciacion(transaction, previous.id, anoNuevo, req.user);
      }

      const [updated] = await transaction`
        UPDATE bienes_informaticos SET nombre = ${String(values.nombre).trim()},
          descripcion = ${values.descripcion || null}, tipo = ${String(values.tipo).trim()},
          marca = ${values.marca || null}, modelo = ${values.modelo || null},
          numero_serie = ${values.numeroSerie || null}, fecha_adquisicion = ${values.fechaAdquisicion},
          costo = ${Number(values.costo)}, usuario_asignado = ${values.usuarioAsignado || null},
          ubicacion = ${values.ubicacion || null},
          especificaciones = ${transaction.json(values.especificaciones || {})},
          detalles = ${transaction.json(values.detalles || {})},
          imagen_url = ${values.imagenUrl || null}, codigo_patrimonial = ${values.codigoPatrimonial || null},
          direccion_mac = ${values.direccionMac || null}, orden_compra = ${values.ordenCompra || null},
          garantia_anios = ${values.garantiaAnios ?? null}, updated_at = NOW()
        WHERE id = ${id} RETURNING *
      `;
      return { bien: updated };
    });
    if (result.status) {
      return res.status(result.status).json({ error: result.error, ...(result.campos ? { campos: result.campos } : {}) });
    }
    res.json({ message: 'Ficha técnica actualizada correctamente.', bien: result.bien });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un bien con ese código patrimonial o número de serie' });
    return responderError(res, error, 'bienes.updateBien');
  }
};

export const getHistorialBien = async (req, res, sql) => {
  try {
    const historial = await sql`
      SELECT h.id, h.bien_id, h.datos_anteriores, h.modificado_por, h.created_at,
             u.nombre AS modificado_por_nombre
      FROM historial_ficha_tecnica h LEFT JOIN usuarios u ON u.id = h.modificado_por
      WHERE h.bien_id = ${req.params.id} ORDER BY h.created_at DESC
    `;
    res.json(historial);
  } catch (error) {
    return responderError(res, error, 'bienes.getHistorialBien');
  }
};

export const deleteBien = async (req, res, sql) => {
  try {
    const { id } = req.params;
    const result = await sql.begin(async (transaction) => {
      await setAuditUser(transaction, req.user);
      return transaction`DELETE FROM bienes_informaticos WHERE id = ${id}`;
    });
    if (result.count === 0) {
      return res.status(404).json({ error: 'Bien no encontrado' });
    }
    res.json({ message: 'Bien eliminado correctamente' });
  } catch (error) {
    return responderError(res, error, 'bienes.deleteBien');
  }
};
