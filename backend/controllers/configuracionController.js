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
    garantiaPredeterminada: 1,
    depreciacionAnual: 20,
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

const mergeSettings = (saved) => Object.fromEntries(
  Object.entries(DEFAULT_SETTINGS).map(([section, defaults]) => [
    section,
    { ...defaults, ...(saved[section] || {}) },
  ]),
);

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
    res.json({ settings: mergeSettings(saved), catalogs: grouped });
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({ error: 'No se pudo obtener la configuración' });
  }
};

export const saveConfiguracion = async (req, res, sql) => {
  try {
    const settings = req.body?.settings;
    const catalogs = req.body?.catalogs;
    if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'La configuración es inválida' });

    await sql.begin(async (transaction) => {
      for (const [clave, valor] of Object.entries(settings)) {
        if (!Object.hasOwn(DEFAULT_SETTINGS, clave) || !valor || typeof valor !== 'object') continue;
        await transaction`
          INSERT INTO configuracion_sistema (clave, valor, actualizado_por, updated_at)
          VALUES (${clave}, ${transaction.json(valor)}, ${req.user.id}, CURRENT_TIMESTAMP)
          ON CONFLICT (clave) DO UPDATE
          SET valor = EXCLUDED.valor, actualizado_por = EXCLUDED.actualizado_por, updated_at = CURRENT_TIMESTAMP
        `;
      }
      if (catalogs && typeof catalogs === 'object') {
        for (const [categoria, values] of Object.entries(catalogs)) {
          if (!Object.hasOwn(DEFAULT_CATALOGS, categoria) || !Array.isArray(values)) continue;
          await transaction`DELETE FROM catalogos_sistema WHERE categoria = ${categoria}`;
          const cleanValues = values.map((value) => typeof value === 'string' ? value.trim() : value?.valor)
            .filter(Boolean);
          for (const [orden, valor] of cleanValues.entries()) {
            await transaction`
              INSERT INTO catalogos_sistema (categoria, valor, orden)
              VALUES (${categoria}, ${valor}, ${orden})
              ON CONFLICT (categoria, valor) DO UPDATE SET activo = TRUE, orden = EXCLUDED.orden
            `;
          }
        }
      }
    });
    res.json({ message: 'Configuración guardada correctamente' });
  } catch (error) {
    console.error('Error al guardar configuración:', error);
    res.status(500).json({ error: 'No se pudo guardar la configuración' });
  }
};
