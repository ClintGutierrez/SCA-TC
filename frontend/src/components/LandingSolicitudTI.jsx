import { useState } from 'react';
import {
  AREAS_SUGERIDAS_TC,
  EQUIPOS_PERIFERICOS_TI,
  SEDES_TC,
  TIPOS_DOCUMENTO_OFICIAL,
  TIPOS_SOLICITUD_TI,
  getEquipoLabel,
  getTipoLabel,
} from '../utils/solicitudesStorage';
import { registrarSolicitudTI } from '../services/api';
import SeguimientoTI from './SeguimientoTI';

const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE = 10 * 1024 * 1024;

const blankForm = () => ({
  tipoSolicitud: 'nuevo_usuario',
  solicitanteNombre: '',
  solicitanteCorreo: '',
  solicitanteDni: '',
  solicitanteArea: '',
  solicitanteCargo: '',
  mismoSolicitante: false,
  beneficiarioNombre: '',
  beneficiarioDni: '',
  beneficiarioCargo: '',
  sede: 'Sede Central',
  oficina: '',
  sedeOrigen: 'Sede Central',
  oficinaOrigen: '',
  equipoCategoria: 'laptop',
  codigoActual: '',
  equipoDetalle: '',
  justificacion: '',
  tipoDocumento: 'Memorando',
  numeroDocumento: '',
});

const inputClass = 'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100';

export default function LandingSolicitudTI({ currentUser, onGoToAccess, onGoToPanelInbox }) {
  const [form, setForm] = useState(blankForm);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [enviada, setEnviada] = useState(null);
  const [showSeguimiento, setShowSeguimiento] = useState(false);

  const esCambioUbicacion = form.tipoSolicitud === 'cambio_ubicacion';

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    let next = type === 'checkbox' ? checked : value;
    if (name === 'solicitanteDni' || name === 'beneficiarioDni') {
      next = String(value).replace(/\D/g, '').slice(0, 8);
    }
    setForm((prev) => ({ ...prev, [name]: next }));
  };

  const handleTipoChange = (key) => {
    setForm((prev) => ({
      ...prev,
      tipoSolicitud: key,
      mismoSolicitante: key === 'nuevo_usuario' ? false : prev.mismoSolicitante,
      equipoCategoria: key === 'impresora_escaner' ? 'impresora' : prev.equipoCategoria,
    }));
  };

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0] || null;
    if (!selected) {
      setFile(null);
      return;
    }
    if (!ALLOWED_TYPES.has(selected.type)) {
      setError('El documento oficial debe ser un archivo PDF, JPG, PNG o WEBP.');
      event.target.value = '';
      setFile(null);
      return;
    }
    if (selected.size > MAX_SIZE) {
      setError('El archivo adjunto no debe superar los 10 MB.');
      event.target.value = '';
      setFile(null);
      return;
    }
    setError('');
    setFile(selected);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!/^\d{8}$/.test(form.solicitanteDni)) {
      setError('El DNI del solicitante debe tener 8 dígitos.');
      return;
    }
    if (!form.mismoSolicitante && !/^\d{8}$/.test(form.beneficiarioDni)) {
      setError('El DNI del beneficiario debe tener 8 dígitos.');
      return;
    }
    if (!file) {
      setError('Debe adjuntar un documento oficial para enviar la solicitud.');
      return;
    }

    setSaving(true);
    try {
      let response;
      try { response = await registrarSolicitudTI(form, file); }
      catch (requestError) {
        if (!requestError.response?.data?.duplicada || !window.confirm(requestError.response.data.error)) throw requestError;
        response = await registrarSolicitudTI({ ...form, confirmarDuplicado: true }, file);
      }
      const registro = response.data;
      setEnviada({ ...registro,
        tipoSolicitud: form.tipoSolicitud,
        solicitante: { nombre: form.solicitanteNombre, dni: form.solicitanteDni, correo: form.solicitanteCorreo, area: form.solicitanteArea, cargo: form.solicitanteCargo },
        beneficiario: { nombre: form.mismoSolicitante ? form.solicitanteNombre : form.beneficiarioNombre },
        ubicacion: { sede: form.sede, oficina: form.oficina },
        equipo: { categoria: form.equipoCategoria },
        documento: { tipo: form.tipoDocumento, numero: form.numeroDocumento, archivo: file.name },
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'No se pudo registrar la solicitud.');
    } finally {
      setSaving(false);
    }
  };

  const nuevaSolicitud = () => {
    setEnviada(null);
    setForm(blankForm());
    setFile(null);
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tribunal Constitucional del Perú
            </p>
            <h1 className="text-lg font-semibold text-slate-900">
              Formulario de Solicitud de TI
            </h1>
          </div>

          <button
            type="button"
            onClick={currentUser ? onGoToPanelInbox : onGoToAccess}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {currentUser ? 'Ir a SCA-TC' : 'Acceso al sistema'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex gap-3">
          <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium" onClick={() => setShowSeguimiento(false)}>Nueva solicitud</button>
          <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium" onClick={() => setShowSeguimiento(true)}>Seguimiento de solicitud</button>
        </div>
        {showSeguimiento ? <SeguimientoTI initialCode={enviada?.codigo} initialKey={enviada?.clave} /> : <>
        {enviada ? (
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="border-b border-slate-200 pb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Solicitud enviada a SCA-TC
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">
                Código de registro: {enviada.codigo}
              </h2>
              <p className="mt-3 text-sm text-slate-600">Guarde esta clave privada para consultar su solicitud durante 7 días. Después puede solicitar otra por correo.</p>
              <p className="mt-2 break-all rounded-lg bg-slate-100 p-3 font-mono text-sm">{enviada.clave}</p>
            </div>

            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Tipo de solicitud</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{getTipoLabel(enviada.tipoSolicitud)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Solicitante</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {enviada.solicitante.nombre} (DNI {enviada.solicitante.dni})
                </dd>
                <dd className="text-slate-600">{enviada.solicitante.correo} · {enviada.solicitante.area} · {enviada.solicitante.cargo}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Beneficiario y ubicación</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{enviada.beneficiario.nombre}</dd>
                <dd className="text-slate-600">{enviada.ubicacion.sede} — {enviada.ubicacion.oficina}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Equipo y documento adjunto</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{getEquipoLabel(enviada.equipo.categoria)}</dd>
                <dd className="text-slate-600">{enviada.documento.tipo}: {enviada.documento.numero} ({enviada.documento.archivo})</dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={nuevaSolicitud}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Registrar otra solicitud
              </button>
              <button
                type="button"
                onClick={currentUser ? onGoToPanelInbox : onGoToAccess}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {currentUser ? 'Ver solicitudes en SCA-TC' : 'Volver al inicio de sesión'}
              </button>
            </div>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            {error && (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            {/* 1. Catálogo de tipos de solicitud */}
            <section>
              <h2 className="text-base font-semibold text-slate-900">Tipo de solicitud</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {TIPOS_SOLICITUD_TI.map(([key, label, description]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleTipoChange(key)}
                    className={`rounded-lg border p-3.5 text-left transition ${
                      form.tipoSolicitud === key
                        ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="block text-sm font-semibold text-slate-900">{label}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* 2. Identificación del solicitante */}
            <section className="border-t border-slate-200 pt-6">
              <h2 className="text-base font-semibold text-slate-900">Datos del solicitante</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="block text-sm font-medium text-slate-700">
                  Nombres y apellidos *
                  <input
                    required
                    type="text"
                    name="solicitanteNombre"
                    value={form.solicitanteNombre}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  DNI *
                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    name="solicitanteDni"
                    value={form.solicitanteDni}
                    onChange={handleChange}
                    placeholder="8 dígitos"
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Correo institucional *
                  <input
                    required
                    type="email"
                    name="solicitanteCorreo"
                    value={form.solicitanteCorreo}
                    onChange={handleChange}
                    placeholder="usuario@tc.gob.pe"
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700 lg:col-span-2">
                  Área *
                  <input
                    required
                    type="text"
                    name="solicitanteArea"
                    list="areas-tc"
                    value={form.solicitanteArea}
                    onChange={handleChange}
                    className={inputClass}
                  />
                  <datalist id="areas-tc">
                    {AREAS_SUGERIDAS_TC.map((area) => (
                      <option key={area} value={area} />
                    ))}
                  </datalist>
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Cargo *
                  <input
                    required
                    type="text"
                    name="solicitanteCargo"
                    value={form.solicitanteCargo}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </label>
              </div>
            </section>

            {/* 3. Datos de la solicitud */}
            <section className="border-t border-slate-200 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-900">Detalle de la solicitud</h2>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="mismoSolicitante"
                    checked={form.mismoSolicitante}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  El beneficiario es el mismo solicitante
                </label>
              </div>

              {!form.mismoSolicitante && (
                <div className="mt-4 grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Nombre del beneficiario *
                    <input
                      required
                      type="text"
                      name="beneficiarioNombre"
                      value={form.beneficiarioNombre}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                  DNI del beneficiario *
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={8}
                      name="beneficiarioDni"
                      required
                      value={form.beneficiarioDni}
                      onChange={handleChange}
                      placeholder="8 dígitos"
                      className={inputClass}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Cargo / régimen *
                    <input
                      required
                      type="text"
                      name="beneficiarioCargo"
                      value={form.beneficiarioCargo}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </label>
                </div>
              )}

              {esCambioUbicacion && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Sede actual (origen) *
                    <select name="sedeOrigen" value={form.sedeOrigen} onChange={handleChange} className={inputClass}>
                      {SEDES_TC.map((sede) => <option key={sede} value={sede}>{sede}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Oficina / piso actual (origen) *
                    <input
                      required
                      type="text"
                      name="oficinaOrigen"
                      value={form.oficinaOrigen}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </label>
                </div>
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  {esCambioUbicacion ? 'Nueva sede (destino) *' : 'Sede *'}
                  <select name="sede" value={form.sede} onChange={handleChange} className={inputClass}>
                    {SEDES_TC.map((sede) => <option key={sede} value={sede}>{sede}</option>)}
                  </select>
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  {esCambioUbicacion ? 'Nueva oficina / piso (destino) *' : 'Ubicación (oficina / piso) *'}
                  <input
                    required
                    type="text"
                    name="oficina"
                    value={form.oficina}
                    onChange={handleChange}
                    placeholder="Ej. Piso 3 - Oficina 302"
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Equipo o periférico *
                  <select name="equipoCategoria" value={form.equipoCategoria} onChange={handleChange} className={inputClass}>
                    {EQUIPOS_PERIFERICOS_TI.filter(([val]) => form.tipoSolicitud !== 'impresora_escaner' || ['impresora','escaner'].includes(val)).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Código patrimonial o serie {['cambio_equipo','cambio_ubicacion'].includes(form.tipoSolicitud) ? '*' : '(si aplica)'}
                  <input
                    type="text"
                    name="codigoActual"
                    required={['cambio_equipo','cambio_ubicacion'].includes(form.tipoSolicitud)}
                    value={form.codigoActual}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                  Detalle del requerimiento *
                  <input
                    required
                    type="text"
                    name="equipoDetalle"
                    value={form.equipoDetalle}
                    onChange={handleChange}
                    placeholder="Especifique el equipo, periférico o servicio requerido"
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                  Justificación *
                  <textarea
                    required
                    rows={3}
                    name="justificacion"
                    value={form.justificacion}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </label>
              </div>
            </section>

            {/* 4. Documento oficial */}
            <section className="border-t border-slate-200 pt-6">
              <h2 className="text-base font-semibold text-slate-900">Documento oficial</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Tipo de documento *
                  <select name="tipoDocumento" value={form.tipoDocumento} onChange={handleChange} className={inputClass}>
                    {TIPOS_DOCUMENTO_OFICIAL.map((doc) => <option key={doc} value={doc}>{doc}</option>)}
                  </select>
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Número o referencia *
                  <input
                    required
                    type="text"
                    name="numeroDocumento"
                    value={form.numeroDocumento}
                    onChange={handleChange}
                    placeholder="Ej. Memorando N.º 0145-2026-SG/TC"
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                  Archivo adjunto (PDF, JPG, PNG — obligatorio) *
                  <input
                    required
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                  />
                </label>
              </div>
            </section>

            <div className="flex justify-end border-t border-slate-200 pt-5">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </div>
          </form>
        )}
        </>}
      </main>
    </div>
  );
}
