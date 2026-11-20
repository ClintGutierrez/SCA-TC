import Select from './Select';
import { useCallback, useEffect, useState } from 'react';
import * as api from '../services/api';
import { estadoTI } from './SeguimientoTI';
import useDetalleBandejaTI from './useDetalleBandejaTI';

const input = 'mt-1 sca-field';
const button = 'sca-button';
const localNow = () => { const date = new Date(); return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16); };
export default function AlmacenTI({ currentUser, initialSolicitudId, focusId, bienes = [], onOpenInventario, onOpenMovimientos }) {
  const [rows,setRows] = useState([]);
  const [people,setPeople] = useState([]);
  const [solicitudes,setSolicitudes] = useState([]);
  const { selection, openDetail, closeDetail, retryDetail, detailSectionRef, detailTitleRef, searchRef } = useDetalleBandejaTI(focusId);
  const [historyResponse, setHistoryResponse] = useState(null);
  const [search,setSearch] = useState('');
  const [filter,setFilter] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [showForm,setShowForm] = useState(Boolean(initialSolicitudId));
  const [form,setForm] = useState({ numero:'',descripcion:'',cantidad:1,solicitudId:initialSolicitudId || '' });
  const [action,setAction] = useState('');
  const [person,setPerson] = useState('');
  const [date,setDate] = useState(localNow);
  const [comment,setComment] = useState('');
  const [conformidad,setConformidad] = useState('si');
  const [bienId,setBienId] = useState('');
  const isBoss = ['administrador','jefatura'].includes(currentUser.rol);
  const selected = selection?.id;
  const historyResult = historyResponse?.selection === selection ? historyResponse : null;
  const reload = useCallback(async () => setRows((await api.getPedidosTI()).data),[]);
  const run = async (fn) => { setError('');setBusy(true);try { await fn(); } catch(e) { setError(e.response?.data?.error || 'No se pudo completar la operación'); } finally { setBusy(false); } };
  useEffect(() => {
    let active = true;
    const load = async () => { try {
      await reload();
      if (isBoss) { const [p,s] = await Promise.all([api.getPersonalTI(),api.getSolicitudesTI()]);if(active) { setPeople(p.data);setSolicitudes(s.data); } }
    } catch(e) { if(active) setError(e.response?.data?.error || 'No se pudo cargar Almacén'); } finally { if(active) setLoading(false); } };
    load();const timer=setInterval(() => reload().catch(() => {}),30000);return () => { active=false;clearInterval(timer); };
  },[reload,isBoss]);
  useEffect(() => {
    setAction('');setComment('');setPerson('');setDate(localNow());setBienId('');
  }, [selected]);
  useEffect(() => {
    if (!selection) return;
    const request = new AbortController();
    api.getHistorialPedidoTI(selection.id, request.signal).then(({ data }) => {
      if (!request.signal.aborted) setHistoryResponse({ selection, data });
    }).catch((failure) => {
      if (request.signal.aborted) return;
      const response = failure.response;
      const message = [403, 404].includes(response?.status) ? response.data?.error : null;
      setHistoryResponse({ selection, error: message || 'No se pudo cargar el historial. Inténtalo de nuevo.' });
    });
    return () => request.abort();
  }, [selection]);
  const closeOrder = () => {
    closeDetail();
    setHistoryResponse(null);
  };
  const row = rows.find((r) => String(r.id) === String(selected));
  const available = [];
  if (row) {
    if (isBoss && row.estado === 'solicitado') available.push(['aprobar','Aprobar pedido']);
    if (['administrador','almacen'].includes(currentUser.rol) && ['solicitado','aprobado'].includes(row.estado)) available.push(['llegada','Registrar llegada']);
    if (isBoss && row.estado === 'en_almacen') available.push(['derivar','Derivar recepción']);
    if (currentUser.es_ti && row.estado === 'en_almacen') available.push(['recepcionar','Recepcionar pedido']);
  }
  const filtered = rows.filter((r) => (!filter || r.estado === filter) && (r.numero+' '+r.descripcion).toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="sca-page-title">Pedidos y Almacén</h1><p className="mt-1 sca-description">Llegada, derivación y recepción de pedidos de TI.</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} className={button} onClick={() => run(async () => { await reload(); retryDetail(); })}>Actualizar</button>
        {isBoss && <button type="button" className={showForm ? button : 'sca-button sca-button-primary'} onClick={() => setShowForm(!showForm)}>{showForm ? 'Cerrar formulario' : 'Registrar pedido'}</button>}
      </div>
    </header>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {showForm && isBoss && <form className="grid gap-4 rounded-xl border bg-white p-5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault();run(async () => { const r=await api.crearPedidoTI(form);await reload();openDetail(r.data.id, r.data.numero);setShowForm(false);setForm({ numero:'',descripcion:'',cantidad:1,solicitudId:'' }); }); }}>
      <label className="text-sm">N.º de pedido / orden<input required maxLength={100} className={input} value={form.numero} onChange={(e) => setForm({ ...form,numero:e.target.value })} /></label>
      <label className="text-sm">Cantidad<input required type="number" min="1" max="100000" step="1" className={input} value={form.cantidad} onChange={(e) => setForm({ ...form,cantidad:e.target.value })} /></label>
      <label className="text-sm sm:col-span-2">Descripción de bienes / equipos<textarea required maxLength={5000} className={input} value={form.descripcion} onChange={(e) => setForm({ ...form,descripcion:e.target.value })} /></label>
      <label className="text-sm">Solicitud vinculada (opcional)<Select className={input} value={form.solicitudId} onChange={(e) => setForm({ ...form,solicitudId:e.target.value })}><option value="">Sin solicitud vinculada</option>{solicitudes.filter((s) => !['cerrada','rechazada'].includes(s.estado)).map((s) => <option key={s.id} value={s.id}>{s.codigo} · {s.datos.beneficiarioNombre}</option>)}</Select></label>
      <button disabled={busy} className="self-end sca-button sca-button-primary">Guardar pedido solicitado</button>
    </form>}
    <div className="grid gap-3 sm:grid-cols-2"><input ref={searchRef} aria-label="Buscar pedido" placeholder="Número o descripción" className="sca-field" value={search} onChange={(e) => setSearch(e.target.value)} /><Select aria-label="Filtrar estado de pedido" className="w-full" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">Todos los estados</option>{['solicitado','aprobado','en_almacen','recepcionado'].map((s) => <option key={s} value={s}>{estadoTI(s)}</option>)}</Select></div>
    {selection && <section ref={detailSectionRef} id="detalle-pedido-ti" aria-labelledby="titulo-detalle-pedido-ti"
      className="scroll-mt-20 space-y-4 rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 ref={detailTitleRef} id="titulo-detalle-pedido-ti" tabIndex={-1} className="min-w-0 break-words sca-section-title">
          {row ? `Pedido ${row.numero}` : selection.code || 'Detalle del pedido'}
        </h2>
        <button type="button" className={button} disabled={busy} onClick={closeOrder}>Cerrar detalle</button>
      </div>
      {!row && (loading || busy ? (
        <p role="status" className="text-sm text-slate-600">Cargando detalle…</p>
      ) : (
        <div className="space-y-3">
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">No se encontró el pedido en la bandeja.</p>
          <button type="button" className={button} onClick={() => run(async () => { await reload(); retryDetail(); })}>Reintentar</button>
        </div>
      ))}
      {row && <>
      {!historyResult && <p role="status" className="text-sm text-slate-600">Cargando historial…</p>}
      {historyResult?.error && <div className="space-y-3">
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{historyResult.error}</p>
        <button type="button" className={button} disabled={busy} onClick={retryDetail}>Reintentar</button>
      </div>}
      <p className="break-words text-sm">{row.descripcion} · Cantidad: {row.cantidad}</p><p className="text-sm">{estadoTI(row.estado)} · {row.responsable || 'Sin derivación'}</p>
      {row.llegada_at && <p className="text-sm">Llegada: {new Date(row.llegada_at).toLocaleString('es-PE')} · {row.observaciones}</p>}
      {row.recepcion_fecha && <p className="text-sm">Recepcionado por {row.recepcion_usuario} el {new Date(row.recepcion_fecha).toLocaleString('es-PE')} · {row.conformidad ? 'Conforme' : 'No conforme'} · {row.recepcion_observaciones}</p>}
      {available.length > 0 && <form className="space-y-3 border-t pt-4" onSubmit={(e) => { e.preventDefault();run(async () => {
        await api.accionPedidoTI(row.id,{ accion:action,usuarioId:person,fecha:['llegada','recepcionar'].includes(action) ? new Date(date).toISOString() : null,observaciones:comment,conformidad:conformidad === 'si' });
        await reload();retryDetail();setAction('');setComment('');
      }); }}>
        <label className="block text-sm">Acción<Select required className={input} value={action} onChange={(e) => setAction(e.target.value)}><option value="">Seleccione una acción</option>{available.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</Select></label>
        {action === 'derivar' && <label className="block text-sm">Personal de TI<Select required className={input} value={person} onChange={(e) => setPerson(e.target.value)}><option value="">Seleccione responsable</option>{people.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</Select></label>}
        {['llegada','recepcionar'].includes(action) && <label className="block text-sm">Fecha y hora<input required type="datetime-local" className={input} value={date} onChange={(e) => setDate(e.target.value)} /></label>}
        {action === 'recepcionar' && <label className="block text-sm">Conformidad<Select className={input} value={conformidad} onChange={(e) => setConformidad(e.target.value)}><option value="si">Conforme</option><option value="no">No conforme (requiere observaciones)</option></Select></label>}
        {action && <label className="block text-sm">Observaciones<textarea maxLength={5000} required={action === 'recepcionar' && conformidad === 'no'} className={input} value={comment} onChange={(e) => setComment(e.target.value)} /></label>}
        <button disabled={busy || !action} className="sca-button sca-button-primary">Guardar acción</button>
      </form>}
      {row.estado === 'recepcionado' && isBoss && <div className="space-y-3 border-t pt-4"><h4 className="font-semibold">Bienes del inventario vinculados</h4><p className="text-sm text-slate-500">Registre los equipos recibidos en Inventario, vincúlelos a este pedido y continúe con su asignación en Movimientos.</p>{(row.bienes || []).map((b) => <p className="text-sm" key={b.id}>{b.nombre} · {b.codigo_patrimonial || b.numero_serie}</p>)}<form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault();run(async () => { await api.vincularBienPedidoTI(row.id,bienId);await reload();setBienId('');retryDetail(); }); }}><label className="min-w-48 flex-1 text-sm">Bien registrado<Select required className={input} value={bienId} onChange={(e) => setBienId(e.target.value)}><option value="">Seleccione un bien</option>{bienes.filter((b) => b.estado !== 'baja').map((b) => <option key={b.id} value={b.id}>{b.nombre} · {b.codigo_patrimonial || b.numero_serie}</option>)}</Select></label><button disabled={busy} className={button}>Vincular bien</button></form><div className="flex flex-wrap gap-2"><button className={button} onClick={onOpenInventario}>Ir a Inventario</button><button className={button} onClick={onOpenMovimientos}>Ir a Movimientos</button></div></div>}
      {historyResult?.data && <div className="space-y-2 border-t pt-4">
        <h4 className="font-semibold">Historial</h4>
        {historyResult.data.length === 0 && <p className="text-sm text-slate-600">Este pedido aún no tiene movimientos registrados.</p>}
        {historyResult.data.map((h) => <div key={h.id} className="text-sm"><p><strong>{h.accion}</strong> · {h.usuario} · {new Date(h.created_at).toLocaleString('es-PE')}</p><p className="whitespace-pre-wrap text-slate-600">{h.comentario}</p></div>)}
      </div>}
      </>}
    </section>}
    <div className="sca-records overflow-x-auto rounded-xl border bg-white">
      <table className="sca-responsive-table w-full text-left text-sm" role="table" aria-label="Pedidos">
        <thead role="rowgroup" className="bg-slate-50"><tr role="row">{['Pedido','Descripción / cantidad','Estado','Responsable','Detalle'].map((h) => <th key={h} scope="col" className="p-3">{h}</th>)}</tr></thead>
        <tbody role="rowgroup">{filtered.map((p) => (
          <tr role="row" key={p.id} className="border-t">
            <td role="cell" className="p-3 sca-record-primary"><strong>{p.numero}</strong><p className="sca-muted">{p.solicitud_codigo}</p></td>
            <td role="cell" className="p-3 sca-record-wide">{p.descripcion}<p className="sca-muted">Cantidad: {p.cantidad}</p></td>
            <td role="cell" className="p-3"><span className="sca-table-label" aria-hidden="true">Estado</span><span className="sca-status" data-state={p.estado}>{estadoTI(p.estado)}</span></td>
            <td role="cell" className="p-3"><span className="sca-table-label" aria-hidden="true">Responsable</span>{p.responsable || 'Sin derivación'}</td>
            <td role="cell" className="p-3 sca-record-actions">
              <button type="button" className="sca-button sca-button-row" disabled={busy} aria-label={`Abrir pedido ${p.numero}`}
                aria-expanded={p.id === row?.id} aria-controls={p.id === row?.id ? 'detalle-pedido-ti' : undefined}
                onClick={(event) => {
                  openDetail(p.id, p.numero, event.currentTarget);
                  if (p.id === row?.id && historyResult?.error) retryDetail();
                }}>Abrir</button>
            </td>
          </tr>
        ))}</tbody>
      </table>
      {loading ? <p className="p-5 text-sm">Cargando pedidos…</p> : !filtered.length && <p className="p-5 text-sm text-slate-500">No hay pedidos con estos filtros.</p>}
    </div>
  </div>;
}
