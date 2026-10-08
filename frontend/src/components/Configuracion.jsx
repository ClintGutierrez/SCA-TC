import { useEffect, useMemo, useState } from 'react';
import * as api from '../services/api';

const tabs = [
  ['institution', 'Institución', '🏛️'],
  ['catalogs', 'Catálogos', '🗂️'],
  ['inventory', 'Inventario', '💻'],
  ['assignments', 'Asignaciones', '📦'],
  ['bajas', 'Bajas', '📤'],
  ['maintenance', 'Mantenimiento', '🔧'],
  ['reports', 'Reportes', '📊'],
  ['notifications', 'Notificaciones', '🔔'],
  ['audit', 'Auditoría', '🛡️'],
  ['siga', 'Integración SIGA', '🔗'],
];

const defaults = {
  institution: { nombre: '', ruc: '', direccion: '', telefono: '', correo: '', responsable: '' },
  inventory: { moneda: 'PEN', garantiaPredeterminada: 1, depreciacionAnual: 20, requiereCodigoPatrimonial: true, requiereNumeroSerie: false },
  assignments: { requiereActa: true, requiereFirmaResponsable: true, permiteMultiplesBienes: true },
  bajas: { requiereFotoFrontal: true, requiereFotoLateral: true, documentoOpcional: true, vigenciaUrlHoras: 1 },
  maintenance: { requiereCosto: false, requiereResponsable: true, alertaDias: 30 },
  reports: { mostrarLogo: true, mostrarFirma: true, formatoFecha: 'DD/MM/YYYY', piePagina: '' },
  notifications: { mantenimiento: true, garantia: true, bienesSinAsignar: false, correoHabilitado: false },
  audit: { retencionDias: 365, registrarAccesos: true, registrarCambios: true },
  siga: { habilitado: false, ambiente: 'pruebas', urlServicio: '', codigoEntidad: '', codigoUnidadEjecutora: '', frecuenciaSincronizacion: 'manual', ultimaSincronizacion: '', resultadoUltimaSincronizacion: 'No configurada' },
};

const labels = {
  institution: [['nombre', 'Nombre institucional'], ['ruc', 'RUC'], ['direccion', 'Dirección'], ['telefono', 'Teléfono'], ['correo', 'Correo institucional'], ['responsable', 'Responsable del sistema']],
  inventory: [['moneda', 'Moneda'], ['garantiaPredeterminada', 'Garantía predeterminada (años)'], ['depreciacionAnual', 'Depreciación anual (%)']],
  assignments: [], bajas: [['vigenciaUrlHoras', 'Vigencia de enlaces de evidencias (horas)']], maintenance: [['alertaDias', 'Alertar mantenimiento con anticipación (días)']],
  reports: [['formatoFecha', 'Formato de fecha'], ['piePagina', 'Pie de página de reportes']],
  notifications: [], audit: [['retencionDias', 'Retención de auditoría (días)']],
  siga: [['ambiente', 'Ambiente'], ['urlServicio', 'URL del servicio SIGA'], ['codigoEntidad', 'Código de entidad'], ['codigoUnidadEjecutora', 'Código de unidad ejecutora'], ['frecuenciaSincronizacion', 'Frecuencia de sincronización'], ['ultimaSincronizacion', 'Última sincronización'], ['resultadoUltimaSincronizacion', 'Resultado de la última sincronización']],
};

const catalogLabels = {
  sedes: 'Sedes', regimenes_laborales: 'Regímenes laborales', oficinas: 'Oficinas',
  areas: 'Áreas', pisos: 'Pisos', motivos_baja: 'Motivos de baja', tipos_mantenimiento: 'Tipos de mantenimiento',
};

export default function Configuracion() {
  const [activeTab, setActiveTab] = useState('institution');
  const [settings, setSettings] = useState(defaults);
  const [catalogs, setCatalogs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getConfiguracion();
      setSettings(response.data.settings);
      setCatalogs(response.data.catalogs);
    } catch (loadError) {
      setError(loadError?.response?.data?.error || 'No se pudo cargar la configuración');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const setValue = (section, key, value) => setSettings((previous) => ({
    ...previous, [section]: { ...previous[section], [key]: value },
  }));
  const save = async (event) => {
    event.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      await api.saveConfiguracion({ settings, catalogs });
      setSuccess('Configuración guardada correctamente');
    } catch (saveError) {
      setError(saveError?.response?.data?.error || 'No se pudo guardar la configuración');
    } finally { setSaving(false); }
  };
  const updateCatalog = (category, value) => setCatalogs((previous) => ({ ...previous, [category]: value.split('\n').map((item, index) => ({ id: null, categoria: category, valor: item, activo: true, orden: index })) }));
  const activeLabel = useMemo(() => tabs.find(([key]) => key === activeTab)?.[1], [activeTab]);

  if (loading) return <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center text-slate-500">Cargando configuración...</div>;

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">Administración</p><h2 className="mt-2 text-2xl font-semibold text-slate-950">Configuración del sistema</h2><p className="mt-1 text-sm text-slate-500">Los cambios se guardan en Supabase y se aplican a los módulos correspondientes.</p></div>
          <button type="submit" disabled={saving} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar cambios'}</button>
        </div>
      </div>
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
          {tabs.map(([key, label, icon]) => <button type="button" key={key} onClick={() => setActiveTab(key)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold ${activeTab === key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><span>{icon}</span>{label}</button>)}
        </nav>
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-950">{activeLabel}</h3>
          {activeTab === 'catalogs' ? <div className="mt-5 grid gap-5 md:grid-cols-2">{Object.entries(catalogLabels).map(([category, label]) => <label key={category} className="block"><span className="text-sm font-medium text-slate-700">{label}</span><textarea rows="5" value={(catalogs[category] || []).map((item) => item.valor || item).join('\n')} onChange={(event) => updateCatalog(category, event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-300 focus:bg-white" placeholder="Un valor por línea" /></label>)}</div> : <div className="mt-5 grid gap-5 md:grid-cols-2">{(labels[activeTab] || []).map(([key, label]) => <label key={key} className="block"><span className="text-sm font-medium text-slate-700">{label}</span>{key === 'ambiente' ? <select value={settings[activeTab]?.[key] ?? ''} onChange={(event) => setValue(activeTab, key, event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300 focus:bg-white"><option value="pruebas">Pruebas</option><option value="produccion">Producción</option></select> : key === 'frecuenciaSincronizacion' ? <select value={settings[activeTab]?.[key] ?? ''} onChange={(event) => setValue(activeTab, key, event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300 focus:bg-white"><option value="manual">Manual</option><option value="diaria">Diaria</option><option value="semanal">Semanal</option></select> : <input type={typeof settings[activeTab]?.[key] === 'number' ? 'number' : 'text'} value={settings[activeTab]?.[key] ?? ''} onChange={(event) => setValue(activeTab, key, typeof settings[activeTab]?.[key] === 'number' ? Number(event.target.value) : event.target.value)} readOnly={activeTab === 'siga' && ['ultimaSincronizacion', 'resultadoUltimaSincronizacion'].includes(key)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300 focus:bg-white read-only:text-slate-500" />}{activeTab === 'audit' && key === 'retencionDias' && <span className="mt-2 block text-xs leading-5 text-slate-500">Indica durante cuántos días se conservarán los registros de auditoría antes de considerarlos antiguos. Por ejemplo, 365 días equivale a conservar un año de historial. Este valor no elimina registros automáticamente.</span>}{activeTab === 'siga' && key === 'urlServicio' && <span className="mt-2 block text-xs leading-5 text-slate-500">Configura aquí solo la URL y los códigos institucionales. Las credenciales, contraseñas y tokens SIGA deben permanecer en el backend o en un gestor de secretos.</span>}{activeTab === 'siga' && key === 'resultadoUltimaSincronizacion' && <span className="mt-2 block text-xs leading-5 text-slate-500">La sincronización automática se habilitará cuando se disponga de la API oficial y sus permisos institucionales.</span>}</label>)}{activeTab !== 'institution' && <div className="md:col-span-2 space-y-3">{Object.entries(settings[activeTab] || {}).filter(([key]) => typeof settings[activeTab]?.[key] === 'boolean').map(([key, value]) => <label key={key} className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={value} onChange={(event) => setValue(activeTab, key, event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />{key === 'habilitado' && activeTab === 'siga' ? 'Habilitar preparación de integración SIGA' : key.replaceAll(/([A-Z])/g, ' $1')}</label>)}</div>}{activeTab === 'siga' && <div className="md:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800"><strong>Integración en preparación:</strong> esta sección permite registrar los parámetros institucionales y dejar lista la configuración. No realiza conexiones ni sincronizaciones hasta contar con la API oficial del SIGA.</div>}</div>}
        </section>
      </div>
    </form>
  );
}
