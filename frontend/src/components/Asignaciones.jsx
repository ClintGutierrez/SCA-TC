import { useEffect, useMemo, useState } from 'react';
import * as api from '../services/api';

const input = 'mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100';

export default function Asignaciones({ bienes = [], personal = [], canManage = false }) {
  const [rows, setRows] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [form, setForm] = useState({ bien_id: '', personal_id: '', fecha_asignacion: new Date().toISOString().slice(0, 10), observaciones: '' });
  const [searchBien, setSearchBien] = useState('');
  const [searchPersonal, setSearchPersonal] = useState('');
  const [returning, setReturning] = useState(null);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try { const response = await api.getAsignaciones({ active: showHistory ? false : true }); setRows(response.data); }
    catch (e) { setError(e?.response?.data?.error || 'No se pudieron cargar las asignaciones'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [showHistory]);
  const activeBienIds = useMemo(() => new Set(rows.filter((row) => !row.fecha_devolucion).map((row) => Number(row.bien_id))), [rows]);
  const available = useMemo(() => bienes.filter((b) => b.estado === 'activo' && !activeBienIds.has(Number(b.id)) && `${b.nombre} ${b.tipo || ''} ${b.numero_serie || ''}`.toLowerCase().includes(searchBien.toLowerCase())), [bienes, activeBienIds, searchBien]);
  const people = useMemo(() => personal.filter((p) => p.estado === 'activo' && `${p.nombre} ${p.apellido} ${p.dni}`.toLowerCase().includes(searchPersonal.toLowerCase())), [personal, searchPersonal]);
  const submit = async (event) => {
    event.preventDefault(); setError('');
    try { await api.createAsignacion(form); setForm({ ...form, bien_id: '', personal_id: '', observaciones: '' }); await load(); }
    catch (e) { setError(e?.response?.data?.error || 'No se pudo registrar la asignación'); }
  };
  const returnAsset = async (id) => {
    try { await api.devolverAsignacion(id, { fecha_devolucion: returnDate }); setReturning(null); await load(); }
    catch (e) { setError(e?.response?.data?.error || 'No se pudo registrar la devolución'); }
  };
  return <div className="space-y-6">
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">Control patrimonial</p><h2 className="mt-2 text-2xl font-semibold text-slate-950">Asignaciones de bienes</h2><p className="mt-2 text-sm text-slate-500">El personal institucional es el responsable físico; el usuario queda como registro de auditoría.</p></div><button onClick={() => setShowHistory(!showHistory)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">{showHistory ? 'Ver activas' : 'Ver historial'}</button></div>
    </div>
    {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
    {canManage && !showHistory && <form onSubmit={submit} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-xl font-semibold">Nueva asignación</h3><div className="mt-5 grid gap-4 md:grid-cols-2">
      <label className="text-sm font-medium">Buscar bien<input value={searchBien} onChange={(e) => setSearchBien(e.target.value)} placeholder="Nombre, tipo o serie" className={input}/><select required value={form.bien_id} onChange={(e) => setForm({ ...form, bien_id: e.target.value })} className={input}><option value="">Selecciona un bien disponible</option>{available.map((b) => <option key={b.id} value={b.id}>{b.nombre} · {b.numero_serie || 'sin serie'}</option>)}</select></label>
      <label className="text-sm font-medium">Buscar personal<input value={searchPersonal} onChange={(e) => setSearchPersonal(e.target.value)} placeholder="Nombre, apellido o DNI" className={input}/><select required value={form.personal_id} onChange={(e) => setForm({ ...form, personal_id: e.target.value })} className={input}><option value="">Selecciona personal activo</option>{people.map((p) => <option key={p.id} value={p.id}>{p.apellido}, {p.nombre} · {p.dni}</option>)}</select></label>
      <label className="text-sm font-medium">Fecha de asignación<input required type="date" value={form.fecha_asignacion} onChange={(e) => setForm({ ...form, fecha_asignacion: e.target.value })} className={input}/></label><label className="text-sm font-medium">Observaciones<textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} className={input}/></label></div><button className="mt-5 rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white">Registrar asignación</button></form>}
    <div className="overflow-x-auto rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">{loading ? <p className="py-8 text-center text-slate-500">Cargando...</p> : <table className="min-w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="px-3 py-3">Bien</th><th className="px-3 py-3">Personal responsable</th><th className="px-3 py-3">Asignación</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3">Acción</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id} className="border-b border-slate-100"><td className="px-3 py-4">{r.bien_nombre}<div className="text-xs text-slate-500">{r.numero_serie || 'Sin serie'}</div></td><td className="px-3 py-4">{r.personal_apellido}, {r.personal_nombre}<div className="text-xs text-slate-500">{r.personal_dni}</div></td><td className="px-3 py-4">{r.fecha_asignacion}<div className="text-xs text-slate-500">{r.fecha_devolucion ? `Devuelta: ${r.fecha_devolucion}` : 'Sin devolución'}</div></td><td className="px-3 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{r.estado}</span></td><td className="px-3 py-4">{!r.fecha_devolucion && canManage && <button onClick={() => setReturning(r.id)} className="font-semibold text-blue-600">Registrar devolución</button>}{returning === r.id && <div className="mt-2 flex gap-2"><input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="rounded border px-2 py-1"/><button onClick={() => returnAsset(r.id)} className="rounded bg-blue-600 px-2 py-1 text-white">Guardar</button></div>}</td></tr>)}</tbody></table>}</div>
  </div>;
}
