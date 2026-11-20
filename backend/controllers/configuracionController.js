import { isDeepStrictEqual } from 'node:util';
import { DEPRECIACION_ANUAL_PREDETERMINADA, validarPorcentajeAnual } from '../utils/depreciacion.js';
import { GARANTIA_PREDETERMINADA, normalizarAniosGarantia } from '../utils/garantia.js';

const DEFAULT_SETTINGS = {
  institution: {
    nombre: 'Tribunal Constitucional del Perú',
    ruc: '',
    direccion: '',
    telefono: '',
    correo: '',
    responsable: '',
  },
  inventory: {
    moneda: 'PEN',
    garantiaPredeterminada: GARANTIA_PREDETERMINADA,
    depreciacionAnual: DEPRECIACION_ANUAL_PREDETERMINADA,
    requiereCodigoPatrimonial: true,
    requiereNumeroSerie: false,
  },
  assignments: {
    requiereActa: true,
    requiereFirmaResponsable: true,
    permiteMultiplesBienes: true,
  },
  bajas: {
    requiereFotoFrontal: true,
    requiereFotoLateral: true,
    documentoOpcional: true,
    vigenciaUrlHoras: 1,
  },
  maintenance: {
    requiereCosto: false,
    requiereResponsable: true,
    alertaDias: 30,
  },
  reports: {
    mostrarLogo: true,
    mostrarFirma: true,
    formatoFecha: 'DD/MM/YYYY',
    piePagina: '',
  },
  notifications: {
    mantenimiento: true,
    garantia: true,
    bienesSinAsignar: false,
    correoHabilitado: false,
  },
  audit: {
    retencionDias: 365,
    registrarAccesos: true,
    registrarCambios: true,
  },
  siga: {
    habilitado: false,
    ambiente: 'pruebas',
    urlServicio: '',
    codigoEntidad: '',
    codigoUnidadEjecutora: '',
    frecuenciaSincronizacion: 'manual',
    ultimaSincronizacion: '',
    resultadoUltimaSincronizacion: 'No configurada',
  },
};

const DEFAULT_CATALOGS = {
  sedes: ['Centro de Lima', 'Sede Central', 'Centro de estudios constitucionales', 'Sede Arequipa'],
  regimenes_laborales: ['Practicante', 'Locador de servicios', 'CAS', 'CAP', 'Personal de confianza', 'Servir'],
  oficinas: [],
  areas: [],
  pisos: [],
  motivos_baja: [],
  tipos_mantenimiento: ['Preventivo', 'Correctivo', 'Repotenciación'],
};

function mergeSectionSettings(section, saved) {
  const settings = { ...DEFAULT_SETTINGS[section], ...saved };
  if (section === 'inventory') {
    settings.garantiaPredeterminada = normalizarAniosGarantia(settings.garantiaPredeterminada) ?? GARANTIA_PREDETERMINADA;
  }
  return settings;
}

const valoresCatalogo = (categoria, rows) => rows.length
  ? rows.map(({ valor, activo }) => ({ valor, activo }))
  : DEFAULT_CATALOGS[categoria].map((valor) => ({ valor, activo: true }));

function valorAuditable(campo, valor) {
  if (campo !== 'siga.urlServicio' || !valor) return valor ?? null;

  // Los parámetros y las credenciales de una URL pueden contener secretos.
  try {
    const url = new URL(valor);
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      return url.origin + url.pathname;
    }
  } catch {
    return 'URL protegida';
  }
  return 'URL protegida';
}

export const getConfiguracion = async (req, res, sql) => {
  try {
    const [settings, catalogs] = await Promise.all([
      sql`SELECT clave, valor FROM configuracion_sistema ORDER BY clave`,
      sql`SELECT id, categoria, valor, activo, orden FROM catalogos_sistema ORDER BY categoria, orden, valor`,
    ]);
    const saved = Object.fromEntries(settings.map((item) => [item.clave, item.valor]));
    const grouped = Object.fromEntries(Object.keys(DEFAULT_CATALOGS).map((category) => [category, []]));
    catalogs.forEach((item) => {
      if (!grouped[item.categoria]) grouped[item.categoria] = [];
      grouped[item.categoria].push(item);
    });
    Object.entries(DEFAULT_CATALOGS).forEach(([category, values]) => {
      if (grouped[category].length === 0) {
        grouped[category] = values.map((valor, orden) => ({ id: null, categoria: category, valor, activo: true, orden }));
      }
    });
    const mergedSettings = Object.fromEntries(
      Object.keys(DEFAULT_SETTINGS).map((section) => [section, mergeSectionSettings(section, saved[section])]),
    );
    res.json({ settings: mergedSettings, catalogs: grouped });
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({ error: 'No se pudo obtener la configuración' });
  }
};

export const saveConfiguracion = async (req, res, sql) => {
  try {
    const operatorId = Number(req.user?.sub);
    if (!Number.isSafeInteger(operatorId) || operatorId <= 0) {
      return res.status(401).json({ error: 'Identidad de sesión inválida' });
    }

    const settings = req.body?.settings;
    const catalogs = req.body?.catalogs;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return res.status(400).json({ error: 'La configuración es inválida' });
    }
    if (settings.inventory && typeof settings.inventory === 'object' && Object.hasOwn(settings.inventory, 'depreciacionAnual')) {
      try {
        const tasa = validarPorcentajeAnual(settings.inventory.depreciacionAnual);
        if (tasa <= 0) throw new Error();
        settings.inventory = { ...settings.inventory, depreciacionAnual: tasa };
      } catch {
        return res.status(400).json({ error: 'La depreciación anual debe ser un porcentaje mayor que 0 y hasta 100, con hasta dos decimales' });
      }
    }
    if (settings.inventory && typeof settings.inventory === 'object' && Object.hasOwn(settings.inventory, 'garantiaPredeterminada')) {
      const anios = normalizarAniosGarantia(settings.inventory.garantiaPredeterminada);
      if (anios === null) {
        return res.status(400).json({ error: 'La garantía predeterminada debe ser un número entero entre 0 y 10 años' });
      }
      settings.inventory = { ...settings.inventory, garantiaPredeterminada: anios };
    }

    await sql.begin(async (transaction) => {
      // Serializa los guardados para leer el valor anterior también en las primeras altas.
      await transaction`SELECT pg_advisory_xact_lock(hashtext('sca:configuracion'))`;
      const anteriores = {};
      const nuevos = {};
      for (const clave of Object.keys(DEFAULT_SETTINGS)) {
        const valor = settings[clave];
        if (!valor || typeof valor !== 'object' || Array.isArray(valor) || !Object.keys(valor).length) continue;
        const [row] = await transaction`SELECT valor FROM configuracion_sistema WHERE clave = ${clave}`;
        const previous = mergeSectionSettings(clave, row?.valor);
        for (const [key, value] of Object.entries(valor)) {
          if (!Object.hasOwn(DEFAULT_SETTINGS[clave], key) || isDeepStrictEqual(previous[key], value)) continue;
          const field = clave + '.' + key;
          anteriores[field] = valorAuditable(field, previous[key]);
          nuevos[field] = valorAuditable(field, value);
        }
        await transaction`
          INSERT INTO configuracion_sistema (clave, valor, actualizado_por, updated_at)
          VALUES (${clave}, ${transaction.json(valor)}, ${operatorId}, CURRENT_TIMESTAMP)
          ON CONFLICT (clave) DO UPDATE
          SET valor = configuracion_sistema.valor || EXCLUDED.valor,
            actualizado_por = EXCLUDED.actualizado_por, updated_at = CURRENT_TIMESTAMP
          WHERE configuracion_sistema.valor IS DISTINCT FROM configuracion_sistema.valor || EXCLUDED.valor
        `;
      }
      if (catalogs && typeof catalogs === 'object') {
        for (const categoria of Object.keys(DEFAULT_CATALOGS)) {
          const values = catalogs[categoria];
          if (!Array.isArray(values)) continue;
          const cleanValues = [...new Set(values.map((entry) => typeof entry === 'string' ? entry.trim() : entry?.valor)
            .filter((value) => typeof value === 'string' && value.trim()))];
          const rows = await transaction`
            SELECT valor, activo FROM catalogos_sistema WHERE categoria = ${categoria} ORDER BY orden, valor
          `;
          const previous = valoresCatalogo(categoria, rows);
          const activeByValue = new Map(rows.map(({ valor, activo }) => [valor, activo]));
          const next = valoresCatalogo(categoria, cleanValues.map((valor) => ({ valor, activo: activeByValue.get(valor) ?? true })));
          if (!isDeepStrictEqual(previous, next)) {
            anteriores['catalogs.' + categoria] = previous;
            nuevos['catalogs.' + categoria] = next;
          }
          await transaction`
            DELETE FROM catalogos_sistema
            WHERE categoria = ${categoria} AND NOT (valor = ANY(${transaction.array(cleanValues)}::text[]))
          `;
          for (const [orden, valor] of cleanValues.entries()) {
            await transaction`
              INSERT INTO catalogos_sistema (categoria, valor, orden)
              VALUES (${categoria}, ${valor}, ${orden})
              ON CONFLICT (categoria, valor) DO UPDATE SET orden = EXCLUDED.orden
                WHERE catalogos_sistema.orden IS DISTINCT FROM EXCLUDED.orden
            `;
          }
        }
      }
      if (Object.keys(nuevos).length > 0) {
        await transaction`
          INSERT INTO audit_log (usuario_id, tabla_afectada, operacion, datos_anteriores, datos_nuevos, created_at)
          VALUES (${operatorId}, 'configuracion_sistema', 'UPDATE', ${transaction.json(anteriores)}, ${transaction.json(nuevos)}, clock_timestamp())
        `;
      }
    });
    res.json({ message: 'Configuración guardada correctamente' });
  } catch (error) {
    console.error('Error al guardar configuración:', error);
    res.status(500).json({ error: 'No se pudo guardar la configuración' });
  }
};
