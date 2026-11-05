import Select from './Select';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import apiClient from '../services/api';
import { IconoTI } from './SolicitudTIUI';
import { actividadDashboard, categoriaBien, contarVinculosPendientes, estadoDashboard, fechaLimaDashboard, resumirInventario } from '../utils/dashboard';

const money = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 2 });
const number = new Intl.NumberFormat('es-PE');
const percent = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 });
const clock = (value) => new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' }).format(value);
const dateTime = (value) => new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(value);
const SOURCES = [
  { key: 'bienes', url: '/bienes', label: 'inventario' },
  { key: 'solicitudes', url: '/gestion-ti/solicitudes', label: 'solicitudes TI' },
  { key: 'pedidos', url: '/gestion-ti/pedidos', label: 'pedidos' },
  { key: 'personal', url: '/personal', label: 'vínculos del personal' },
  { key: 'movimientos', url: '/movimientos', label: 'movimientos' },
  { key: 'health', url: '/health', label: 'conexión con la API' },
];
const initialSources = () => Object.fromEntries(SOURCES.map(({ key }) => [key, { status: 'loading', data: null, updatedAt: null }]));
const cx = (...values) => values.filter(Boolean).join(' ');
const card = 'min-w-0 rounded-2xl border border-slate-200 bg-white';
const secondary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-base font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:opacity-50';
const primary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-base font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100';
const selectClass = 'min-h-10 min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-600 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50';

function Icon({ name, className = 'h-5 w-5' }) {
  const paths = {
    actualizar: <><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" /></>,
    inventario: <><path d="m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10M7 4.7l9 5" /></>,
    mantenimiento: <><path d="M14 6a5 5 0 0 0-6 6L2 18l4 4 6-6a5 5 0 0 0 6-6l-4 4-4-4 4-4Z" /></>,
    dinero: <><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M6 12h.01M18 12h.01" /></>,
    reporte: <><path d="M4 3v18h17M8 15v-4M13 15V7M18 15v-7" /></>,
    alerta: <><path d="m12 3 10 18H2L12 3ZM12 9v5M12 17h.01" /></>,
    pedido: <><path d="m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10" /></>,
    enlace: <path d="M7 17 17 7M7 7h10v10" />,
  };
  if (!paths[name]) return <IconoTI name={name} className={className} />;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>{paths[name]}</svg>;
}

function Badge({ state }) {
  return <span className={cx('inline-flex shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold',
    ['aprobado', 'atendida', 'cerrada', 'recepcionado', 'ejecutado'].includes(state) ? 'bg-emerald-50 text-emerald-700'
      : ['pendiente', 'en_almacen', 'observada', 'solicitado'].includes(state) ? 'bg-amber-50 text-amber-800'
        : ['rechazada', 'rechazado'].includes(state) ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700')}>{estadoDashboard(state)}</span>;
}

function Empty({ icon = 'equipo', title, description }) {
  return <div className="flex min-h-52 flex-col items-center justify-center px-5 py-8 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-600"><Icon name={icon} className="h-6 w-6" /></span>
    <p className="mt-4 text-base font-semibold text-slate-800">{title}</p>
    <p className="mt-2 max-w-xs text-base leading-5 text-slate-600">{description}</p>
  </div>;
}

function Distribution({ summary }) {
  let offset = 0;
  return <div className="flex flex-wrap items-center justify-center gap-6 px-5 pb-6 pt-2 sm:px-6">
    <div className="relative h-44 w-44 shrink-0">
      <svg viewBox="0 0 120 120" role="img" aria-label={'Distribución: ' + summary.estados.map((e) => e.label + ' ' + e.count).join(', ')} className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r="48" fill="none" stroke="#f1f5f9" strokeWidth="13" />
        {summary.estados.filter((e) => e.count).map((e) => {
          const start = offset; offset += e.percent;
          return <circle key={e.key} cx="60" cy="60" r="48" fill="none" stroke={e.color} strokeWidth="13" pathLength="100"
            strokeDasharray={e.percent + ' ' + (100 - e.percent)} strokeDashoffset={-start} />;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-4xl font-semibold tracking-tight text-slate-950">{number.format(summary.total)}</span><span className="mt-1 text-base text-slate-600">bienes</span></div>
    </div>
    <ul className="min-w-0 flex-1 basis-[250px] space-y-3">{summary.estados.filter((e) => e.key !== 'otros' || e.count).map((e) =>
      <li key={e.key} className="flex items-center justify-between gap-3 text-base">
        <span className="flex min-w-0 flex-1 items-center gap-2 text-slate-700"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: e.color }} /><span className="min-w-0 break-words">{e.label}</span></span>
        <span className="flex shrink-0 items-center gap-2"><span className="font-semibold text-slate-900">{number.format(e.count)}</span><span className="w-14 text-right text-base text-slate-600">{percent.format(e.percent)}%</span></span>
      </li>)}</ul>
  </div>;
}

export default function Dashboard({ currentUser, onNavigate = () => {}, onInventoryLoaded }) {
  const [sources, setSources] = useState(initialSources);
  const [refreshing, setRefreshing] = useState(true);
  const [category, setCategory] = useState('');
  const [period, setPeriod] = useState('30');
  const requestRef = useRef({ sequence: 0, controller: null });

  const refresh = useCallback(async () => {
    const sequence = ++requestRef.current.sequence;
    requestRef.current.controller?.abort();
    const controller = new AbortController(); requestRef.current.controller = controller;
    setRefreshing(true);
    setSources((previous) => Object.fromEntries(SOURCES.map(({ key }) => [key, { ...previous[key], status: 'loading' }])));
    await Promise.allSettled(SOURCES.map(async ({ key, url }) => {
      try {
        const response = await apiClient.get(url, { signal: controller.signal, timeout: 15000 });
        if (key === 'health' ? response.data?.status !== 'OK' : !Array.isArray(response.data)) throw new Error('Respuesta no válida');
        if (controller.signal.aborted || sequence !== requestRef.current.sequence) return;
        setSources((previous) => ({ ...previous, [key]: { status: 'ready', data: response.data, updatedAt: new Date() } }));
        if (key === 'bienes') onInventoryLoaded?.(response.data);
      } catch (error) {
        if (controller.signal.aborted || sequence !== requestRef.current.sequence) return;
        setSources((previous) => ({ ...previous, [key]: { ...previous[key], status: 'error', message: error.response?.status === 403 ? 'Sin acceso con esta cuenta' : 'No se pudo actualizar' } }));
      }
    }));
    if (!controller.signal.aborted && sequence === requestRef.current.sequence) setRefreshing(false);
  }, [currentUser?.id, currentUser?.rol, onInventoryLoaded]);

  useEffect(() => {
    void refresh();
    return () => { requestRef.current.sequence++; requestRef.current.controller?.abort(); };
  }, [refresh]);

  const inventory = sources.bienes.data;
  const allSummary = useMemo(() => inventory === null ? null : resumirInventario(inventory), [inventory]);
  const filtered = useMemo(() => inventory === null ? null : category ? inventory.filter((b) => categoriaBien(b) === category) : inventory, [inventory, category]);
  const summary = useMemo(() => filtered === null ? null : resumirInventario(filtered), [filtered]);
  useEffect(() => {
    if (allSummary && category && !allSummary.categorias.some((item) => item.key === category)) setCategory('');
  }, [allSummary, category]);
  const errors = SOURCES.filter(({ key }) => sources[key].status === 'error');
  const today = fechaLimaDashboard();
  const isBoss = ['administrador', 'jefatura'].includes(currentUser?.rol);
  const count = (key, predicate) => sources[key].data === null ? null : sources[key].data.filter(predicate).length;
  const pending = [
    { key: 'solicitudes', label: isBoss ? 'Solicitudes por atender' : 'Mis solicitudes por atender', icon: 'documento', view: 'solicitudes_ti',
      value: count('solicitudes', (s) => ['recibida', 'asignada', 'en_atencion'].includes(s.estado)), hint: 'Recibidas, asignadas o en atención' },
    { key: 'pedidos', label: 'Pedidos por recepcionar', icon: 'pedido', view: 'almacen_ti', value: count('pedidos', (p) => p.estado === 'en_almacen'), hint: 'Equipos que ya llegaron al almacén' },
    { key: 'personal', label: 'Vínculos por regularizar', icon: 'personas', view: 'personal',
      value: sources.personal.data === null ? null : contarVinculosPendientes(sources.personal.data, today), hint: 'Personal activo CAS/CAP sin vínculo vigente' },
    { key: 'movimientos', label: 'Movimientos pendientes', icon: 'cambio', view: 'movimientos',
      value: count('movimientos', (m) => m.estado === 'pendiente'), hint: 'Pendientes de autorización' },
  ];
  const events = useMemo(() => actividadDashboard({
    movimientos: sources.movimientos.data || [], solicitudes: sources.solicitudes.data || [], pedidos: sources.pedidos.data || [],
  }), [sources.movimientos.data, sources.solicitudes.data, sources.pedidos.data]);
  const visibleEvents = events.filter((row) => !Number(period) || row.time >= Date.now() - Number(period) * 86400000).slice(0, 6);
  const activitySources = ['movimientos', 'solicitudes', 'pedidos'];
  const noActivityData = activitySources.every((key) => sources[key].data === null);
  const partialActivity = activitySources.some((key) => sources[key].status === 'error');
  const atLimit = ['solicitudes', 'pedidos'].some((key) => sources[key].data?.length >= 500);
  const totalPending = pending.reduce((sum, row) => sum + (row.value || 0), 0);
  const pendingComplete = pending.every((item) => sources[item.key].status === 'ready');
  const countState = (key) => summary?.estados.find((e) => e.key === key)?.count;
  const categoryRows = summary?.categorias.slice(0, 5) || [];
  if (summary && summary.categorias.length > 5) categoryRows.push({ key: 'resto', label: 'Otras categorías', count: summary.categorias.slice(5).reduce((sum, c) => sum + c.count, 0) });
  const cards = [
    { key: 'total', label: 'Total de bienes', value: summary?.total, icon: 'inventario', tone: 'bg-blue-50 text-blue-600', hint: 'Inventario registrado' },
    { key: 'disponibles', label: 'Disponibles', value: countState('activo'), icon: 'check', tone: 'bg-emerald-50 text-emerald-600', hint: 'Listos para asignar' },
    { key: 'asignados', label: 'Asignados', value: countState('asignado'), icon: 'equipo', tone: 'bg-indigo-50 text-indigo-600', hint: 'Entregados a responsables' },
    { key: 'mantenimiento', label: 'En mantenimiento', value: countState('mantenimiento'), icon: 'mantenimiento', tone: 'bg-amber-50 text-amber-600', hint: 'Revisión o reparación' },
    { key: 'costo', label: 'Costo de adquisición', value: summary?.costo, icon: 'dinero', tone: 'bg-slate-100 text-slate-600', hint: 'Importe registrado, sin depreciación' },
  ];
  const inventoryEmpty = sources.bienes.status === 'error' ? 'No se pudo consultar el inventario' : 'Cargando inventario';

  return <div data-dashboard-screen className="space-y-5">
    <header className="flex flex-col justify-between gap-4 py-1 sm:flex-row sm:items-start">
      <div><p className="text-base font-semibold uppercase tracking-[0.2em] text-blue-600">Control de activos · SCA-TC</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Resumen ejecutivo</h1>
        <p className="mt-2 text-base leading-6 text-slate-600">Inventario, atención de TI y pendientes en un solo lugar.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={refresh} disabled={refreshing} className={secondary}><Icon name="actualizar" className={cx('h-4 w-4', refreshing && 'animate-spin')} />{refreshing ? 'Actualizando…' : 'Actualizar'}</button>
        <button type="button" onClick={() => onNavigate('reportes')} className={primary}><Icon name="reporte" className="h-4 w-4" />Ver reportes</button></div>
    </header>

    {errors.length > 0 && <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-base leading-6 text-amber-900">
      <Icon name="alerta" className="mt-0.5 h-4 w-4" /><p>No se pudo actualizar: {errors.map((e) => e.label).join(', ')}. {errors.some(({ key }) => sources[key].data !== null) ? 'Se conservan los últimos datos consultados; vuelve a actualizar.' : 'Las consultas no disponibles se muestran con un guion.'}</p>
    </div>}

    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div className="flex flex-wrap items-center gap-2 text-base text-slate-600"><span className="font-semibold text-slate-700">Vista del inventario</span><span className="text-slate-300">/</span><span>{category ? allSummary?.categorias.find((c) => c.key === category)?.label : 'Todas las categorías'}</span>
        {sources.bienes.updatedAt && <span className="text-slate-600">· Consulta a las {clock(sources.bienes.updatedAt)}</span>}</div>
      <label className="flex min-w-0 items-center gap-2 text-base text-slate-600"><span className="shrink-0">Categoría</span><Select aria-label="Filtrar inventario por categoría" value={category} onChange={(event) => setCategory(event.target.value)} className={cx(selectClass, 'w-full sm:w-60')}>
        <option value="">Todas las categorías</option>{allSummary?.categorias.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</Select></label>
    </div>

    <section aria-label="Indicadores del inventario" className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5">
      {cards.map((item) => <article key={item.key} data-dashboard-kpi={item.key} aria-busy={sources.bienes.status === 'loading'} className={cx(card, 'p-4 sm:p-5', item.key === 'costo' && 'col-span-2 lg:col-span-2 2xl:col-span-1')}>
        <div className="flex items-center justify-between gap-2"><span className={cx('flex h-10 w-10 items-center justify-center rounded-xl', item.tone)}><Icon name={item.icon} /></span>
          {item.key !== 'costo' && <button type="button" aria-label={'Abrir inventario: ' + item.label} onClick={() => onNavigate('inventario')} className="rounded-lg p-2 text-slate-600 transition hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"><Icon name="enlace" className="h-4 w-4" /></button>}
        </div>
        <h2 className="mt-4 break-words text-base font-semibold text-slate-700">{item.label}</h2>
        <p className={cx('mt-1.5 break-words font-semibold tracking-tight text-slate-950 tabular-nums', item.key === 'costo' ? 'text-3xl' : 'text-4xl')}>{item.value === undefined || item.value === null ? '—' : item.key === 'costo' ? money.format(item.value) : number.format(item.value)}</p>
        <p className="mt-2 text-sm leading-5 text-slate-600">{item.hint}</p>
      </article>)}
    </section>
    {summary && <p className="px-1 text-sm leading-5 text-slate-600">El costo incluye los bienes dados de baja y no representa su valor depreciado.{summary.sinCosto > 0 ? ' ' + summary.sinCosto + ' bienes sin costo válido no se incluyen en el importe.' : ''}</p>}

    <div className="grid gap-5 xl:grid-cols-2">
      <section className={card} aria-labelledby="dashboard-distribution-title">
        <div className="flex flex-wrap items-start justify-between gap-3 p-5 sm:p-6"><div><h2 id="dashboard-distribution-title" className="text-xl font-semibold text-slate-900">Estado del inventario</h2><p className="mt-1 text-base leading-5 text-slate-600">Distribución actual de los bienes registrados.</p></div><span className="rounded-full bg-slate-50 px-3 py-1 text-base font-medium text-slate-600">{summary ? number.format(summary.total) + ' bienes' : '—'}</span></div>
        {summary?.total ? <Distribution summary={summary} /> : <Empty title={summary ? 'Aún no hay bienes en esta vista' : inventoryEmpty} description={summary ? 'Los estados aparecerán cuando existan equipos registrados para esta categoría.' : 'Los indicadores se completan al consultar el inventario.'} />}
      </section>
      <section className={card} aria-labelledby="dashboard-categories-title">
        <div className="p-5 pb-3 sm:p-6 sm:pb-3"><h2 id="dashboard-categories-title" className="text-xl font-semibold text-slate-900">Equipos por categoría</h2><p className="mt-1 text-base leading-5 text-slate-600">Cantidad y participación en la vista seleccionada.</p></div>
        {summary?.total ? <div className="space-y-4 px-5 pb-6 pt-2 sm:px-6">{categoryRows.map((c, index) => <div key={c.key}>
          <div className="mb-2 flex items-center justify-between gap-3 text-base"><span className="min-w-0 flex-1 break-words font-medium text-slate-600">{c.label}</span><span className="shrink-0 tabular-nums text-slate-600"><strong className="font-semibold text-slate-900">{number.format(c.count)}</strong> · {percent.format(c.count / summary.total * 100)}%</span></div>
          <div role="meter" aria-label={c.label} aria-valuenow={c.count} aria-valuemin={0} aria-valuemax={summary.total} className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={cx('h-full rounded-full', index === 0 ? 'bg-blue-600' : index === 1 ? 'bg-blue-400' : index === 2 ? 'bg-indigo-400' : 'bg-slate-300')} style={{ width: c.count / summary.total * 100 + '%' }} /></div>
        </div>)}</div> : <Empty icon="reporte" title={summary ? 'Sin categorías para mostrar' : inventoryEmpty} description="La distribución se genera a partir del tipo registrado de cada equipo." />}
      </section>
    </div>

    <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <section className={card} aria-labelledby="dashboard-pending-title">
        <div className="flex items-start justify-between gap-3 p-5 pb-4 sm:p-6 sm:pb-4"><div><h2 id="dashboard-pending-title" className="text-xl font-semibold text-slate-900">Requiere atención</h2><p className="mt-1 text-base leading-5 text-slate-600">Pendientes visibles para tu usuario.</p></div><span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', totalPending ? 'bg-amber-50 text-amber-600' : pendingComplete ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-600')}><Icon name={totalPending ? 'alerta' : pendingComplete ? 'check' : 'reloj'} className="h-4 w-4" /></span></div>
        <div className="space-y-2 px-5 pb-5 sm:px-6">{pending.map((item) => <button key={item.key} type="button" data-dashboard-pending={item.key} onClick={() => onNavigate(item.view)} className="group flex w-full items-center gap-3 rounded-xl border border-slate-100 px-3 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">
          <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', item.value ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600')}><Icon name={item.icon} className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="block text-base font-semibold text-slate-700">{item.label}</span><span className="mt-1 block text-sm leading-5 text-slate-600">{sources[item.key].status === 'error' ? sources[item.key].message + (item.value !== null ? ' · dato anterior' : '') : item.hint}</span></span>
          <span className="shrink-0 text-2xl font-semibold tabular-nums text-slate-900">{item.value === null ? '—' : number.format(item.value)}</span><Icon name="flecha" className="h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-blue-500" />
        </button>)}</div>
        <p className="border-t border-slate-100 px-5 py-3 text-sm leading-5 text-slate-600 sm:px-6">{atLimit ? 'Solicitudes y pedidos: hasta los últimos 500 registros visibles. Los pendientes pueden ser mayores.' : 'Los pendientes son generales y no cambian con el filtro de categoría.'}</p>
      </section>

      <section className={card} aria-labelledby="dashboard-activity-title">
        <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-4 sm:p-6 sm:pb-4"><div><h2 id="dashboard-activity-title" className="text-xl font-semibold text-slate-900">Actividad reciente</h2><p className="mt-1 text-base leading-5 text-slate-600">Última actualización de solicitudes, pedidos y movimientos.</p></div>
          <Select aria-label="Período de actividad reciente" value={period} onChange={(event) => setPeriod(event.target.value)} className={cx(selectClass, 'text-base')}><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="0">Todo lo consultado</option></Select></div>
        {visibleEvents.length ? <ol className="divide-y divide-slate-100 px-5 sm:px-6">{visibleEvents.map((row) => <li key={row.id}><button type="button" onClick={() => onNavigate(row.view, row.entityId)} className="group flex w-full items-start gap-3 py-3.5 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-blue-100">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon name={row.icon} className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="block break-words text-base font-semibold text-slate-900 group-hover:text-blue-700">{row.title}</span><span className="mt-1 block truncate text-sm text-slate-600">{row.detail || 'Registro patrimonial'}</span>
            <time dateTime={new Date(row.time).toISOString()} className="mt-1.5 block text-sm text-slate-600">{dateTime(row.time)} · Lima</time></span><Badge state={row.estado} />
        </button></li>)}</ol> : <Empty icon="reloj" title={noActivityData ? refreshing ? 'Cargando actividad' : 'Actividad no disponible' : 'Sin actividad en este período'}
          description={noActivityData ? 'Consulta el estado de conexión y vuelve a actualizar.' : 'Prueba con otro período o vuelve cuando se registren nuevas operaciones.'} />}
        <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 px-5 py-3 text-sm leading-5 text-slate-600 sm:px-6"><span>{partialActivity ? 'Actividad parcial: alguna consulta no está disponible.' : 'Se muestran hasta 6 registros recientes.'}</span><span>El período solo filtra esta actividad.</span></div>
      </section>
    </div>

    <footer className="flex flex-col justify-between gap-2 px-1 pb-1 text-sm leading-5 text-slate-600 sm:flex-row">
      <span className="flex flex-wrap items-center gap-2"><span className={cx('h-1.5 w-1.5 rounded-full', sources.health.status === 'ready' ? 'bg-emerald-500' : sources.health.status === 'error' ? 'bg-amber-500' : 'bg-slate-300')} />
        {sources.health.status === 'ready' ? 'API disponible · comprobada a las ' + clock(sources.health.updatedAt) : sources.health.status === 'error' ? 'No se pudo comprobar la conexión con la API' : 'Comprobando conexión con la API…'}</span>
      <span>Datos visibles según tu rol · Hora de Lima</span>
    </footer>
  </div>;
}
