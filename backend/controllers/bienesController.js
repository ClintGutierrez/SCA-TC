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

const fechaValida = (texto) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
};

export const getBienes = async (req, res, sql) => {
  try {
    const bienes = await sql`SELECT * FROM bienes_informaticos ORDER BY created_at DESC`;
    res.json(bienes);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
  const especificaciones = limpiar(body.especificaciones) || null;
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
  if (macIngresada && !MAC_REGEX.test(macIngresada)) {
    campos.direccionMac = 'Formato de MAC inválido (ej. A1:B2:C3:D4:E5:F6)';
  }
  if (valor !== null && (Number.isNaN(valor) || valor < 0)) {
    campos.valor = 'El valor debe ser un número mayor o igual a 0';
  }

  if (!fechaCompra) campos.fechaCompra = 'La fecha de compra es obligatoria';
  else if (!fechaValida(fechaCompra)) campos.fechaCompra = 'La fecha de compra no es válida';
  else if (fechaCompra > new Date().toISOString().slice(0, 10)) {
    campos.fechaCompra = 'La fecha de compra no puede ser futura';
  }

  if (garantiaAnios === null) campos.garantiaAnios = 'Los años de garantía son obligatorios (0 si no tiene)';
  else if (!Number.isInteger(garantiaAnios) || garantiaAnios < 0 || garantiaAnios > 10) {
    campos.garantiaAnios = 'Debe ser un número entero entre 0 y 10';
  }

  const detalles = {};
  if (config) {
    const recibidos = body.detalles && typeof body.detalles === 'object' ? body.detalles : {};

    [...config.requeridos, ...config.opcionales].forEach((clave) => {
      const bruto = limpiar(recibidos[clave]);
      const vacio = bruto === undefined || bruto === null || String(bruto) === '';

      if (vacio) {
        if (config.requeridos.includes(clave)) campos[`detalles.${clave}`] = 'Este campo es obligatorio';
        return;
      }

      if (clave === 'clasificacion' && !CLASIFICACIONES_ESCANER.includes(bruto)) {
        campos[`detalles.${clave}`] = 'Elige Regular o Alto consumo';
        return;
      }

      if (NUMERICOS.includes(clave)) {
        const numero = Number(bruto);
        if (Number.isNaN(numero) || numero < 0) {
          campos[`detalles.${clave}`] = 'Debe ser un número mayor o igual a 0';
        } else {
          detalles[clave] = numero;
        }
        return;
      }

      detalles[clave] = String(bruto).slice(0, 100);
    });
  }

  if (Object.keys(campos).length > 0) {
    return res.status(400).json({ error: 'Datos incompletos o inválidos', campos });
  }

  const direccionMac = macIngresada ? macIngresada.toUpperCase().replace(/-/g, ':') : null;
  const nombre = `${tipo} ${marca} ${modelo}`;
  const emailUsuario = req.user?.email ?? null;

  try {
    const bien = await sql.begin(async (tx) => {
      const [nuevo] = await tx`
        INSERT INTO bienes_informaticos
          (codigo_patrimonial, numero_serie, nombre, descripcion, tipo, marca, modelo,
           direccion_mac, orden_compra, detalles, fecha_adquisicion, garantia_anios,
           costo, estado, ubicacion)
        VALUES
          (${codigoPatrimonial}, ${numeroSerie}, ${nombre}, ${especificaciones}, ${tipo}, ${marca}, ${modelo},
           ${direccionMac}, ${ordenCompra}, ${tx.json(detalles)}, ${fechaCompra}, ${garantiaAnios},
           ${valor ?? 0}, 'activo', ${ubicacion})
        RETURNING *
      `;

      const [auditor] = await tx`SELECT id FROM usuarios WHERE email = ${emailUsuario}`;
      const usuarioAuditoria = auditor?.id ?? null;

      const registrada = await tx`
        UPDATE audit_log SET usuario_id = ${usuarioAuditoria}
        WHERE tabla_afectada = 'bienes_informaticos' AND operacion = 'INSERT'
          AND registro_id = ${nuevo.id} AND usuario_id IS NULL
      `;

      if (registrada.count === 0) {
        await tx`
          INSERT INTO audit_log (usuario_id, tabla_afectada, operacion, registro_id, datos_nuevos, created_at)
          VALUES (${usuarioAuditoria}, 'bienes_informaticos', 'INSERT', ${nuevo.id}, ${tx.json(nuevo)}, NOW())
        `;
      }

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
    const { nombre, descripcion, tipo, marca, modelo, numeroSerie, costo, usuarioAsignado, estado, ubicacion } = req.body;

    const bien = await sql`
      UPDATE bienes_informaticos 
      SET nombre = ${nombre}, 
          descripcion = ${descripcion}, 
          tipo = ${tipo}, 
          marca = ${marca}, 
          modelo = ${modelo}, 
          numero_serie = ${numeroSerie}, 
          costo = ${costo}, 
          usuario_asignado = ${usuarioAsignado}, 
          estado = ${estado}, 
          ubicacion = ${ubicacion},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (bien.length === 0) {
      return res.status(404).json({ error: 'Bien no encontrado' });
    }
    res.json(bien[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteBien = async (req, res, sql) => {
  try {
    const { id } = req.params;
    const result = await sql`DELETE FROM bienes_informaticos WHERE id = ${id}`;
    if (result.count === 0) {
      return res.status(404).json({ error: 'Bien no encontrado' });
    }
    res.json({ message: 'Bien eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};