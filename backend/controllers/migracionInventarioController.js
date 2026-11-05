import {
  crearPlantillaCsv,
  crearPlantillaInventario,
  ImportacionInventarioError,
  parseImportFile,
  validarRegistrosInventario,
} from '../utils/migracionInventario.js';

export const getExisting = async (sql, rows) => {
  const codes = [...new Set(rows.map(({ valores }) => String(valores.codigo_patrimonial ?? '').trim().toLocaleUpperCase('es-PE')).filter(Boolean))];
  const serials = [...new Set(rows.map(({ valores }) => String(valores.numero_serie ?? '').trim().toLocaleUpperCase('es-PE')).filter(Boolean))];
  if (!codes.length && !serials.length) return [];
  return sql`
    SELECT codigo_patrimonial, numero_serie
    FROM bienes_informaticos
    WHERE UPPER(codigo_patrimonial) = ANY(${sql.array(codes, 25)})
       OR UPPER(numero_serie) = ANY(${sql.array(serials, 25)})
  `;
};

const validationResponse = ({ total, validos, errores, registros }) => ({
  resumen: { total, validos, errores },
  registros: registros.map(({ datos, ...preview }) => preview),
});

const safeFileName = (name = '') => String(name).replace(/[\\/\0]/g, '').slice(0, 255) || 'archivo';

const respondError = (res, error, fallbackMessage) => {
  if (error instanceof ImportacionInventarioError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(fallbackMessage, error);
  return res.status(500).json({ error: fallbackMessage });
};

export const descargarPlantilla = async (req, res) => {
  const format = req.params.formato;
  if (!['csv', 'xlsx'].includes(format)) return res.status(404).json({ error: 'Formato de plantilla no encontrado.' });
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_migracion_inventario.csv"');
    return res.send(crearPlantillaCsv());
  }
  try {
    const buffer = await crearPlantillaInventario();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_migracion_inventario.xlsx"');
    return res.send(Buffer.from(buffer));
  } catch (error) {
    return respondError(res, error, 'No se pudo generar la plantilla de inventario.');
  }
};

export const validarArchivo = async (req, res, sql) => {
  try {
    const rows = await parseImportFile(req.file);
    const existing = await getExisting(sql, rows);
    const result = validarRegistrosInventario(rows, existing);
    return res.json(validationResponse(result));
  } catch (error) {
    return respondError(res, error, 'No se pudo validar el archivo de inventario.');
  }
};

export const confirmarImportacion = async (req, res, sql) => {
  try {
    const rows = await parseImportFile(req.file);
    const result = await sql.begin(async (tx) => {
      const existing = await getExisting(tx, rows);
      const validation = validarRegistrosInventario(rows, existing);
      if (validation.validos === 0) {
        const error = new ImportacionInventarioError('No hay registros válidos para importar. Corrija los errores y vuelva a procesar el archivo.', 409);
        error.validation = validationResponse(validation);
        throw error;
      }

      const userId = Number(req.user?.sub);
      await tx`SELECT set_config('app.audit_user_id', ${Number.isInteger(userId) ? String(userId) : ''}, true)`;
      const columnas = [
        'codigo_patrimonial', 'numero_serie', 'nombre', 'descripcion', 'tipo', 'marca', 'modelo',
        'direccion_mac', 'orden_compra', 'especificaciones', 'detalles', 'fecha_adquisicion',
        'garantia_anios', 'costo', 'estado', 'ubicacion',
      ];
      const bienes = validation.registrosValidos.map((bien) => ({
        codigo_patrimonial: bien.codigo_patrimonial,
        numero_serie: bien.numero_serie,
        nombre: bien.nombre,
        descripcion: bien.descripcion,
        tipo: bien.tipo,
        marca: bien.marca,
        modelo: bien.modelo,
        direccion_mac: bien.direccion_mac || null,
        orden_compra: bien.orden_compra,
        especificaciones: tx.json({}),
        detalles: tx.json(bien.detalles),
        fecha_adquisicion: bien.fecha_adquisicion,
        garantia_anios: bien.garantia_anios,
        costo: bien.costo,
        estado: 'activo',
        ubicacion: bien.ubicacion,
      }));
      for (let offset = 0; offset < bienes.length; offset += 250) {
        await tx`
          INSERT INTO bienes_informaticos ${tx(bienes.slice(offset, offset + 250), columnas)}
        `;
      }

      const auditData = {
        nombre_archivo: safeFileName(req.file.originalname),
        cantidad_filas_insertadas: validation.validos,
        fecha_hora: new Date().toISOString(),
        usuario_id: Number.isInteger(userId) ? userId : null,
      };
      await tx`
        INSERT INTO audit_log
          (usuario_id, tabla_afectada, operacion, registro_id, datos_nuevos)
        VALUES
          (${Number.isInteger(userId) ? userId : null}, 'migraciones_inventario',
           'IMPORTAR', NULL, ${tx.json(auditData)})
      `;

      return {
        cantidad: validation.validos,
        archivo: auditData.nombre_archivo,
        fecha: auditData.fecha_hora,
        resumen: { total: validation.total, validos: validation.validos, errores: validation.errores },
        registros: validationResponse(validation).registros,
      };
    });
    return res.status(201).json({
      message: `Se importaron ${result.cantidad} bienes correctamente.`,
      ...result,
    });
  } catch (error) {
    if (error.validation) return res.status(error.status).json({ error: error.message, ...error.validation });
    if (error.code === '23505') {
      console.error('Conflicto de unicidad durante la migración de inventario:', error);
      return res.status(409).json({
        error: 'Otro usuario registró uno de estos bienes durante la importación. Vuelva a procesar el archivo para actualizar la validación.',
      });
    }
    return respondError(res, error, 'No se pudo completar la importación. No se guardaron cambios.');
  }
};
