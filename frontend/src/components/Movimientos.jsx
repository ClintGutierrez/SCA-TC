import { useEffect, useMemo, useState } from 'react';
import * as api from '../services/api';

const TYPES = [
  ['asignacion', 'Asignación', 'Entrega de un bien a un trabajador.'],
  ['cambio', 'Cambio', 'Reemplazo de un equipo averiado por otro para el mismo trabajador.'],
  ['retiro', 'Retiro', 'Retiro del bien al responsable y retorno a disponible.'],
  ['prestamo', 'Préstamo', 'Entrega temporal con fecha de retorno.'],
];
const DIRECT_REGIMES = ['CAP', 'CAS', 'Personal de confianza', 'Servir'];
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const inputClass = 'mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100';
const blankForm = () => ({ bien_id: '', bien_reemplazo_id: '', personal_id: '', fecha_movimiento: today(), fecha_fin: '', motivo: '', observaciones: '' });

export default function Movimientos({ bienes = [], personal = [], canManage = false, canApprove = false }) {
  const [type, setType] = useState('asignacion');
  const [filter, setFilter] = useState('');
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [searchBien, setSearchBien] = useState('');
  const [searchPeople, setSearchPeople] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getMovimientos(filter ? { tipo: filter } : {});
      setRows(response.data);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'No se pudieron cargar los movimientos');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [filter]);

  const availableAssets = useMemo(() => bienes.filter((asset) => {
    const valid = type === 'retiro' || type === 'cambio' ? asset.estado === 'asignado' : asset.estado === 'activo';
    const query = `${asset.codigo_patrimonial || ''} ${asset.nombre || ''} ${asset.tipo || ''} ${asset.numero_serie || ''}`.toLowerCase();
    return valid && query.includes(searchBien.trim().toLowerCase());
  }), [bienes, type, searchBien]);
  const replacementAssets = useMemo(() => bienes.filter((asset) => {
    const query = `${asset.codigo_patrimonial || ''} ${asset.nombre || ''} ${asset.tipo || ''} ${asset.numero_serie || ''}`.toLowerCase();
    return asset.estado === 'activo' && String(asset.id) !== String(form.bien_id)
      && query.includes(searchBien.trim().toLowerCase());
  }), [bienes, form.bien_id, searchBien]);
  const activePeople = useMemo(() => personal.filter((person) => (type === 'retiro' || person.estado === 'activo')
    && `${person.nombre} ${person.apellido} ${person.dni} ${person.regimen_laboral}`.toLowerCase().includes(searchPeople.trim().toLowerCase())), [personal, searchPeople, type]);
  const selectedPerson = personal.find((person) => String(person.id) === String(form.personal_id));
  const recipient = selectedPerson;
  const requiresApproval = type !== 'retiro' && recipient && !DIRECT_REGIMES.includes(recipient.regimen_laboral);
  const managerIncomplete = requiresApproval && (!recipient.jefe_inmediato || !recipient.correo_jefe);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.createMovimiento({ ...form, tipo: type });
      setForm(blankForm());
      setSearchBien('');
      setSearchPeople('');
      const emailStatus = response.data.email?.status;
      setMessage(emailStatus === 'sent'
        ? `Movimiento registrado. Documento enviado a ${response.data.email.to}.`
        : `Movimiento registrado (${response.data.estado}). ${response.data.email?.reason || 'Puedes imprimir el documento desde el historial.'}`);
      await load();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'No se pudo registrar el movimiento');
    } finally {
      setSaving(false);
    }
  };

  const openDocument = async (id) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Permite las ventanas emergentes para abrir el documento imprimible');
      return;
    }
    try {
      const response = await api.getMovimientoDocumento(id);
      printWindow.document.open();
      printWindow.document.write(response.data);
      printWindow.document.close();
    } catch (requestError) {
      printWindow.close();
      setError(requestError?.response?.data?.error || 'No se pudo generar el documento');
    }
  };

  const resolveApproval = async (id, aprobado) => {
    setError('');
    setMessage('');
    try {
      await api.resolverMovimiento(id, { aprobado });
      setMessage(aprobado ? 'Autorización registrada.' : 'Movimiento rechazado.');
      await load();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'No se pudo resolver la autorización');
    }
  };

  const closeLoan = async (id) => {
    setError('');
    try {
      await api.registrarRetornoPrestamo(id, { fecha_retorno: today() });
      setMessage('Retorno del préstamo registrado; el bien volvió a estar disponible.');
      await load();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'No se pudo registrar el retorno');
    }
  };

  const setField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'bien_id' ? { bien_reemplazo_id: '' } : {}),
    }));
  };
  const needsPerson = ['asignacion', 'cambio', 'prestamo'].includes(type) || type === 'retiro';

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">Control patrimonial</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">Movimientos patrimoniales</h2>
        <p className="mt-2 text-sm text-slate-500">Registra asignaciones, reemplazos de equipos averiados, retiros y préstamos con autorización y documento imprimible.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {TYPES.map(([key, label, description]) => (
          <button key={key} type="button" onClick={() => { setType(key); setForm(blankForm()); }}
            className={`rounded-2xl border p-4 text-left transition ${type === key ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-blue-300'}`}>
            <span className="font-semibold text-slate-900">{label}</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
          </button>
        ))}
      </div>

      {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {message && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}

      {canManage && (
        <form onSubmit={submit} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-950">Registrar {TYPES.find(([key]) => key === type)?.[1].toLowerCase()}</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Buscar bien
              <input value={searchBien} onChange={(event) => setSearchBien(event.target.value)} placeholder="Código patrimonial, nombre o serie" className={inputClass} />
              <select required name="bien_id" value={form.bien_id} onChange={setField} className={inputClass}>
                <option value="">Selecciona un bien {type === 'cambio' || type === 'retiro' ? 'asignado' : 'disponible'}</option>
                {availableAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.codigo_patrimonial || 'Sin código'} · {asset.nombre} · {asset.numero_serie || 'Sin serie'}</option>)}
              </select>
            </label>

            {needsPerson && (
              <label className="block text-sm font-medium text-slate-700">
                {type === 'cambio' || type === 'retiro' ? 'Responsable actual del equipo' : 'Trabajador responsable'}
                <input value={searchPeople} onChange={(event) => setSearchPeople(event.target.value)} placeholder="Buscar por nombre, DNI o régimen" className={inputClass} />
                <select required name="personal_id" value={form.personal_id} onChange={setField} className={inputClass}>
                  <option value="">Selecciona personal activo</option>
                  {activePeople.map((person) => <option key={person.id} value={person.id}>{person.apellido}, {person.nombre} · {person.dni} · {person.regimen_laboral}</option>)}
                </select>
              </label>
            )}

            {type === 'cambio' && (
              <label className="block text-sm font-medium text-slate-700">
                Equipo de reemplazo disponible
                <select required name="bien_reemplazo_id" value={form.bien_reemplazo_id} onChange={setField} className={inputClass}>
                  <option value="">Selecciona el equipo sustituto</option>
                  {replacementAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.codigo_patrimonial || 'Sin código'} · {asset.nombre} · {asset.numero_serie || 'Sin serie'}</option>)}
                </select>
              </label>
            )}

            <label className="block text-sm font-medium text-slate-700">
              Fecha del movimiento
              <input required type="date" name="fecha_movimiento" value={form.fecha_movimiento} onChange={setField} className={inputClass} />
            </label>
            {type === 'prestamo' && <label className="block text-sm font-medium text-slate-700">Fecha prevista de devolución<input required type="date" min={form.fecha_movimiento} name="fecha_fin" value={form.fecha_fin} onChange={setField} className={inputClass} /></label>}
            <label className="block text-sm font-medium text-slate-700">Motivo<input required name="motivo" value={form.motivo} onChange={setField} className={inputClass} /></label>
            <label className="block text-sm font-medium text-slate-700">Observaciones<textarea name="observaciones" value={form.observaciones} onChange={setField} rows="3" className={inputClass} /></label>
          </div>
          {recipient && (
            <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${requiresApproval ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
              {type === 'retiro' ? 'El retiro puede registrarse aunque el trabajador esté inactivo o su vínculo haya terminado.' : requiresApproval
                ? managerIncomplete
                  ? 'Falta registrar el jefe inmediato y su correo en Personal; no se puede solicitar autorización todavía.'
                  : `Este movimiento quedará pendiente de autorización del jefe inmediato (${recipient.correo_jefe}).`
                : `El documento se enviará directamente al correo institucional ${recipient.correo_institucional} (régimen ${recipient.regimen_laboral}).`}
            </div>
          )}
          {type !== 'retiro' && <p className="mt-3 text-sm text-slate-500">Para personal CAS o CAP se requiere un vínculo vigente en la fecha del movimiento. Regístralo o actualízalo desde Personal → Vínculo laboral.</p>}
          <button type="submit" disabled={saving || managerIncomplete} className="mt-5 rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'Registrando...' : 'Registrar movimiento y generar documento'}
          </button>
        </form>
      )}

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
          <div><h3 className="text-lg font-semibold text-slate-950">Historial de movimientos</h3><p className="text-sm text-slate-500">{rows.length} registros</p></div>
          <select aria-label="Filtrar tipo de movimiento" value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Todos los movimientos</option>
            {TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
        {loading ? <p className="p-8 text-center text-sm text-slate-500">Cargando movimientos...</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Movimiento</th><th className="px-4 py-3">Bien / reemplazo</th><th className="px-4 py-3">Responsable</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Documento / acción</th></tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-4 capitalize">{row.tipo}</td>
                  <td className="px-4 py-4">{row.bien_nombre}<span className="block text-xs text-slate-500">{row.numero_serie || 'Sin serie'}</span>{row.bien_reemplazo_nombre && <span className="mt-2 block text-xs text-blue-700">Reemplazo: {row.bien_reemplazo_nombre} · {row.reemplazo_numero_serie || 'Sin serie'}</span>}</td>
                  <td className="px-4 py-4">{row.personal_nombre || '—'}{row.personal_destino_nombre && <span className="block text-xs text-slate-500">Nuevo: {row.personal_destino_nombre}</span>}</td>
                  <td className="px-4 py-4">{String(row.fecha_movimiento || '').slice(0, 10)}{row.fecha_fin && <span className="block text-xs text-slate-500">Hasta {String(row.fecha_fin).slice(0, 10)}</span>}</td>
                  <td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs capitalize">{row.estado}</span></td>
                  <td className="space-x-3 whitespace-nowrap px-4 py-4">
                    <button type="button" onClick={() => openDocument(row.id)} className="font-semibold text-blue-700">Imprimir documento</button>
                    {row.tipo === 'prestamo' && row.estado === 'aprobado' && canManage && <button type="button" onClick={() => closeLoan(row.id)} className="font-semibold text-indigo-700">Registrar retorno</button>}
                    {row.estado === 'pendiente' && canApprove && <>
                      <button type="button" onClick={() => resolveApproval(row.id, true)} className="font-semibold text-emerald-700">Autorizar</button>
                      <button type="button" onClick={() => resolveApproval(row.id, false)} className="font-semibold text-rose-700">Rechazar</button>
                    </>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
            {!rows.length && <p className="p-8 text-center text-sm text-slate-500">No hay movimientos para mostrar.</p>}
          </div>
        )}
      </section>
    </div>
  );
}
