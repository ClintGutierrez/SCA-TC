import { useEffect, useRef, useState } from 'react';
import { AREAS_SUGERIDAS_TC, EQUIPOS_PERIFERICOS_TI, SEDES_TC, TIPOS_DOCUMENTO_OFICIAL, TIPOS_SOLICITUD_TI, getEquipoLabel, getTipoLabel } from '../utils/solicitudesStorage';
import { PASOS_SOLICITUD_TI, errorArchivoTI, nuevaSolicitudTI, validarPasoSolicitudTI } from '../utils/solicitudTIForm';
import { registrarSolicitudTI } from '../services/api';
import { CampoTI, IconoTI, botonPrincipalTI, botonSecundarioTI } from './SolicitudTIUI';
import SeguimientoTI from './SeguimientoTI';

const ICONOS_TIPO = ['personas', 'equipo', 'cambio', 'ubicacion', 'impresora', 'documento'];
const fechaLima = (value) => new Date(value).toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Lima' });
const tamanoArchivo = (size) => size < 1024 * 1024 ? `${Math.max(1, Math.ceil(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;

function ResumenDato({ label, children, wide = false }) {
  return <div className={wide ? 'sm:col-span-2' : ''}><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 break-words whitespace-pre-wrap text-sm leading-6 text-slate-900">{children || 'No indicado'}</dd></div>;
}

function GrupoRevision({ title, step, onEdit, children, disabled }) {
  return <section className="rounded-xl border border-slate-200 p-4 sm:p-5">
    <div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-900">{title}</h3>{onEdit && <button type="button" disabled={disabled} className="rounded-md px-2 py-1 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => onEdit(step)}>Editar<span className="sr-only"> {title.toLowerCase()}</span></button>}</div>
    <dl className="grid gap-4 sm:grid-cols-2">{children}</dl>
  </section>;
}

function ResumenSolicitud({ form, file, onEdit, disabled }) {
  return <div className="space-y-4">
    <GrupoRevision title="Tipo de solicitud" step={0} onEdit={onEdit} disabled={disabled}><ResumenDato label="Servicio solicitado" wide>{getTipoLabel(form.tipoSolicitud)}</ResumenDato></GrupoRevision>
    <GrupoRevision title="Datos personales" step={1} onEdit={onEdit} disabled={disabled}>
      <ResumenDato label="Solicitante">{form.solicitanteNombre}</ResumenDato><ResumenDato label="DNI del solicitante">{form.solicitanteDni}</ResumenDato>
      <ResumenDato label="Correo institucional">{form.solicitanteCorreo}</ResumenDato><ResumenDato label="Área y cargo">{`${form.solicitanteArea} · ${form.solicitanteCargo}`}</ResumenDato>
      <ResumenDato label="Beneficiario">{form.mismoSolicitante ? form.solicitanteNombre : form.beneficiarioNombre}</ResumenDato>
      <ResumenDato label="DNI y cargo del beneficiario">{form.mismoSolicitante ? `${form.solicitanteDni} · ${form.solicitanteCargo}` : `${form.beneficiarioDni} · ${form.beneficiarioCargo}`}</ResumenDato>
    </GrupoRevision>
    <GrupoRevision title="Requerimiento y documento" step={2} onEdit={onEdit} disabled={disabled}>
      <ResumenDato label="Equipo o servicio">{getEquipoLabel(form.equipoCategoria)}</ResumenDato><ResumenDato label="Código patrimonial o serie">{form.codigoActual || 'No aplica'}</ResumenDato>
      {form.tipoSolicitud === 'cambio_ubicacion' && <ResumenDato label="Origen">{`${form.sedeOrigen} · ${form.oficinaOrigen}`}</ResumenDato>}
      <ResumenDato label={form.tipoSolicitud === 'cambio_ubicacion' ? 'Destino' : 'Ubicación'}>{`${form.sede} · ${form.oficina}`}</ResumenDato>
      <ResumenDato label="Detalle del requerimiento" wide>{form.equipoDetalle}</ResumenDato><ResumenDato label="Justificación" wide>{form.justificacion}</ResumenDato>
      <ResumenDato label="Documento oficial">{`${form.tipoDocumento} · ${form.numeroDocumento}`}</ResumenDato><ResumenDato label="Archivo adjunto">{file && `${file.nombre || file.name} · ${tamanoArchivo(file.size)}`}</ResumenDato>
    </GrupoRevision>
  </div>;
}

function CargaDocumento({ file, error, onSelect, onRemove, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) { setPreview(null); return undefined; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <div>
    <p className="mb-2 text-sm font-semibold text-slate-800">Documento oficial adjunto <span className="text-blue-700">*</span></p>
    <div className={`rounded-xl border-2 border-dashed p-5 transition ${dragging ? 'border-blue-600 bg-blue-50' : error ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300 bg-slate-50/60'}`}
      onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
      onDrop={(event) => { event.preventDefault(); setDragging(false); if (!disabled) onSelect(Array.from(event.dataTransfer.files)); }}>
      {file ? <div className="flex flex-wrap items-center gap-4">
        {preview ? <img src={preview} alt="Vista previa del documento adjunto" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><IconoTI className="h-7 w-7" /></span>}
        <div className="min-w-0 flex-1"><p className="break-all text-sm font-semibold text-slate-900">{file.name}</p><p className="mt-1 text-xs text-slate-500">{tamanoArchivo(file.size)} · Listo para adjuntar</p></div>
        <button type="button" disabled={disabled} className="rounded-lg px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50" onClick={() => { if (inputRef.current) inputRef.current.value = ''; onRemove(); }}>Quitar<span className="sr-only"> documento adjunto</span></button>
      </div> : <div className="flex flex-col items-center text-center"><IconoTI name="subir" className="mb-3 h-8 w-8 text-blue-700" /><p className="text-sm font-semibold text-slate-800">Arrastra aquí tu documento</p><p className="mt-1 text-xs text-slate-500">o selecciónalo desde tu equipo</p></div>}
      <label className={`${botonSecundarioTI} mt-4 cursor-pointer focus-within:ring-4 focus-within:ring-blue-200 ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
        <IconoTI name={file ? 'cambio' : 'subir'} />{file ? 'Cambiar archivo' : 'Seleccionar archivo'}
        <input ref={inputRef} id="solicitud-documento" type="file" className="sr-only" aria-label="Documento oficial adjunto" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={`solicitud-documento-ayuda${error ? ' solicitud-documento-error' : ''}`} onChange={(event) => { if (event.target.files.length) onSelect(Array.from(event.target.files)); event.target.value = ''; }} />
      </label>
    </div>
    <p id="solicitud-documento-ayuda" className="mt-2 text-xs leading-5 text-slate-500">Un archivo PDF, JPG, PNG o WEBP. Máximo 10 MB. Adjunta el memorando, oficio u otro documento que sustente tu solicitud.</p>
    {error && <p id="solicitud-documento-error" className="mt-2 text-sm text-rose-700">{error}</p>}
  </div>;
}

function ConstanciaSolicitud({ registro, onConsultar, onNueva }) {
  const [showKey, setShowKey] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const codeRef = useRef(null);
  const keyRef = useRef(null);
  const copy = async (value, label, ref) => {
    try { await navigator.clipboard.writeText(value); setNotice(`${label} copiado.`); }
    catch { ref.current?.focus(); ref.current?.select(); setNotice('El navegador no permitió copiar automáticamente. El dato está seleccionado: cópialo con Ctrl+C o desde el menú de tu dispositivo.'); }
  };
  const download = async () => {
    if (downloading) return;
    setDownloading(true); setError('');
    try { const { crearConstanciaTI } = await import('../utils/constanciaTI'); const pdf = await crearConstanciaTI(registro); pdf.save(`Constancia_${registro.codigo}.pdf`); setNotice('Constancia preparada para descargar.'); }
    catch { setError('No se pudo preparar la constancia. Puedes copiar el número y la clave e intentarlo otra vez.'); }
    finally { setDownloading(false); }
  };
  const expires = new Date(new Date(registro.created_at).getTime() + 7 * 24 * 60 * 60 * 1000);
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-8" aria-labelledby="constancia-titulo">
    <div className="mb-5 flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><IconoTI name="check" className="h-6 w-6" /></span><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Registro completado</p><h2 id="constancia-titulo" tabIndex={-1} className="outline-none mt-1 text-2xl font-semibold tracking-tight text-slate-950">Tu solicitud fue recibida</h2><p className="mt-2 text-sm leading-6 text-slate-600">Jefatura de TI revisará tu requerimiento y asignará a un responsable. Guarda tu constancia para consultar la respuesta.</p></div></div>
    <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:p-5">
      <div><label htmlFor="constancia-codigo" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Número de registro</label><div className="mt-2 flex flex-wrap items-center gap-2"><input ref={codeRef} id="constancia-codigo" readOnly value={registro.codigo} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-3 font-mono text-lg font-semibold text-blue-800" /><button type="button" className={botonSecundarioTI} onClick={() => copy(registro.codigo, 'Número de registro', codeRef)}><IconoTI name="copiar" /><span>Copiar número</span></button></div></div>
      <div><label htmlFor="constancia-clave" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Clave privada de consulta</label><div className="mt-2 flex flex-wrap items-center gap-2"><input ref={keyRef} id="constancia-clave" type={showKey ? 'text' : 'password'} readOnly value={registro.clave} autoComplete="off" className="w-full min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-3 font-mono text-sm sm:min-w-48" /><button type="button" className={botonSecundarioTI} aria-pressed={showKey} onClick={() => setShowKey(!showKey)}><IconoTI name="ojo" />{showKey ? 'Ocultar' : 'Mostrar'}<span className="sr-only"> clave privada</span></button><button type="button" className={botonSecundarioTI} onClick={() => copy(registro.clave, 'Clave privada', keyRef)}><IconoTI name="copiar" />Copiar clave</button></div><p className="mt-2 text-xs leading-5 text-slate-600">Válida hasta el {fechaLima(expires)} (hora de Lima). Esta clave permite consultar tu trámite y sus documentos; consérvala de forma privada.</p></div>
    </div>
    <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-emerald-800">{notice}</p>
    {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
    <div className="mb-7 mt-3 flex flex-wrap gap-3"><button type="button" className={botonPrincipalTI} onClick={onConsultar}><IconoTI name="buscar" />Consultar esta solicitud</button><button type="button" className={botonSecundarioTI} disabled={downloading} onClick={download}><IconoTI name="descargar" />{downloading ? 'Preparando constancia…' : 'Descargar constancia PDF'}</button></div>
    <p className="mb-4 text-xs text-slate-500">Registro del {fechaLima(registro.created_at)} · Estado inicial: Recibida</p>
    <ResumenSolicitud form={registro.datos} file={registro.archivo} />
    <div className="mt-6 border-t border-slate-200 pt-5"><button type="button" className={botonSecundarioTI} onClick={onNueva}>Registrar otra solicitud<IconoTI name="flecha" /></button></div>
  </section>;
}

export default function LandingSolicitudTI({ currentUser, onGoToAccess, onGoToPanelInbox }) {
  const [form, setForm] = useState(nuevaSolicitudTI);
  const [file, setFile] = useState(null);
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [view, setView] = useState('registro');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [registro, setRegistro] = useState(null);
  const [duplicate, setDuplicate] = useState(false);
  const [focusField, setFocusField] = useState(null);
  const [consultaId, setConsultaId] = useState(0);
  const inFlight = useRef(false);
  const cambioUbicacion = form.tipoSolicitud === 'cambio_ubicacion';
  useEffect(() => {
    if (!focusField) return;
    document.getElementById(`solicitud-${focusField}`)?.focus(); setFocusField(null);
  }, [focusField, step]);
  useEffect(() => {
    const previous = document.title; document.title = 'Solicitudes y servicios de TI | SCA-TC';
    return () => { document.title = previous; };
  }, []);
  useEffect(() => { if (registro) document.getElementById('constancia-titulo')?.focus(); }, [registro]);

  const change = (event) => {
    const { name, value, type, checked } = event.target;
    let next = type === 'checkbox' ? checked : value;
    if (name.endsWith('Dni')) next = value.replace(/\D/g, '').slice(0, 8);
    setForm((old) => ({ ...old, [name]: next }));
    setErrors((old) => { const updated = { ...old }; delete updated[name]; return updated; }); setError(''); setDuplicate(false);
  };
  const chooseType = (type) => {
    setForm((old) => ({ ...old, tipoSolicitud: type, mismoSolicitante: type === 'nuevo_usuario' ? false : old.mismoSolicitante, equipoCategoria: type === 'impresora_escaner' ? 'impresora' : old.equipoCategoria }));
    setErrors({}); setError(''); setDuplicate(false);
  };
  const selectFile = (files) => {
    const selected = files.length === 1 ? files[0] : null;
    const message = files.length > 1 ? 'Selecciona un solo documento oficial.' : errorArchivoTI(selected);
    setFile(message ? null : selected); setErrors((old) => ({ ...old, documento: message || undefined })); setError(''); setDuplicate(false);
  };
  const validateUntil = (last) => {
    let allErrors = {};
    let firstStep = null;
    for (let index = 0; index <= Math.min(last, 2); index++) {
      const found = validarPasoSolicitudTI(form, file, index);
      if (Object.keys(found).length && firstStep === null) firstStep = index;
      allErrors = { ...allErrors, ...found };
    }
    setErrors(allErrors);
    if (firstStep !== null) { setStep(firstStep); setFocusField(Object.keys(allErrors)[0]); return false; }
    return true;
  };
  const move = (next) => {
    if (saving) return;
    if (next > step && !validateUntil(next - 1)) return;
    setStep(next); setMaxStep((old) => Math.max(old, next)); setErrors({}); setError(''); setDuplicate(false); setFocusField('paso');
  };
  const send = async (confirmarDuplicado = false) => {
    if (inFlight.current || !validateUntil(2)) return;
    inFlight.current = true; setSaving(true); setError(''); setDuplicate(false);
    try {
      const { data } = await registrarSolicitudTI({ ...form, confirmarDuplicado }, file);
      setRegistro({ ...data, datos: { ...form, ...data.datos }, archivo: { nombre: file.name, size: file.size } });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (failure) {
      if (failure.response?.data?.duplicada) setDuplicate(true);
      else {
        const message = failure.response?.data?.error || 'No pudimos registrar tu solicitud. Tus datos se conservan para que puedas intentarlo otra vez.';
        if (/formato inv[aá]lido|archivo|adjuntar.*documento/i.test(message)) { setErrors({ documento: message }); setStep(2); setFocusField('documento'); }
        else { setError(message); setFocusField('error-general'); }
      }
    } finally { inFlight.current = false; setSaving(false); }
  };
  const submit = (event) => { event.preventDefault(); if (step < 3) move(step + 1); else void send(); };
  const fresh = () => { setRegistro(null); setForm(nuevaSolicitudTI()); setFile(null); setStep(0); setMaxStep(0); setErrors({}); setError(''); setDuplicate(false); setConsultaId(0); setFocusField('paso'); };
  const field = (name, label, props = {}) => <CampoTI id={`solicitud-${name}`} name={name} label={label} value={form[name]} onChange={change} error={errors[name]} required maxLength={300} {...props} />;
  const switchView = (next) => { if (!saving) { setView(next); document.getElementById('solicitud-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
      <a href="#inicio-solicitud" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100" aria-label="SCA-TC, inicio de solicitudes"><img src="/sca-tc.svg" alt="" className="h-11 w-11" /><span><span className="block text-base font-bold tracking-tight text-slate-950">SCA-TC</span><span className="block text-xs text-slate-500 sm:text-sm">Tribunal Constitucional del Perú</span></span></a>
      <div className="flex items-center gap-3"><a href="#ayuda-solicitud" className="rounded-lg px-2 py-2 text-sm font-semibold text-slate-600 hover:text-blue-700">Ayuda</a><button type="button" disabled={saving} className={botonSecundarioTI} onClick={currentUser ? onGoToPanelInbox : onGoToAccess}>{currentUser ? 'Ir al panel' : 'Acceso al sistema'}<IconoTI name="flecha" className="h-4 w-4" /></button></div>
    </div></header>

    <main id="inicio-solicitud" className="mx-auto max-w-6xl px-4 pb-12 pt-9 sm:px-6 sm:pt-12">
      <section className="mb-9 grid items-center gap-7 lg:grid-cols-[1.35fr_1fr]" aria-labelledby="landing-titulo">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Mesa de servicios de TI</p><h1 id="landing-titulo" className="mt-3 max-w-xl text-3xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl">Solicitudes y servicios de TI</h1><p className="mt-4 max-w-xl text-base leading-7 text-slate-600">Solicita equipos, cambios de ubicación y servicios de tecnología. Registra tu requerimiento y consulta aquí el avance de su atención.</p></div>
        <ol className="space-y-4 border-l-2 border-blue-100 pl-5 lg:ml-8" aria-label="Cómo se atiende tu solicitud">{[['01', 'Registra tu solicitud', 'Completa tus datos y adjunta el sustento.'], ['02', 'TI revisa y asigna', 'Un responsable recibe tu requerimiento.'], ['03', 'Consulta la respuesta', 'Usa tu número de registro y clave privada.']].map(([n, title, text]) => <li key={n} className="flex gap-3"><span className="pt-0.5 font-mono text-xs font-semibold text-blue-700">{n}</span><div><p className="text-sm font-semibold text-slate-900">{title}</p><p className="mt-0.5 text-xs leading-5 text-slate-500">{text}</p></div></li>)}</ol>
      </section>

      <div id="solicitud-panel" className="scroll-mt-5">
        <nav aria-label="Registro y seguimiento de solicitudes" className="mb-6 inline-flex w-full gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1.5 sm:w-auto">
          {[['registro', 'Registrar solicitud', 'documento'], ['seguimiento', 'Consultar solicitud', 'buscar']].map(([id, label, icon]) => <button key={id} type="button" disabled={saving} aria-pressed={view === id} aria-controls={`panel-${id}`} className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 sm:flex-none sm:px-5 ${view === id ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-600 hover:bg-white/60'}`} onClick={() => switchView(id)}><IconoTI name={icon} className="hidden h-4 w-4 sm:block" />{label}</button>)}
        </nav>

        <div id="panel-seguimiento" className={view === 'seguimiento' ? 'block' : 'hidden'}><SeguimientoTI initialCode={registro?.codigo} initialKey={registro?.clave} consultaId={consultaId} /></div>
        <div id="panel-registro" className={view === 'registro' ? 'block' : 'hidden'}>
          {registro ? <ConstanciaSolicitud registro={registro} onNueva={fresh} onConsultar={() => { setConsultaId((old) => old + 1); switchView('seguimiento'); }} /> : <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_270px]">
            <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-labelledby="solicitud-paso">
              <ol className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-4 sm:gap-1 sm:p-5" aria-label="Pasos del registro">{PASOS_SOLICITUD_TI.map((label, index) => <li key={label}><button type="button" disabled={saving || index > maxStep} aria-current={step === index ? 'step' : undefined} onClick={() => move(index)} className={`flex h-full w-full items-start gap-2 rounded-lg p-2 text-left text-xs leading-5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-default ${step === index ? 'bg-blue-50 font-bold text-blue-800' : index < step ? 'text-slate-700 hover:bg-white' : 'text-slate-500'}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${step === index ? 'bg-blue-700 text-white' : index < step ? 'bg-blue-100 text-blue-800' : 'border border-slate-300 bg-white text-slate-500'}`}>{index < step ? <IconoTI name="check" className="h-3.5 w-3.5" /> : index + 1}</span><span>{label}</span></button></li>)}</ol>
              <form noValidate onSubmit={submit} aria-busy={saving} className="p-5 sm:p-7">
                <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Paso {step + 1} de 4</p><h2 id="solicitud-paso" tabIndex={-1} className="outline-none mt-2 text-xl font-semibold tracking-tight text-slate-950">{['¿En qué podemos ayudarte?', 'Solicitante y beneficiario', 'Cuéntanos qué necesitas', 'Revisa tu solicitud'][step]}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{['Selecciona el servicio que se ajusta a tu requerimiento.', 'Identifica a quien solicita y a la persona que recibirá el equipo o servicio.', 'Los campos con asterisco son obligatorios. Adjunta el documento que sustenta tu pedido.', 'Comprueba los datos antes de enviarlos. Puedes editar cualquier sección.'][step]}</p></div>
                {Object.values(errors).some(Boolean) && <p role="alert" className="mb-5 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">Revisa los campos señalados para continuar.</p>}
                {error && <p id="solicitud-error-general" tabIndex={-1} role="alert" className="mb-5 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
                <fieldset disabled={saving} className="min-w-0">
                  <legend className="sr-only">{PASOS_SOLICITUD_TI[step]}</legend>
                  {step === 0 && <fieldset id="solicitud-tipoSolicitud" tabIndex={-1} className="grid gap-3 sm:grid-cols-2" aria-describedby={errors.tipoSolicitud ? 'tipo-solicitud-error' : undefined}><legend className="sr-only">Tipo de solicitud</legend>{TIPOS_SOLICITUD_TI.map(([id, label, description], index) => <label key={id} className={`relative flex cursor-pointer gap-3 rounded-xl border p-4 transition focus-within:ring-4 focus-within:ring-blue-100 ${form.tipoSolicitud === id ? 'border-blue-600 bg-blue-50/60' : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50'}`}><input type="radio" name="tipoSolicitud" value={id} checked={form.tipoSolicitud === id} onChange={() => chooseType(id)} className="sr-only" /><span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${form.tipoSolicitud === id ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}><IconoTI name={ICONOS_TIPO[index]} /></span><span className="min-w-0"><span className="block pr-3 text-sm font-semibold leading-5 text-slate-900">{label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>{form.tipoSolicitud === id && <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-800"><IconoTI name="check" className="h-3.5 w-3.5" />Seleccionado</span>}</span></label>)}{errors.tipoSolicitud && <p id="tipo-solicitud-error" className="text-sm text-rose-700">{errors.tipoSolicitud}</p>}</fieldset>}

                  {step === 1 && <div className="space-y-6"><div className="grid gap-5 sm:grid-cols-2">
                    {field('solicitanteNombre', 'Nombres y apellidos', { autoComplete: 'name', className: 'sm:col-span-2' })}
                    {field('solicitanteDni', 'DNI del solicitante', { inputMode: 'numeric', maxLength: 8, placeholder: '8 dígitos' })}
                    {field('solicitanteCorreo', 'Correo institucional', { type: 'email', autoComplete: 'email', placeholder: 'nombre@tc.gob.pe', hint: 'Aquí recibirás la constancia y las comunicaciones de tu solicitud.' })}
                    {field('solicitanteArea', 'Área', { list: 'areas-tc', autoComplete: 'organization' })}<datalist id="areas-tc">{AREAS_SUGERIDAS_TC.map((area) => <option key={area} value={area} />)}</datalist>
                    {field('solicitanteCargo', 'Cargo', { autoComplete: 'organization-title' })}
                  </div><div className="border-t border-slate-200 pt-5"><h3 className="text-base font-semibold">¿Para quién es la solicitud?</h3><label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><input type="checkbox" name="mismoSolicitante" checked={form.mismoSolicitante} onChange={change} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-blue-700" /><span className="text-sm leading-6 text-slate-700">El beneficiario es el mismo solicitante<span className="block text-xs text-slate-500">Usaremos tus datos sin que tengas que escribirlos de nuevo.</span></span></label>
                    {!form.mismoSolicitante && <div className="mt-5 grid gap-5 sm:grid-cols-2">{field('beneficiarioNombre', 'Nombres y apellidos del beneficiario', { className: 'sm:col-span-2' })}{field('beneficiarioDni', 'DNI del beneficiario', { inputMode: 'numeric', maxLength: 8, placeholder: '8 dígitos' })}{field('beneficiarioCargo', 'Cargo o régimen del beneficiario', { placeholder: 'Ej. Asistente administrativo / CAS' })}</div>}
                  </div></div>}

                  {step === 2 && <div className="space-y-7">
                    <section><h3 className="mb-4 text-base font-semibold">Ubicación del requerimiento</h3><div className="grid gap-5 sm:grid-cols-2">
                      {cambioUbicacion && <>{field('sedeOrigen', 'Sede de origen', { as: 'select', children: SEDES_TC.map((sede) => <option key={sede}>{sede}</option>) })}{field('oficinaOrigen', 'Oficina y piso de origen', { placeholder: 'Ej. Piso 1, Oficina 101' })}</>}
                      {field('sede', cambioUbicacion ? 'Sede de destino' : 'Sede', { as: 'select', children: SEDES_TC.map((sede) => <option key={sede}>{sede}</option>) })}
                      {field('oficina', cambioUbicacion ? 'Oficina y piso de destino' : 'Oficina y piso', { placeholder: 'Ej. Piso 2, Oficina 202' })}
                    </div></section>
                    <section className="border-t border-slate-200 pt-6"><h3 className="mb-4 text-base font-semibold">Equipo o servicio solicitado</h3><div className="grid gap-5 sm:grid-cols-2">
                      {field('equipoCategoria', 'Equipo o periférico', { as: 'select', children: EQUIPOS_PERIFERICOS_TI.filter(([id]) => form.tipoSolicitud !== 'impresora_escaner' || ['impresora', 'escaner'].includes(id)).map(([id, label]) => <option key={id} value={id}>{label}</option>) })}
                      {field('codigoActual', 'Código patrimonial o serie', { required: ['cambio_equipo', 'cambio_ubicacion'].includes(form.tipoSolicitud), maxLength: 150, hint: ['cambio_equipo', 'cambio_ubicacion'].includes(form.tipoSolicitud) ? 'Necesario para identificar el equipo que cambiará o será trasladado.' : 'Opcional si se solicita un equipo nuevo.' })}
                      {field('equipoDetalle', 'Detalle del requerimiento', { as: 'textarea', rows: 3, maxLength: 3000, className: 'sm:col-span-2', placeholder: 'Describe el equipo, sus características o el servicio que necesitas.' })}
                      {field('justificacion', 'Justificación', { as: 'textarea', rows: 3, maxLength: 5000, className: 'sm:col-span-2', placeholder: 'Explica el motivo y las labores para las que necesitas este requerimiento.' })}
                    </div></section>
                    <section className="border-t border-slate-200 pt-6"><h3 className="mb-4 text-base font-semibold">Documento que sustenta la solicitud</h3><div className="mb-5 grid gap-5 sm:grid-cols-2">{field('tipoDocumento', 'Tipo de documento', { as: 'select', children: TIPOS_DOCUMENTO_OFICIAL.map((type) => <option key={type}>{type}</option>) })}{field('numeroDocumento', 'Número o referencia', { placeholder: 'Ej. Memorando N.º 0145-2026' })}</div><CargaDocumento file={file} error={errors.documento} disabled={saving} onSelect={selectFile} onRemove={() => { setFile(null); setErrors((old) => ({ ...old, documento: undefined })); }} /></section>
                  </div>}

                  {step === 3 && <div><ResumenSolicitud form={form} file={file} onEdit={move} disabled={saving} /><p className="mt-5 text-sm leading-6 text-slate-600">Al enviar se generará tu número de registro y una clave privada para el seguimiento. Conserva ambos datos o descarga la constancia.</p></div>}
                </fieldset>
                {duplicate && <div role="alert" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4"><h3 className="font-semibold text-amber-950">Ya existe una solicitud similar en curso</h3><p className="mt-2 text-sm leading-6 text-amber-900">Encontramos una solicitud del mismo beneficiario, tipo y equipo. Puedes revisar tus datos o registrar otra si es necesario.</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" className={botonSecundarioTI} onClick={() => setDuplicate(false)}>Volver y revisar</button><button type="button" className={botonPrincipalTI} disabled={saving} onClick={() => send(true)}>Enviar de todas formas</button></div></div>}
                <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5"><div>{step > 0 && <button type="button" disabled={saving} className={botonSecundarioTI} onClick={() => move(step - 1)}><IconoTI name="atras" className="h-4 w-4" />Anterior</button>}</div><button type="submit" disabled={saving || duplicate} className={`${botonPrincipalTI} ml-auto`}>{saving ? 'Registrando solicitud…' : step === 3 ? 'Enviar solicitud' : 'Continuar'}{!saving && <IconoTI name="flecha" className="h-4 w-4" />}</button></div>
              </form>
            </section>

            <aside className="rounded-2xl border border-slate-200 bg-white p-5 lg:sticky lg:top-5" aria-label="Ayuda para registrar la solicitud"><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Antes de comenzar</p><h2 className="mt-2 text-lg font-semibold">Ten a la mano</h2><ul className="mt-4 space-y-4 text-sm leading-6 text-slate-600">{[['personas', 'Tus datos y los del beneficiario', 'DNI, correo institucional, área y cargo.'], ['documento', 'El documento de sustento', 'Memorando, oficio u otro documento oficial de hasta 10 MB.'], ['ubicacion', 'La ubicación y el requerimiento', 'Sede, oficina y detalle del equipo o servicio.']].map(([icon, title, text]) => <li key={icon} className="flex gap-3"><IconoTI name={icon} className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" /><span><strong className="block font-semibold text-slate-800">{title}</strong><span className="text-xs leading-5">{text}</span></span></li>)}</ul><div className="mt-5 border-t border-slate-200 pt-5"><p className="text-xs font-semibold text-slate-500">Servicio seleccionado</p><p className="mt-1 text-sm font-semibold leading-6 text-slate-900">{getTipoLabel(form.tipoSolicitud)}</p></div><p className="mt-5 text-xs leading-5 text-slate-500">Puedes retroceder y cambiar entre registro y consulta sin perder los datos mientras esta página permanezca abierta.</p></aside>
          </div>}
        </div>
      </div>

      <section id="ayuda-solicitud" className="mt-12 scroll-mt-6 border-t border-slate-200 pt-8" aria-labelledby="ayuda-titulo"><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Estamos para orientarte</p><h2 id="ayuda-titulo" className="mt-2 text-2xl font-semibold tracking-tight">Preguntas frecuentes</h2><div className="mt-5 grid items-start gap-x-8 sm:grid-cols-2">{[
        ['¿Qué documento debo adjuntar?', 'Un memorando, oficio, informe, formato de solicitud firmado o resolución que sustente tu requerimiento. Se admite un archivo PDF, JPG, PNG o WEBP de hasta 10 MB.'],
        ['¿Qué pasa después de enviar?', 'Tu solicitud queda Recibida. Jefatura de TI la revisa y asigna a un responsable, quien registra la atención y la respuesta. Puedes consultar el avance con tu número de registro y clave privada.'],
        ['¿Cómo recupero mi clave?', 'En Consultar solicitud, abre ¿Olvidaste tu clave? e ingresa el número de registro y el correo que usaste al enviar. La nueva clave se envía a ese correo y dura 30 minutos.'],
        ['¿Cómo guardo mi número y mi clave?', 'Después del envío puedes copiar ambos datos o descargar la constancia PDF. La clave inicial dura siete días. El seguimiento no requiere una cuenta del sistema.'],
      ].map(([question, answer]) => <details key={question} className="border-b border-slate-200 py-4"><summary className="cursor-pointer rounded text-sm font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">{question}</summary><p className="mt-3 text-sm leading-6 text-slate-600">{answer}</p></details>)}</div></section>
    </main>
    <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-4 py-5 text-xs leading-5 text-slate-500 sm:px-6"><p>SCA-TC · Tribunal Constitucional del Perú</p><p>Registro y seguimiento de requerimientos de TI</p></div></footer>
  </div>;
}
