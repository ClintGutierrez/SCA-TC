import { useState } from 'react';
import * as api from '../services/api';

const input = 'mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm';
export const estadoTI = (estado) => ({ recibida:'Recibida', asignada:'Asignada', en_atencion:'En atención', atendida:'Atendida', cerrada:'Cerrada', observada:'Observada', rechazada:'Rechazada', solicitado:'Solicitado', aprobado:'Aprobado', en_almacen:'En almacén — Pendiente de recepción', recepcionado:'Recepcionado' }[estado] || estado);

export default function SeguimientoTI({ initialCode = '', initialKey = '' }) {
  const [codigo,setCodigo] = useState(initialCode || '');
  const [clave,setClave] = useState(initialKey || '');
  const [correo,setCorreo] = useState('');
  const [row,setRow] = useState(null);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const [credentials,setCredentials] = useState(null);
  const run = async (fn) => {
    setBusy(true);setError('');setMessage('');
    try { await fn(); } catch (e) { setError(e.response?.data?.error || 'No se pudo completar la consulta'); } finally { setBusy(false); }
  };
  return <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
    <h2 className="text-xl font-semibold">Seguimiento de solicitud</h2>
    <p className="text-sm text-slate-600">Ingrese el número de registro y su clave privada. Si no tiene la clave, solicítela al correo registrado.</p>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(async () => {
      const credentials = { codigo:codigo.trim(),clave:clave.trim() };
      setRow(null); const response = await api.consultarSolicitudTI(credentials);setRow(response.data);setCredentials(credentials);
    }); }}>
      <label className="text-sm">Número de registro<input required className={input} value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="SOL-2026-000001" /></label>
      <label className="text-sm">Clave privada<input required type="password" autoComplete="off" className={input} value={clave} onChange={(e) => setClave(e.target.value)} /></label>
      <button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Consultar</button>
    </form>
    <form className="flex flex-wrap items-end gap-3 border-t pt-4" onSubmit={(e) => { e.preventDefault();run(async () => { const response = await api.solicitarAccesoTI({ codigo:codigo.trim(),correo });setMessage(response.data.message); }); }}>
      <label className="min-w-48 flex-1 text-sm">Correo registrado<input required type="email" className={input} value={correo} onChange={(e) => setCorreo(e.target.value)} /></label>
      <button disabled={busy || !codigo.trim()} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm disabled:opacity-50">Solicitar clave por correo</button>
    </form>
    {row && <div className="space-y-4 border-t pt-5">
      <p className="font-semibold">{row.codigo} · {estadoTI(row.estado)}</p>
      {row.observaciones.map((item,i) => <p key={i} className="whitespace-pre-wrap text-sm"><strong>{estadoTI(item.accion === 'observar' ? 'observada' : 'rechazada')}:</strong> {item.comentario}</p>)}
      {row.respuestas.map((answer) => <article key={answer.id} className="border-l-2 border-blue-200 pl-4">
        <p className="text-sm text-slate-500">{answer.responsable} · {new Date(answer.created_at).toLocaleString('es-PE')}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm">{answer.acciones}</p><p className="whitespace-pre-wrap text-sm">{answer.comentario}</p>
      </article>)}
      <div className="space-y-2">{row.documentos.map((doc) => <button type="button" disabled={busy} className="block text-sm text-blue-700 underline" key={doc.id} onClick={() => run(async () => api.guardarDescargaTI(await api.descargarDocumentoPublicoTI(doc.id,credentials),doc.nombre))}>{doc.respuesta_id ? 'Adjunto de respuesta' : 'Documento oficial'}: {doc.nombre}</button>)}</div>
    </div>}
  </section>;
}
