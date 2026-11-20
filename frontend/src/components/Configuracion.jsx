import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import Select from './Select';
import * as api from '../services/api';

const tabs = [
  ['institution', 'Institución'],
  ['catalogs', 'Catálogos'],
  ['inventory', 'Inventario'],
  ['assignments', 'Asignaciones'],
  ['bajas', 'Bajas'],
  ['maintenance', 'Mantenimiento'],
  ['reports', 'Reportes'],
  ['notifications', 'Notificaciones'],
  ['audit', 'Auditoría'],
  ['siga', 'Integración SIGA'],
];

const labels = {
  institution: [['nombre', 'Nombre institucional'], ['ruc', 'RUC'], ['direccion', 'Dirección'], ['telefono', 'Teléfono'], ['correo', 'Correo institucional'], ['responsable', 'Responsable del sistema']],
  inventory: [['moneda', 'Moneda'], ['garantiaPredeterminada', 'Garantía predeterminada (años)'], ['depreciacionAnual', 'Depreciación anual (%)']],
  bajas: [['vigenciaUrlHoras', 'Vigencia de enlaces de evidencias (horas)']],
  maintenance: [['alertaDias', 'Alertar mantenimiento con anticipación (días)']],
  reports: [['formatoFecha', 'Formato de fecha'], ['piePagina', 'Pie de página de reportes']],
  audit: [['retencionDias', 'Retención de auditoría (días)']],
  siga: [['ambiente', 'Ambiente'], ['urlServicio', 'URL del servicio SIGA'], ['codigoEntidad', 'Código de entidad'], ['codigoUnidadEjecutora', 'Código de unidad ejecutora'], ['frecuenciaSincronizacion', 'Frecuencia de sincronización'], ['ultimaSincronizacion', 'Última sincronización'], ['resultadoUltimaSincronizacion', 'Resultado de la última sincronización']],
};

const checkLabels = {
  requiereCodigoPatrimonial: 'Requerir código patrimonial',
  requiereNumeroSerie: 'Requerir número de serie',
  requiereActa: 'Requerir acta',
  requiereFirmaResponsable: 'Requerir firma del responsable',
  permiteMultiplesBienes: 'Permitir varios bienes en una asignación',
  requiereFotoFrontal: 'Requerir foto frontal',
  requiereFotoLateral: 'Requerir foto lateral',
  documentoOpcional: 'Permitir que el documento sea opcional',
  requiereCosto: 'Requerir costo de mantenimiento',
  requiereResponsable: 'Requerir responsable de mantenimiento',
  mostrarLogo: 'Mostrar logo en los reportes',
  mostrarFirma: 'Mostrar firma en los reportes',
  mantenimiento: 'Notificar mantenimientos',
  garantia: 'Notificar garantías',
  bienesSinAsignar: 'Notificar bienes sin asignar',
  correoHabilitado: 'Habilitar avisos por correo',
  registrarAccesos: 'Registrar accesos',
  registrarCambios: 'Registrar cambios',
  habilitado: 'Habilitar preparación de integración SIGA',
};

const catalogLabels = {
  sedes: 'Sedes', regimenes_laborales: 'Regímenes laborales', oficinas: 'Oficinas',
  areas: 'Áreas', pisos: 'Pisos', motivos_baja: 'Motivos de baja', tipos_mantenimiento: 'Tipos de mantenimiento',
};

const choices = {
  ambiente: [['pruebas', 'Pruebas'], ['produccion', 'Producción']],
  frecuenciaSincronizacion: [['manual', 'Manual'], ['diaria', 'Diaria'], ['semanal', 'Semanal']],
};

const readonly = new Set(['ultimaSincronizacion', 'resultadoUltimaSincronizacion']);
const pendingSections = new Set(['institution', 'catalogs', 'assignments', 'bajas', 'maintenance', 'reports', 'notifications', 'audit']);
const pendingLabel = 'Pendiente de aplicar';
const help = {
  moneda: pendingLabel,
  garantiaPredeterminada: 'Se propone al registrar un bien y se puede ajustar en el formulario. Usa 0 para bienes sin garantía.',
  depreciacionAnual: 'Se usa al registrar una depreciación sin una tasa propia. Admite hasta dos decimales.',
  urlServicio: 'Ingresa solo la URL del servicio. Las credenciales se administran en el backend.',
};

const catalogText = (catalog) => (catalog || []).map((entry) => typeof entry === 'string' ? entry : entry.valor).join('\n');
const catalogValues = (text) => [...new Set(text.split(/\r?\n/).filter((line) => line.trim()))];
const fieldId = (section, key) => 'config-' + section + '-' + key;

export function configurationAuditLabel(path) {
  const [section, key] = path.split('.');
  if (section === 'catalogs') return 'Catálogos · ' + (catalogLabels[key] || key);
  const title = tabs.find(([id]) => id === section)?.[1];
  const field = labels[section]?.find(([id]) => id === key)?.[1] || checkLabels[key];
  return title && field ? title + ' · ' + field : path;
}

function prepareSettings(settings, drafts) {
  const changes = {};
  for (const [section, fields] of Object.entries(drafts)) {
    for (const [key, input] of Object.entries(fields)) {
      const previous = settings[section]?.[key];
      let value = input;
      if (section === 'inventory' && key === 'depreciacionAnual') {
        const decimal = String(input).trim().replace(',', '.');
        value = Number(decimal);
        if (!/^\d+(?:\.\d{1,2})?$/.test(decimal) || value <= 0 || value > 100) {
          return { error: { section, key, message: 'Ingresa un porcentaje entre 0,01 y 100 con hasta dos decimales.' } };
        }
      } else if (section === 'inventory' && key === 'garantiaPredeterminada') {
        const years = String(input).trim();
        value = Number(years);
        if (!/^\d+$/.test(years) || value > 10) {
          return { error: { section, key, message: 'Ingresa un número entero entre 0 y 10 años.' } };
        }
      } else if (typeof previous === 'number') {
        value = Number(input);
        if (input === '' || !Number.isFinite(value)) {
          return { error: { section, key, message: 'Ingresa un número válido.' } };
        }
      }
      if (!Object.is(previous, value)) {
        changes[section] ??= {};
        changes[section][key] = value;
      }
    }
  }
  return { changes };
}

const Configuracion = forwardRef(function Configuracion(_, ref) {
  const [activeTab, setActiveTab] = useState('institution');
  const [configuration, setConfiguration] = useState(null);
  const [settingsDraft, setSettingsDraft] = useState({});
  const [catalogDraft, setCatalogDraft] = useState({});
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState(null);
  const [success, setSuccess] = useState('');
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const leaveDialog = useRef(null);
  const saveButton = useRef(null);

  useEffect(() => {
    const request = new AbortController();
    api.getConfiguracion(request.signal).then(({ data }) => {
      if (request.signal.aborted) return;
      if (!data?.settings || !data?.catalogs) throw new Error('Respuesta de configuración incompleta');
      setConfiguration(data);
    }).catch((failure) => {
      if (!request.signal.aborted) setError(failure.response?.data?.error || 'No se pudo cargar la configuración.');
    }).finally(() => {
      if (!request.signal.aborted) setLoading(false);
    });
    return () => request.abort();
  }, [loadAttempt]);

  const retryLoad = () => {
    setLoading(true);
    setError('');
    setLoadAttempt((attempt) => attempt + 1);
  };

  const activeLabel = tabs.find(([key]) => key === activeTab)?.[1];
  const currentSection = configuration?.settings[activeTab] || {};
  const currentDraft = settingsDraft[activeTab] || {};
  const settingChanges = configuration ? prepareSettings(configuration.settings, settingsDraft) : { changes: {} };
  const catalogChanges = {};
  for (const [category, text] of Object.entries(catalogDraft)) {
    const values = catalogValues(text);
    const previous = catalogValues(catalogText(configuration.catalogs[category]));
    if (JSON.stringify(values) !== JSON.stringify(previous)) {
      catalogChanges[category] = values.map((valor) => ({ valor }));
    }
  }
  const hasChanges = Boolean(settingChanges.error) || Object.keys(settingChanges.changes || {}).length > 0
    || Object.keys(catalogChanges).length > 0;

  useImperativeHandle(ref, () => ({
    deferLeave(action) {
      if (!hasChanges && !saving) return false;
      setPendingNavigation((current) => current || action);
      return true;
    },
  }), [hasChanges, saving]);

  useEffect(() => {
    if (!hasChanges && !saving) return;
    const confirmUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', confirmUnload);
    return () => window.removeEventListener('beforeunload', confirmUnload);
  }, [hasChanges, saving]);

  useLayoutEffect(() => {
    const dialog = leaveDialog.current;
    if (pendingNavigation && !dialog.open) dialog.showModal();
    if (!pendingNavigation && dialog.open) {
      dialog.close();
      if (document.activeElement === document.body) saveButton.current?.focus();
    }
  }, [pendingNavigation]);

  const setValue = (key, value) => {
    setSettingsDraft((previous) => ({
      ...previous, [activeTab]: { ...previous[activeTab], [key]: value },
    }));
    if (fieldError?.section === activeTab && fieldError.key === key) setFieldError(null);
    setSuccess('');
  };

  const saveChanges = async () => {
    if (!configuration || loading || saving) return false;
    if (!hasChanges) return true;
    if (settingChanges.error) {
      const invalid = settingChanges.error;
      setPendingNavigation(null);
      setFieldError(invalid);
      setActiveTab(invalid.section);
      requestAnimationFrame(() => document.getElementById(fieldId(invalid.section, invalid.key))?.focus());
      return false;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.saveConfiguracion({ settings: settingChanges.changes, catalogs: catalogChanges });
      const settings = { ...configuration.settings };
      for (const [section, changes] of Object.entries(settingChanges.changes)) {
        settings[section] = { ...settings[section], ...changes };
      }
      setConfiguration({ settings, catalogs: { ...configuration.catalogs, ...catalogChanges } });
      setSettingsDraft({});
      setCatalogDraft({});
      setSuccess('Configuración guardada correctamente.');
      return true;
    } catch (failure) {
      setError(failure.response?.data?.error || 'No se pudo guardar la configuración. Inténtalo de nuevo.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const save = (event) => {
    event.preventDefault();
    void saveChanges();
  };

  const exit = () => {
    setPendingNavigation(null);
    pendingNavigation?.();
  };

  const saveAndExit = async () => {
    if (await saveChanges()) exit();
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="sca-page-title">Configuración del sistema</h1>
          <p className="mt-1 sca-description">Administra los parámetros del sistema y sus catálogos.</p>
        </div>
        <button ref={saveButton} type="submit" disabled={!configuration || loading || saving || !hasChanges} className="ml-auto sca-button sca-button-primary">
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </header>

      {loading && <p role="status" className="sca-description">Cargando configuración…</p>}
      {error && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        <p role="alert">{error}</p>
        {!configuration && <button type="button" className="sca-button" onClick={retryLoad}>Reintentar</button>}
      </div>}
      {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}

      {configuration && <fieldset disabled={saving} className="grid min-w-0 gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <div className="min-w-0 lg:hidden">
          <label htmlFor="config-section" className="mb-2 block sca-field-label">Sección</label>
          <Select id="config-section" className="w-full" value={activeTab} onChange={(event) => setActiveTab(event.target.value)}>
            {tabs.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </Select>
        </div>
        <nav aria-label="Secciones de configuración" className="hidden self-start space-y-1 rounded-xl border border-slate-200 bg-white p-2 lg:block">
          {tabs.map(([key, label]) => (
            <button type="button" key={key} onClick={() => setActiveTab(key)} aria-current={activeTab === key ? 'true' : undefined}
              className={'block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ' + (activeTab === key ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50')}>
              {label}
            </button>
          ))}
        </nav>

        <section aria-labelledby="config-tab-title" className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 id="config-tab-title" className="sca-section-title">{activeLabel}</h2>
          {pendingSections.has(activeTab) && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <strong>{pendingLabel}.</strong>{' '}
            {activeTab === 'notifications'
              ? 'Estos ajustes se guardan para uso futuro. El servidor controla actualmente el envío de correo mediante SMTP.'
              : 'Estos ajustes se guardan para cuando estén conectados con sus módulos.'}
          </p>}
          {activeTab === 'siga' && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Integración en preparación.</strong> La sincronización se habilitará cuando esté disponible la API oficial del SIGA.
          </p>}
          {activeTab === 'catalogs' ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {Object.entries(catalogLabels).map(([category, label]) => (
                <label key={category} className="block min-w-0 sca-field-label">
                  {label}
                  <textarea rows="5" className="mt-2 block font-normal sca-field" placeholder="Un valor por línea"
                    value={catalogDraft[category] ?? catalogText(configuration.catalogs[category])}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCatalogDraft((previous) => ({ ...previous, [category]: value }));
                      setSuccess('');
                    }} />
                </label>
              ))}
            </div>
          ) : <div className="mt-4 grid gap-4 md:grid-cols-2">
            {(labels[activeTab] || []).map(([key, label]) => {
              const id = fieldId(activeTab, key);
              const value = currentDraft[key] ?? currentSection[key] ?? '';
              const isDepreciation = key === 'depreciacionAnual';
              const isWarranty = key === 'garantiaPredeterminada';
              const numeric = !isDepreciation && !isWarranty && typeof currentSection[key] === 'number';
              const invalid = fieldError?.section === activeTab && fieldError.key === key ? fieldError.message : '';
              return <div key={key} className="min-w-0">
                <label htmlFor={id} className="mb-2 block sca-field-label">{label}</label>
                {choices[key] ? <Select id={id} className="w-full" value={value} onChange={(event) => setValue(key, event.target.value)}>
                  {choices[key].map(([option, text]) => <option key={option} value={option}>{text}</option>)}
                </Select> : <input id={id} className="sca-field read-only:bg-slate-50" value={value}
                  type={numeric ? 'number' : 'text'} step={numeric ? 'any' : undefined}
                  inputMode={isDepreciation ? 'decimal' : isWarranty ? 'numeric' : undefined} readOnly={readonly.has(key)}
                  aria-invalid={Boolean(invalid)} aria-describedby={[help[key] && id + '-help', invalid && id + '-error'].filter(Boolean).join(' ') || undefined}
                  onChange={(event) => setValue(key, event.target.value)} />}
                {help[key] && <p id={id + '-help'} className="mt-2 sca-muted">{help[key]}</p>}
                {invalid && <p id={id + '-error'} role="alert" className="mt-2 text-sm text-rose-800">{invalid}</p>}
              </div>;
            })}
            {Object.entries(currentSection).filter(([, value]) => typeof value === 'boolean').map(([key, value]) => (
              <label key={key} className="flex min-h-11 items-center gap-3 text-sm text-slate-700 md:col-span-2">
                <input type="checkbox" checked={currentDraft[key] ?? value} onChange={(event) => setValue(key, event.target.checked)}
                  className="h-4 w-4 shrink-0 accent-blue-700" />
                <span>
                  {checkLabels[key] || key}
                  {activeTab === 'inventory' && <span className="block sca-muted">{pendingLabel}</span>}
                </span>
              </label>
            ))}
          </div>}
        </section>
      </fieldset>}

      <dialog ref={leaveDialog} aria-labelledby="config-leave-title" aria-describedby="config-leave-description"
        className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-xl rounded-2xl bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-950/50 sm:p-6"
        onCancel={(event) => {
          event.preventDefault();
          if (!saving) setPendingNavigation(null);
        }}>
        <h2 id="config-leave-title" className="sca-section-title">Cambios sin guardar</h2>
        <p id="config-leave-description" className="mt-2 sca-description">Puedes guardar tus cambios antes de salir de Configuración o descartarlos.</p>
        {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <button type="button" className="sca-button" disabled={saving} onClick={() => setPendingNavigation(null)}>Seguir editando</button>
          <button type="button" className="sca-button text-rose-700" disabled={saving} onClick={exit}>Descartar cambios</button>
          <button type="button" className="sca-button sca-button-primary" disabled={saving} onClick={saveAndExit}>
            {saving ? 'Guardando…' : 'Guardar y salir'}
          </button>
        </div>
      </dialog>
    </form>
  );
});

export default Configuracion;
