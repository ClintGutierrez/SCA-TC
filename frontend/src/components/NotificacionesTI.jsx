import { useCallback, useEffect, useState } from 'react';
import * as api from '../services/api';

export default function NotificacionesTI({ onOpen }) {
  const [rows,setRows] = useState([]);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const reload = useCallback(async () => { try { setRows((await api.getNotificacionesTI()).data);setError(''); } catch(e) { setError(e.response?.data?.error || 'No se pudieron cargar las notificaciones'); } },[]);
  useEffect(() => { reload();const timer=setInterval(reload,30000);return () => clearInterval(timer); },[reload]);
  return <section className="space-y-4"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Notificaciones</h2><button className="rounded-lg border bg-white px-4 py-2 text-sm" onClick={reload}>Actualizar</button></div>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {!rows.length && <p className="text-sm text-slate-500">No tiene notificaciones.</p>}
    {rows.map((r) => <article key={r.id} className={`space-y-2 rounded-xl border bg-white p-5 ${r.leida_at ? 'border-slate-200' : 'border-blue-300'}`}><p className="font-semibold">{r.asunto} {!r.leida_at && <span className="ml-2 text-xs text-blue-700">Sin leer</span>}</p><p className="whitespace-pre-wrap text-sm text-slate-600">{r.mensaje}</p><p className="text-xs text-slate-500">{new Date(r.created_at).toLocaleString('es-PE')} · Correo {r.correo_estado === 'enviada' ? 'enviado' : 'pendiente de envío / reintento'}</p><button disabled={busy} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50" onClick={async () => { setBusy(true);try { await api.leerNotificacionTI(r.id);onOpen(r.entidad,r.entidad_id); } catch(e) { setError(e.response?.data?.error || 'No se pudo abrir la notificación'); } finally { setBusy(false); } }}>Abrir {r.entidad === 'pedido' ? 'pedido' : 'solicitud'}</button></article>)}
  </section>;
}
