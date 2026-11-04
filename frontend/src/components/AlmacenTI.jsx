import { useCallback, useEffect, useState } from 'react';
import * as api from '../services/api';
import { estadoTI } from './SeguimientoTI';

const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm';
const button = 'rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm disabled:opacity-50';
const localNow = () => { const date = new Date(); return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16); };
export default function AlmacenTI({ currentUser, initialSolicitudId, focusId, bienes = [], onOpenInventario, onOpenMovimientos }) {
  const [rows,setRows] = useState([]);
  const [people,setPeople] = useState([]);
  const [solicitudes,setSolicitudes] = useState([]);
  const [selected,setSelected] = useState(focusId || null);
  const [historial,setHistorial] = useState([]);
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
  const reload = useCallback(async () => setRows((await api.getPedidosTI()).data),[]);
  const run = async (fn) => { setError('');setBusy(true);try { await fn(); } catch(e) { setError(e.response?.data?.error || 'No se pudo completar la operación'); } finally { setBusy(false); } };
  useEffect(() => { if (focusId) setSelected(focusId); },[focusId]);
  useEffect(() => {
    let active = true;
    const load = async () => { try {
      await reload();
      if (isBoss) { const [p,s] = await Promise.all([api.getPersonalTI(),api.getSolicitudesTI()]);if(active) { setPeople(p.data);setSolicitudes(s.data); } }
    } catch(e) { if(active) setError(e.response?.data?.error || 'No se pudo cargar Almacén'); } finally { if(active) setLoading(false); } };
    load();const timer=setInterval(() => reload().catch(() => {}),30000);return () => { active=false;clearInterval(timer); };
  },[reload,isBoss]);
  useEffect(() => {
    setAction('');setComment('');setPerson('');setDate(localNow());setHistorial([]);setBienId('');
    if (!selected) return;
    let active=true;api.getHistorialPedidoTI(selected).then((r) => { if(active) setHistorial(r.data); }).catch((e) => { if(active) setError(e.response?.data?.error || 'No se pudo cargar el historial'); });
    return () => { active=false; };
  },[selected]);
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
    <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-semibold">Pedidos y Almacén</h2><p className="text-sm text-slate-500">Llegada, derivación y recepción de pedidos de TI.</p></div><div className="flex gap-2"><button disabled={busy} className={button} onClick={() => run(async () => { await reload(); if (selected) setHistorial((await api.getHistorialPedidoTI(selected)).data); })}>Actualizar</button>{isBoss && <button className={button} onClick={() => setShowForm(!showForm)}>{showForm ? 'Cerrar formulario' : 'Registrar pedido'}</button>}</div></div>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {showForm && isBoss && <form className="grid gap-4 rounded-xl border bg-white p-5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault();run(async () => { const r=await api.crearPedidoTI(form);await reload();setSelected(r.data.id);setShowForm(false);setForm({ numero:'',descripcion:'',cantidad:1,solicitudId:'' }); }); }}>
      <label className="text-sm">N.º de pedido / orden<input required maxLength={100} className={input} value={form.numero} onChange={(e) => setForm({ ...form,numero:e.target.value })} /></label>
      <label className="text-sm">Cantidad<input required type="number" min="1" max="100000" step="1" className={input} value={form.cantidad} onChange={(e) => setForm({ ...form,cantidad:e.target.value })} /></label>
      <label className="text-sm sm:col-span-2">Descripción de bienes / equipos<textarea required maxLength={5000} className={input} value={form.descripcion} onChange={(e) => setForm({ ...form,descripcion:e.target.value })} /></label>
      <label className="text-sm">Solicitud vinculada (opcional)<select className={input} value={form.solicitudId} onChange={(e) => setForm({ ...form,solicitudId:e.target.value })}><option value="">Sin solicitud vinculada</option>{solicitudes.filter((s) => !['cerrada','rechazada'].includes(s.estado)).map((s) => <option key={s.id} value={s.id}>{s.codigo} · {s.datos.beneficiarioNombre}</option>)}</select></label>
      <button disabled={busy} className="self-end rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Guardar pedido solicitado</button>
    </form>}
    <div className="grid gap-3 sm:grid-cols-2"><input aria-label="Buscar pedido" placeholder="Buscar número de pedido o descripción" className={input} value={search} onChange={(e) => setSearch(e.target.value)} /><select aria-label="Filtrar estado de pedido" className={input} value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">Todos los estados</option>{['solicitado','aprobado','en_almacen','recepcionado'].map((s) => <option key={s} value={s}>{estadoTI(s)}</option>)}</select></div>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['Pedido','Descripción / cantidad','Estado','Responsable','Detalle'].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{filtered.map((p) => <tr key={p.id} className="border-t"><td className="p-3 font-semibold">{p.numero}<p className="text-xs font-normal text-slate-500">{p.solicitud_codigo}</p></td><td className="p-3">{p.descripcion}<p className="text-xs text-slate-500">Cantidad: {p.cantidad}</p></td><td className="p-3">{estadoTI(p.estado)}</td><td className="p-3">{p.responsable || 'Sin derivación'}</td><td className="p-3"><button className={button} disabled={busy} onClick={() => setSelected(p.id)}>Abrir</button></td></tr>)}</tbody></table>{loading ? <p className="p-5 text-sm">Cargando pedidos…</p> : !filtered.length && <p className="p-5 text-sm text-slate-500">No hay pedidos con estos filtros.</p>}</div>
    {row && <section className="space-y-4 rounded-xl border bg-white p-5"><div className="flex justify-between gap-3"><h3 className="text-lg font-semibold">Pedido {row.numero}</h3><button className={button} onClick={() => setSelected(null)}>Cerrar detalle</button></div><p className="text-sm">{row.descripcion} · Cantidad: {row.cantidad}</p><p className="text-sm">{estadoTI(row.estado)} · {row.responsable || 'Sin derivación'}</p>
      {row.llegada_at && <p className="text-sm">Llegada: {new Date(row.llegada_at).toLocaleString('es-PE')} · {row.observaciones}</p>}
      {row.recepcion_fecha && <p className="text-sm">Recepcionado por {row.recepcion_usuario} el {new Date(row.recepcion_fecha).toLocaleString('es-PE')} · {row.conformidad ? 'Conforme' : 'No conforme'} · {row.recepcion_observaciones}</p>}
      {available.length > 0 && <form className="space-y-3 border-t pt-4" onSubmit={(e) => { e.preventDefault();run(async () => {
        await api.accionPedidoTI(row.id,{ accion:action,usuarioId:person,fecha:['llegada','recepcionar'].includes(action) ? new Date(date).toISOString() : null,observaciones:comment,conformidad:conformidad === 'si' });
        await reload();setHistorial((await api.getHistorialPedidoTI(row.id)).data);setAction('');setComment('');
      }); }}>
        <label className="block text-sm">Acción<select required className={input} value={action} onChange={(e) => setAction(e.target.value)}><option value="">Seleccione una acción</option>{available.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {action === 'derivar' && <label className="block text-sm">Personal de TI<select required className={input} value={person} onChange={(e) => setPerson(e.target.value)}><option value="">Seleccione responsable</option>{people.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>}
        {['llegada','recepcionar'].includes(action) && <label className="block text-sm">Fecha y hora<input required type="datetime-local" className={input} value={date} onChange={(e) => setDate(e.target.value)} /></label>}
        {action === 'recepcionar' && <label className="block text-sm">Conformidad<select className={input} value={conformidad} onChange={(e) => setConformidad(e.target.value)}><option value="si">Conforme</option><option value="no">No conforme (requiere observaciones)</option></select></label>}
        {action && <label className="block text-sm">Observaciones<textarea maxLength={5000} required={action === 'recepcionar' && conformidad === 'no'} className={input} value={comment} onChange={(e) => setComment(e.target.value)} /></label>}
        <button disabled={busy || !action} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Guardar acción</button>
      </form>}
      {row.estado === 'recepcionado' && isBoss && <div className="space-y-3 border-t pt-4"><h4 className="font-semibold">Bienes del inventario vinculados</h4><p className="text-sm text-slate-500">Registre los equipos recibidos en Inventario, vincúlelos a este pedido y continúe con su asignación en Movimientos.</p>{(row.bienes || []).map((b) => <p className="text-sm" key={b.id}>{b.nombre} · {b.codigo_patrimonial || b.numero_serie}</p>)}<form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault();run(async () => { await api.vincularBienPedidoTI(row.id,bienId);await reload();setBienId('');setHistorial((await api.getHistorialPedidoTI(row.id)).data); }); }}><label className="min-w-48 flex-1 text-sm">Bien registrado<select required className={input} value={bienId} onChange={(e) => setBienId(e.target.value)}><option value="">Seleccione un bien</option>{bienes.filter((b) => b.estado !== 'baja').map((b) => <option key={b.id} value={b.id}>{b.nombre} · {b.codigo_patrimonial || b.numero_serie}</option>)}</select></label><button disabled={busy} className={button}>Vincular bien</button></form><div className="flex gap-2"><button className={button} onClick={onOpenInventario}>Ir a Inventario</button><button className={button} onClick={onOpenMovimientos}>Ir a Movimientos</button></div></div>}
      <div className="space-y-2 border-t pt-4"><h4 className="font-semibold">Historial</h4>{historial.map((h) => <div key={h.id} className="text-sm"><p><strong>{h.accion}</strong> · {h.usuario} · {new Date(h.created_at).toLocaleString('es-PE')}</p><p className="whitespace-pre-wrap text-slate-600">{h.comentario}</p></div>)}</div>
    </section>}
  </div>;
}
