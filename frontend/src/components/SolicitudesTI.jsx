import Select from './Select';
import { useCallback, useEffect, useState } from 'react';
import * as api from '../services/api';
import { getTipoLabel, getEquipoLabel } from '../utils/solicitudesStorage';
import { estadoTI } from './SeguimientoTI';
import useDetalleBandejaTI from './useDetalleBandejaTI';

const input = 'mt-1 sca-field';
const button = 'sca-button';
export default function SolicitudesTI({ currentUser, onOpenLanding, onCreatePedido, focusId }) {
  const [rows,setRows] = useState([]);
  const [people,setPeople] = useState([]);
  const { selection, openDetail, closeDetail, retryDetail, detailSectionRef, detailTitleRef, searchRef } = useDetalleBandejaTI(focusId);
  const [detailResponse, setDetailResponse] = useState(null);
  const [filter,setFilter] = useState('');
  const [search,setSearch] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [action,setAction] = useState('');
  const [assignee,setAssignee] = useState('');
  const [comment,setComment] = useState('');
  const [actions,setActions] = useState('');
  const [files,setFiles] = useState([]);
  const isBoss = ['administrador','jefatura'].includes(currentUser.rol);
  const selected = selection?.id;
  const result = detailResponse?.selection === selection ? detailResponse : null;
  const detail = result?.data;
  const detailError = result?.error;
  const reload = useCallback(async () => {
    const response = await api.getSolicitudesTI(); setRows(response.data);
  },[]);
  useEffect(() => {
    let active = true;
    const load = async () => { try { await reload(); if (isBoss) { const p = await api.getPersonalTI(); if(active) setPeople(p.data); } } catch(e) { if(active) setError(e.response?.data?.error || 'No se pudo cargar la bandeja'); } finally { if(active) setLoading(false); } };
    load(); const timer = setInterval(() => reload().catch(() => {}),30000);
    return () => { active=false;clearInterval(timer); };
  },[reload,isBoss]);
  useEffect(() => {
    setAction('');setComment('');setActions('');setFiles([]);setAssignee('');
    if (!selection) return;

    const request = new AbortController();
    api.getSolicitudTI(selection.id, request.signal).then(({ data }) => {
      if (!request.signal.aborted) setDetailResponse({ selection, data });
    }).catch((failure) => {
      if (request.signal.aborted) return;
      const response = failure.response;
      const message = [403, 404].includes(response?.status) ? response.data?.error : null;
      setDetailResponse({ selection, error: message || 'No se pudo abrir la solicitud. Inténtalo de nuevo.' });
    });
    return () => request.abort();
  }, [selection]);

  const closeSolicitud = () => {
    closeDetail();
    setDetailResponse(null);
  };
  const refreshDetail = async () => {
    const { data } = await api.getSolicitudTI(selected);
    setDetailResponse({ selection, data });
  };
  const run = async (fn) => { setBusy(true);setError('');try { await fn(); } catch(e) { setError(e.response?.data?.error || 'No se pudo completar la operación'); } finally { setBusy(false); } };
  const submit = (e) => { e.preventDefault();run(async () => {
    await api.accionSolicitudTI(detail.id,{ accion:action,usuarioId:assignee,comentario:comment,acciones:actions },files);
    await reload();await refreshDetail();setAction('');setFiles([]);setComment('');setActions('');
  }); };
  const available = [];
  if (detail) {
    if (isBoss && ['recibida','asignada','en_atencion','observada'].includes(detail.estado)) available.push(['asignar','Asignar / reasignar'],['rechazar','Rechazar']);
    if (isBoss && ['recibida','asignada','en_atencion'].includes(detail.estado)) available.push(['observar','Observar']);
    if (isBoss && detail.estado === 'atendida') available.push(['cerrar','Cerrar']);
    if (currentUser.es_ti && Number(detail.asignado_a) === Number(currentUser.id)) {
      if (detail.estado === 'asignada') available.push(['iniciar','Iniciar atención']);
      if (detail.estado === 'en_atencion') available.push(['responder','Registrar respuesta']);
      if (['asignada','en_atencion'].includes(detail.estado)) available.push(['devolver','Devolver a Jefatura']);
    }
  }
  const filtered = rows.filter((r) => (!filter || r.estado === filter) && (r.codigo+' '+r.datos.solicitanteNombre+' '+r.datos.beneficiarioNombre).toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="sca-page-title">Solicitudes de TI</h1><p className="mt-1 sca-description">{isBoss ? 'Revise, asigne y supervise la atención.' : currentUser.rol === 'auditor' ? 'Consulta e historial de trámites.' : 'Solicitudes asignadas a su cuenta.'}</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={busy} onClick={() => run(async () => { await reload(); if (detail) await refreshDetail(); })}>Actualizar</button>
        <button type="button" className="sca-button sca-button-primary" onClick={onOpenLanding}>Registrar o consultar solicitud</button>
      </div>
    </header>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2"><input ref={searchRef} aria-label="Buscar solicitudes" placeholder="Buscar código o persona" className="sca-field" value={search} onChange={(e) => setSearch(e.target.value)} /><Select aria-label="Filtrar estado" className="w-full" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">Todos los estados</option>{['recibida','asignada','en_atencion','atendida','cerrada','observada','rechazada'].map((s) => <option key={s} value={s}>{estadoTI(s)}</option>)}</Select></div>
    {selection && <section ref={detailSectionRef} id="detalle-solicitud-ti" aria-labelledby="titulo-detalle-solicitud-ti"
      className="scroll-mt-20 space-y-5 rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 ref={detailTitleRef} id="titulo-detalle-solicitud-ti" tabIndex={-1} className="min-w-0 break-words sca-section-title">
          {detail?.codigo || selection.code || 'Detalle de la solicitud'}{detail && ` · ${estadoTI(detail.estado)}`}
        </h2>
        <button type="button" className={button} disabled={busy} onClick={closeSolicitud}>Cerrar detalle</button>
      </div>
      {!result && <p role="status" className="text-sm text-slate-600">Cargando detalle…</p>}
      {detailError && <div className="space-y-3">
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{detailError}</p>
        <button type="button" className={button} onClick={retryDetail}>Reintentar</button>
      </div>}
      {detail && <>
      <dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Solicitante</dt><dd>{detail.datos.solicitanteNombre} · DNI {detail.datos.solicitanteDni}</dd><dd>{detail.correo} · {detail.datos.solicitanteArea} · {detail.datos.solicitanteCargo}</dd></div><div><dt className="text-slate-500">Beneficiario</dt><dd>{detail.datos.beneficiarioNombre} · DNI {detail.datos.beneficiarioDni}</dd></div><div><dt className="text-slate-500">Equipo y ubicación</dt><dd>{getEquipoLabel(detail.datos.equipoCategoria)} · {detail.datos.codigoActual}</dd><dd>{detail.datos.sede} · {detail.datos.oficina}</dd>{detail.datos.oficinaOrigen && <dd>Origen: {detail.datos.sedeOrigen} · {detail.datos.oficinaOrigen}</dd>}</div><div><dt className="text-slate-500">Documento oficial</dt><dd>{detail.datos.tipoDocumento} {detail.datos.numeroDocumento}</dd></div></dl>
      <p className="whitespace-pre-wrap text-sm"><strong>Justificación:</strong> {detail.datos.justificacion}</p><p className="whitespace-pre-wrap text-sm">{detail.datos.equipoDetalle}</p>
      <div>{detail.documentos.map((doc) => <button key={doc.id} disabled={busy} className="mb-2 block text-sm text-blue-700 underline" onClick={() => run(async () => api.guardarDescargaTI(await api.descargarDocumentoTI(doc.id),doc.nombre))}>{doc.respuesta_id ? 'Respuesta' : 'Documento oficial'}: {doc.nombre} ({Math.ceil(doc.tamano/1024)} KB)</button>)}</div>
      {available.length > 0 && <form onSubmit={submit} className="space-y-3 border-t pt-4"><label className="block text-sm">Acción<Select required className={input} value={action} onChange={(e) => setAction(e.target.value)}><option value="">Seleccione una acción</option>{available.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</Select></label>
        {action === 'asignar' && <label className="block text-sm">Responsable de TI<Select required className={input} value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">Seleccione personal de TI</option>{people.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</Select></label>}
        {action && <label className="block text-sm">{['observar','rechazar','devolver'].includes(action) ? 'Motivo obligatorio' : 'Comentario / indicaciones'}<textarea maxLength={5000} required={['observar','rechazar','devolver'].includes(action)} className={input} value={comment} onChange={(e) => setComment(e.target.value)} /></label>}
        {action === 'responder' && <><label className="block text-sm">Acciones realizadas<textarea required maxLength={5000} className={input} value={actions} onChange={(e) => setActions(e.target.value)} /></label><label className="block text-sm">Adjuntos de respuesta (hasta 3 de 10 MB)<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" className={input} onChange={(e) => setFiles(Array.from(e.target.files || []))} /></label></>}
        <button disabled={busy || !action} className="sca-button sca-button-primary">{busy ? 'Guardando…' : 'Guardar acción'}</button>
      </form>}
      {isBoss && !['cerrada','rechazada'].includes(detail.estado) && <button className={button} onClick={() => onCreatePedido(detail.id)}>Registrar pedido para esta solicitud</button>}
      {detail.pedidos.length > 0 && <div className="text-sm"><h4 className="font-semibold">Pedidos vinculados</h4>{detail.pedidos.map((p) => <p key={p.id}>{p.numero} · {estadoTI(p.estado)}</p>)}</div>}
      {detail.respuestas.length > 0 && <div className="space-y-3 border-t pt-4"><h4 className="font-semibold">Respuestas</h4>{detail.respuestas.map((r) => <article key={r.id} className="border-l-2 pl-3"><p className="text-xs text-slate-500">{r.responsable} · {new Date(r.created_at).toLocaleString('es-PE')}</p><p className="whitespace-pre-wrap text-sm">{r.acciones}</p><p className="whitespace-pre-wrap text-sm">{r.comentario}</p></article>)}</div>}
      <div className="space-y-2 border-t pt-4"><h4 className="font-semibold">Historial</h4>{detail.historial.map((h) => <div key={h.id} className="text-sm"><p><strong>{h.accion}</strong> · {h.usuario || 'Solicitante'} · {new Date(h.created_at).toLocaleString('es-PE')}</p><p className="whitespace-pre-wrap text-slate-600">{h.comentario}</p></div>)}</div>
      </>}
    </section>}
    <div className="sca-records overflow-x-auto rounded-xl border bg-white">
      <table className="sca-responsive-table w-full text-left text-sm" role="table" aria-label="Solicitudes de TI">
        <thead role="rowgroup" className="bg-slate-50"><tr role="row">{['Código / tipo','Solicitante','Beneficiario','Estado','Responsable','Detalle'].map((s) => <th key={s} scope="col" className="p-3">{s}</th>)}</tr></thead>
        <tbody role="rowgroup">{filtered.map((r) => (
          <tr role="row" key={r.id} className="border-t">
            <td role="cell" className="p-3 sca-record-primary"><strong>{r.codigo}</strong><p className="sca-muted">{getTipoLabel(r.tipo)}</p></td>
            <td role="cell" className="p-3"><span className="sca-table-label" aria-hidden="true">Solicitante</span>{r.datos.solicitanteNombre}<p className="sca-muted">{r.datos.solicitanteArea}</p></td>
            <td role="cell" className="p-3"><span className="sca-table-label" aria-hidden="true">Beneficiario</span>{r.datos.beneficiarioNombre}</td>
            <td role="cell" className="p-3"><span className="sca-table-label" aria-hidden="true">Estado</span><span className="sca-status" data-state={r.estado}>{estadoTI(r.estado)}</span></td>
            <td role="cell" className="p-3"><span className="sca-table-label" aria-hidden="true">Responsable</span>{r.responsable || 'Por asignar'}</td>
            <td role="cell" className="p-3 sca-record-actions">
              <button type="button" className="sca-button sca-button-row" disabled={busy} aria-label={`Abrir ${r.codigo}`}
                aria-expanded={r.id === selected} aria-controls={r.id === selected ? 'detalle-solicitud-ti' : undefined}
                onClick={(event) => {
                  openDetail(r.id, r.codigo, event.currentTarget);
                  if (r.id === selected && detailError) retryDetail();
                }}>Abrir</button>
            </td>
          </tr>
        ))}</tbody>
      </table>
      {loading ? <p className="p-5 text-sm">Cargando solicitudes…</p> : !filtered.length && <p className="p-5 text-sm text-slate-500">No hay solicitudes con estos filtros.</p>}
    </div>
  </div>;
}
