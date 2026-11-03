import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../services/api';
import { normalizarClaveTI, normalizarCodigoTI, validarConsultaTI } from '../utils/solicitudTIForm';
import { CampoTI, IconoTI, botonPrincipalTI, botonSecundarioTI } from './SolicitudTIUI';

export const estadoTI = (estado) => ({ recibida: 'Recibida', asignada: 'Asignada', en_atencion: 'En atención', atendida: 'Atendida', cerrada: 'Cerrada', observada: 'Observada', rechazada: 'Rechazada', solicitado: 'Solicitado', aprobado: 'Aprobado', en_almacen: 'En almacén — Pendiente de recepción', recepcionado: 'Recepcionado' }[estado] || estado);
const ETAPAS = ['recibida', 'asignada', 'en_atencion', 'atendida', 'cerrada'];
const fecha = (value) => new Date(value).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' });

function ProgresoSolicitud({ estado }) {
  const actual = ETAPAS.indexOf(estado);
  if (actual < 0) return null;
  return <ol className="grid gap-3 sm:grid-cols-5 sm:gap-2" aria-label="Avance de la solicitud">{ETAPAS.map((etapa, index) => <li key={etapa} aria-current={index === actual ? 'step' : undefined} className={`flex items-center gap-3 border-l-2 py-1 pl-4 sm:flex-col sm:items-start sm:border-l-0 sm:border-t-2 sm:py-4 sm:pl-0 ${index <= actual ? 'border-blue-600' : 'border-slate-200'}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${index < actual ? 'bg-blue-100 text-blue-800' : index === actual ? 'bg-blue-700 text-white' : 'border border-slate-300 text-slate-400'}`}>{index < actual ? <IconoTI name="check" className="h-4 w-4" /> : index + 1}</span><span className={`text-sm ${index === actual ? 'font-bold text-blue-800' : index < actual ? 'font-medium text-slate-800' : 'text-slate-500'}`}>{estadoTI(etapa)}<span className="sr-only">{index < actual ? ', completada' : index === actual ? ', etapa actual' : ', pendiente'}</span></span></li>)}</ol>;
}

export default function SeguimientoTI({ initialCode = '', initialKey = '', consultaId = 0 }) {
  const [codigo, setCodigo] = useState(initialCode);
  const [clave, setClave] = useState(initialKey);
  const [correo, setCorreo] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [row, setRow] = useState(null);
  const [errors, setErrors] = useState({});
  const [recoveryErrors, setRecoveryErrors] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [downloadId, setDownloadId] = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const queryVersion = useRef(0);
  const resultRef = useRef(null);

  useEffect(() => { setCodigo(initialCode); setClave(initialKey); setRow(null); setCredentials(null); setError(''); setErrors({}); setShowKey(false); }, [initialCode, initialKey]);
  useEffect(() => { if (row) resultRef.current?.focus(); }, [row]);
  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = setTimeout(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => () => { queryVersion.current += 1; }, []);

  const consultar = useCallback(async (values) => {
    const version = ++queryVersion.current;
    setBusy(true); setError(''); setMessage(''); setRow(null);
    try {
      const response = await api.consultarSolicitudTI(values);
      if (version === queryVersion.current) { setRow(response.data); setCredentials(values); setUpdatedAt(new Date()); }
    } catch (failure) {
      if (version === queryVersion.current) setError(failure.response?.data?.error || 'No pudimos consultar la solicitud. Revisa tu conexión e inténtalo otra vez.');
    } finally { if (version === queryVersion.current) setBusy(false); }
  }, []);

  useEffect(() => {
    if (!consultaId || !initialCode || !initialKey) return;
    setErrors({});
    void consultar({ codigo: normalizarCodigoTI(initialCode), clave: normalizarClaveTI(initialKey) });
  }, [consultaId, initialCode, initialKey, consultar]);

  const consultarFormulario = (event) => {
    event.preventDefault(); if (busy) return;
    const found = validarConsultaTI({ codigo, clave }); setErrors(found); setError('');
    if (Object.keys(found).length) { document.getElementById(`consulta-${Object.keys(found)[0]}`)?.focus(); return; }
    const values = { codigo: normalizarCodigoTI(codigo), clave: normalizarClaveTI(clave) };
    setCodigo(values.codigo); setClave(values.clave); void consultar(values);
  };
  const recuperar = async (event) => {
    event.preventDefault(); if (busy || cooldown) return;
    const found = validarConsultaTI({ codigo, correo }, true); setRecoveryErrors(found); setError(''); setMessage('');
    if (Object.keys(found).length) { document.getElementById(`recuperar-${Object.keys(found)[0]}`)?.focus(); return; }
    setBusy(true);
    try {
      const response = await api.solicitarAccesoTI({ codigo: normalizarCodigoTI(codigo), correo: correo.trim().toLowerCase() });
      setMessage(response.data.message); setCooldown(60);
    } catch (failure) { setError(failure.response?.data?.error || 'No pudimos solicitar la nueva clave. Inténtalo otra vez.'); }
    finally { setBusy(false); }
  };
  const download = async (doc) => {
    if (downloadId || !credentials) return;
    setDownloadId(doc.id); setError('');
    try { api.guardarDescargaTI(await api.descargarDocumentoPublicoTI(doc.id, credentials), doc.nombre); }
    catch (failure) {
      let message = 'No se pudo descargar el documento. Actualiza la consulta o solicita una nueva clave si venció.';
      if (failure.response?.data instanceof Blob) {
        try { message = JSON.parse(await failure.response.data.text()).error || message; } catch { /* Se conserva el mensaje de descarga. */ }
      }
      setError(message);
    } finally { setDownloadId(null); }
  };
  const fileButton = (doc) => <button key={doc.id} type="button" disabled={Boolean(downloadId)} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-400 hover:bg-blue-50/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:opacity-50" onClick={() => download(doc)}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><IconoTI /></span><span className="min-w-0 flex-1"><span className="block break-all text-sm font-semibold text-slate-800">{doc.nombre}</span><span className="mt-0.5 block text-xs text-slate-500">{Math.max(1, Math.ceil(doc.tamano / 1024))} KB · {String(downloadId) === String(doc.id) ? 'Descargando…' : 'Descargar documento'}</span></span><IconoTI name="descargar" className="h-4 w-4 shrink-0 text-blue-700" /></button>;

  return <div className="space-y-6">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-8" aria-labelledby="seguimiento-titulo">
      <div className="mb-6 flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><IconoTI name="buscar" className="h-6 w-6" /></span><div><h2 id="seguimiento-titulo" className="text-xl font-semibold tracking-tight text-slate-950">Seguimiento de solicitud</h2><p className="mt-2 text-sm leading-6 text-slate-600">Consulta el avance, la respuesta y los documentos con los datos de tu constancia.</p></div></div>
      {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4"><p className="text-sm font-medium text-rose-800">{error}</p><p className="mt-2 text-xs leading-5 text-rose-700">Comprueba que el número y la clave sean de la misma constancia. Si necesitas otra clave, puedes solicitarla al correo que registraste.</p><button type="button" className="mt-2 rounded text-sm font-semibold text-rose-800 underline underline-offset-4" onClick={() => setRecoverOpen(true)}>Recuperar una clave</button></div>}
      <form noValidate onSubmit={consultarFormulario} className="grid items-start gap-5 sm:grid-cols-2">
        <CampoTI id="consulta-codigo" label="Número de registro" required value={codigo} disabled={busy} maxLength={80} placeholder="SOL-2026-000001" spellCheck={false} autoCapitalize="characters" error={errors.codigo} hint="Copia el número completo de tu constancia." onChange={(event) => { setCodigo(event.target.value); setErrors((old) => ({ ...old, codigo: undefined })); }} />
        <div><CampoTI id="consulta-clave" label="Clave privada" required type={showKey ? 'text' : 'password'} value={clave} disabled={busy} maxLength={100} autoComplete="off" spellCheck={false} error={errors.clave} hint="La clave inicial es válida durante siete días." onChange={(event) => { setClave(event.target.value); setErrors((old) => ({ ...old, clave: undefined })); }} /><button type="button" aria-pressed={showKey} className="mt-2 inline-flex items-center gap-2 rounded px-1 py-1 text-xs font-semibold text-slate-600 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => setShowKey(!showKey)}><IconoTI name="ojo" className="h-4 w-4" />{showKey ? 'Ocultar clave' : 'Mostrar clave'}</button></div>
        <div className="sm:col-span-2"><button disabled={busy} className={botonPrincipalTI}><IconoTI name="buscar" className="h-4 w-4" />{busy ? 'Procesando…' : 'Consultar solicitud'}</button></div>
      </form>

      <details open={recoverOpen} onToggle={(event) => setRecoverOpen(event.currentTarget.open)} className="mt-7 border-t border-slate-200 pt-5">
        <summary className="cursor-pointer rounded text-sm font-semibold text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">¿Olvidaste tu clave?</summary>
        <p className="mt-3 text-sm leading-6 text-slate-600">Solicita otra al correo que usaste en el registro. La nueva clave es válida por 30 minutos; tu solicitud seguirá guardada.</p>
        <form noValidate onSubmit={recuperar} className="mt-5 grid gap-5 sm:grid-cols-2">
          <CampoTI id="recuperar-codigo" label="Número de registro para recuperar" required value={codigo} maxLength={80} disabled={busy} placeholder="SOL-2026-000001" error={recoveryErrors.codigo} onChange={(event) => { setCodigo(event.target.value); setRecoveryErrors((old) => ({ ...old, codigo: undefined })); }} />
          <CampoTI id="recuperar-correo" label="Correo registrado" required type="email" value={correo} maxLength={300} disabled={busy} autoComplete="email" placeholder="nombre@tc.gob.pe" error={recoveryErrors.correo} onChange={(event) => { setCorreo(event.target.value); setRecoveryErrors((old) => ({ ...old, correo: undefined })); }} />
          <div className="sm:col-span-2"><button disabled={busy || cooldown > 0} className={botonSecundarioTI}><IconoTI name="correo" className="h-4 w-4" />{cooldown ? `Podrás solicitar otra en ${cooldown} s` : 'Solicitar clave por correo'}</button></div>
        </form>
        {message && <p role="status" className="mt-4 rounded-lg bg-blue-50 p-3 text-sm leading-6 text-blue-900">{message}</p>}
      </details>
    </section>

    {row && <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-8" aria-labelledby="consulta-resultado">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tu solicitud</p><h2 ref={resultRef} id="consulta-resultado" tabIndex={-1} className="outline-none mt-2 break-all font-mono text-xl font-semibold text-slate-950">{row.codigo}</h2><p className="mt-2 text-xs text-slate-500">Registrada el {fecha(row.created_at)} · Hora de Lima</p></div><div className={`rounded-full px-3 py-1.5 text-sm font-semibold ${['atendida', 'cerrada'].includes(row.estado) ? 'bg-emerald-50 text-emerald-800' : row.estado === 'rechazada' ? 'bg-rose-50 text-rose-800' : row.estado === 'observada' ? 'bg-amber-50 text-amber-900' : 'bg-blue-50 text-blue-800'}`}>{estadoTI(row.estado)}</div></div>
      <ProgresoSolicitud estado={row.estado} />
      {['observada', 'rechazada'].includes(row.estado) && <p className="mb-4 text-sm leading-6 text-slate-600">{row.estado === 'observada' ? 'Jefatura dejó observaciones sobre tu requerimiento. Revisa el motivo a continuación.' : 'La solicitud fue rechazada. Puedes revisar el motivo registrado por Jefatura.'}</p>}
      {row.observaciones?.length > 0 && <div className="my-5 space-y-3">{row.observaciones.map((item, index) => <article key={`${item.created_at}-${index}`} className="border-l-2 border-amber-300 pl-4"><h3 className="text-sm font-semibold">{item.accion === 'observar' ? 'Observación de Jefatura' : 'Motivo de rechazo'}</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.comentario}</p><p className="mt-1 text-xs text-slate-500">{fecha(item.created_at)}</p></article>)}</div>}
      <div className="mt-5 border-t border-slate-200 pt-6"><h3 className="text-base font-semibold text-slate-950">Respuesta de TI</h3>{row.respuestas?.length ? <div className="mt-4 space-y-5">{row.respuestas.map((answer) => <article key={answer.id} className="rounded-xl bg-slate-50 p-4 sm:p-5"><p className="text-sm font-semibold text-slate-800">{answer.responsable}</p><p className="mt-1 text-xs text-slate-500">{fecha(answer.created_at)}</p><h4 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Acciones realizadas</h4><p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{answer.acciones}</p>{answer.comentario && <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{answer.comentario}</p>}<div className="mt-4 space-y-2">{(row.documentos || []).filter((doc) => String(doc.respuesta_id) === String(answer.id)).map(fileButton)}</div></article>)}</div> : <p className="mt-3 text-sm leading-6 text-slate-500">Aún no hay una respuesta registrada. Puedes volver a consultar el avance con estos mismos datos.</p>}</div>
      {(row.documentos || []).some((doc) => !doc.respuesta_id) && <div className="mt-6 border-t border-slate-200 pt-6"><h3 className="mb-3 text-base font-semibold text-slate-950">Documento de tu solicitud</h3><div className="space-y-2">{row.documentos.filter((doc) => !doc.respuesta_id).map(fileButton)}</div></div>}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5"><p className="text-xs text-slate-500">Consulta actualizada el {fecha(updatedAt)}</p><button type="button" disabled={busy} className={botonSecundarioTI} onClick={() => consultar(credentials)}><IconoTI name="cambio" className="h-4 w-4" />Actualizar resultado</button></div>
    </section>}
  </div>;
}
