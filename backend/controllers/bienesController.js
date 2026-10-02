import { v4 as uuidv4 } from 'uuid';

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

export const createBien = async (req, res, sql) => {
  try {
    const {
      nombre, descripcion, tipo, marca, modelo, numeroSerie, fechaAdquisicion, costo,
      usuarioAsignado, ubicacion, especificaciones, imagenUrl, codigoPatrimonial,
      direccionMac, ordenCompra,
    } = req.body;
    
    const bien = await sql`
      INSERT INTO bienes_informaticos (
        nombre, descripcion, tipo, marca, modelo, numero_serie, fecha_adquisicion, costo,
        usuario_asignado, estado, ubicacion, especificaciones, imagen_url,
        codigo_patrimonial, direccion_mac, orden_compra
      )
      VALUES (
        ${nombre}, ${descripcion}, ${tipo}, ${marca}, ${modelo}, ${numeroSerie},
        ${fechaAdquisicion}, ${costo}, ${usuarioAsignado}, 'activo', ${ubicacion},
        ${sql.json(especificaciones || {})}, ${imagenUrl || null}, ${codigoPatrimonial || null},
        ${direccionMac || null}, ${ordenCompra || null}
      )
      RETURNING *
    `;
    res.status(201).json(bien[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateBien = async (req, res, sql) => {
  try {
    const { id } = req.params;
    const bodyValue = (key, currentValue) => (
      Object.prototype.hasOwnProperty.call(req.body, key) ? req.body[key] : currentValue
    );
    const userId = req.user?.sub ?? req.user?.id ?? null;
    const bien = await sql.begin(async (transaction) => {
      const user = await transaction`
        SELECT id FROM usuarios WHERE id = ${userId} FOR KEY SHARE
      `;
      if (user.length === 0) {
        return { status: 401, error: 'Sesión inválida. Inicia sesión nuevamente.' };
      }

      const currentBien = await transaction`SELECT * FROM bienes_informaticos WHERE id = ${id} FOR UPDATE`;
      if (currentBien.length === 0) {
        return { status: 404, error: 'Bien no encontrado' };
      }

      const previous = currentBien[0];
      if (['baja', 'dado_de_baja'].includes(String(previous.estado).toLowerCase())) {
        return { status: 403, error: 'No se puede modificar la ficha técnica de un bien dado de baja' };
      }

      const updatedValues = {
        nombre: bodyValue('nombre', previous.nombre),
        descripcion: bodyValue('descripcion', previous.descripcion),
        tipo: bodyValue('tipo', previous.tipo),
        marca: bodyValue('marca', previous.marca),
        modelo: bodyValue('modelo', previous.modelo),
        numeroSerie: bodyValue('numeroSerie', previous.numero_serie),
        fechaAdquisicion: bodyValue('fechaAdquisicion', previous.fecha_adquisicion),
        costo: bodyValue('costo', previous.costo),
        usuarioAsignado: bodyValue('usuarioAsignado', previous.usuario_asignado),
        estado: bodyValue('estado', previous.estado),
        ubicacion: bodyValue('ubicacion', previous.ubicacion),
        especificaciones: req.body.especificaciones !== undefined
          ? req.body.especificaciones
          : previous.especificaciones || {},
        imagenUrl: bodyValue('imagenUrl', previous.imagen_url),
        codigoPatrimonial: bodyValue('codigoPatrimonial', previous.codigo_patrimonial),
        direccionMac: bodyValue('direccionMac', previous.direccion_mac),
        ordenCompra: bodyValue('ordenCompra', previous.orden_compra),
      };

      if (!updatedValues.nombre || !updatedValues.tipo || !updatedValues.fechaAdquisicion || updatedValues.costo === null || updatedValues.costo === '') {
        return { status: 400, error: 'Nombre, tipo, fecha de adquisición y costo son obligatorios' };
      }

      await transaction`
        INSERT INTO historial_ficha_tecnica (bien_id, datos_anteriores, modificado_por)
        VALUES (${id}, ${transaction.json(previous)}, ${userId})
      `;

      const updatedBien = await transaction`
        UPDATE bienes_informaticos
        SET nombre = ${updatedValues.nombre},
            descripcion = ${updatedValues.descripcion},
            tipo = ${updatedValues.tipo},
            marca = ${updatedValues.marca},
            modelo = ${updatedValues.modelo},
            numero_serie = ${updatedValues.numeroSerie},
            fecha_adquisicion = ${updatedValues.fechaAdquisicion},
            costo = ${updatedValues.costo},
            usuario_asignado = ${updatedValues.usuarioAsignado},
            estado = ${updatedValues.estado},
            ubicacion = ${updatedValues.ubicacion},
            especificaciones = ${transaction.json(updatedValues.especificaciones || {})},
            imagen_url = ${updatedValues.imagenUrl},
            codigo_patrimonial = ${updatedValues.codigoPatrimonial},
            direccion_mac = ${updatedValues.direccionMac},
            orden_compra = ${updatedValues.ordenCompra},
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;

      await transaction`
        INSERT INTO audit_log (usuario_id, tabla_afectada, operacion, registro_id, datos_anteriores, datos_nuevos)
        VALUES (${userId}, 'bienes_informaticos', 'UPDATE', ${id}, ${transaction.json(previous)}, ${transaction.json(updatedBien[0])})
      `;

      return { bien: updatedBien[0] };
    });

    if (bien.status) {
      return res.status(bien.status).json({ error: bien.error });
    }

    res.json({
      message: 'Ficha técnica actualizada correctamente. Se registró una nueva versión en el historial.',
      bien: bien.bien,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getHistorialBien = async (req, res, sql) => {
  try {
    const { id } = req.params;
    const historial = await sql`
      SELECT h.id, h.bien_id, h.datos_anteriores, h.modificado_por, h.created_at,
             u.nombre AS modificado_por_nombre
      FROM historial_ficha_tecnica h
      LEFT JOIN usuarios u ON u.id = h.modificado_por
      WHERE h.bien_id = ${id}
      ORDER BY h.created_at DESC
    `;
    res.json(historial);
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
