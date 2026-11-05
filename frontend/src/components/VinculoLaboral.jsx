import { useEffect, useState } from 'react';
import * as api from '../services/api';

const REGIMENES = ['CAS', 'CAP', 'Practicante', 'Locador de servicios', 'Personal de confianza', 'Servir'];
const WRITE_ROLES = ['administrador', 'jefatura', 'tecnico', 'almacen'];
const inputClass = 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100';
const colors = { vigente: 'bg-emerald-50 text-emerald-700', programado: 'bg-blue-50 text-blue-700', vencido: 'bg-amber-50 text-amber-800', finalizado: 'bg-slate-100 text-slate-600' };
const date = (value) => value ? String(value).slice(0, 10) : '';
const formatDate = (value) => value ? date(value).split('-').reverse().join('/') : 'Sin fecha de término';
const blank = (tipo = 'CAS') => ({ tipo_vinculo: tipo, fecha_inicio: '', fecha_fin: '', estado: 'vigente', observaciones: '', motivo_cambio: '' });

export function EstadoVinculo({ vinculo, hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) }) {
  const estado = vinculo?.estado_vigencia || (!vinculo ? 'sin registro' : !vinculo.vigente ? 'finalizado'
    : date(vinculo.fecha_inicio) > hoy ? 'programado' : vinculo.fecha_fin && date(vinculo.fecha_fin) < hoy ? 'vencido' : 'vigente');
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${colors[estado] || colors.finalizado}`}>{estado}</span>;
}

export default function VinculoLaboral({ personalId, currentUser, onClose, onSaved }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(blank());
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const canManage = WRITE_ROLES.includes(currentUser?.rol);

  const load = async () => {
    const response = await api.getVinculosLaborales(personalId);
    setData(response.data);
    return response.data;
  };
  useEffect(() => {
    let active = true;
    setLoading(true);
    api.getVinculosLaborales(personalId).then(({ data: result }) => {
      if (!active) return;
      setData(result);
      setForm(blank(result.personal.regimen_laboral));
      setShowForm(canManage && !result.vinculos.length);
    }).catch((e) => { if (active) setError(e.response?.data?.error || 'No se pudo cargar el vínculo laboral'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [personalId, canManage]);

  const edit = (vinculo) => {
    setEditing(vinculo?.id || null);
    setForm(vinculo ? { tipo_vinculo: vinculo.tipo_vinculo, fecha_inicio: date(vinculo.fecha_inicio), fecha_fin: date(vinculo.fecha_fin),
      estado: vinculo.estado, observaciones: vinculo.observaciones || '', motivo_cambio: '', version: vinculo.version }
      : blank(data.personal.regimen_laboral));
    setShowForm(true);
    setError(''); setSuccess('');
  };
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    let saved = false;
    try {
      if (editing) await api.updateVinculoLaboral(personalId, editing, form);
      else await api.createVinculoLaboral(personalId, form);
      saved = true;
      await load();
      setShowForm(false); setEditing(null);
      setSuccess('Vínculo laboral guardado. El cambio quedó registrado en el historial y la auditoría.');
      onSaved?.();
    } catch (e) { setError(saved ? 'El vínculo se guardó, pero no se pudo actualizar la vista. Recarga los datos antes de continuar.'
      : e.response?.data?.error || 'No se pudo guardar el vínculo laboral'); }
    finally { setSaving(false); }
  };
  const change = (event) => setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));

  return <div className="space-y-6">
    <button type="button" onClick={onClose} disabled={saving} className="text-sm font-semibold text-blue-700 disabled:opacity-50">← Volver a Personal</button>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Personal · CUS 12</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">Vínculo laboral</h2>
        <p className="mt-2 text-sm text-slate-500">Registra sus períodos laborales y consulta los cambios realizados.</p></div>
      {canManage && data && <button type="button" onClick={() => edit(null)} disabled={saving} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Registrar vínculo</button>}
    </div>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}
      <button type="button" onClick={async () => { setLoading(true); try { await load(); setShowForm(false); setError(''); } catch { setError('No se pudo recargar. Inténtalo nuevamente.'); } finally { setLoading(false); } }} disabled={saving} className="ml-3 font-semibold underline">Recargar datos</button></div>}
    {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div>}
    {loading ? <p className="py-10 text-center text-slate-500">Cargando vínculos laborales...</p> : data && <>
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900">Información del personal</h3>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">{[
          ['DNI', data.personal.dni], ['Nombre completo', `${data.personal.apellido}, ${data.personal.nombre}`],
          ['Área', data.personal.area || 'No registrada'], ['Cargo', data.personal.cargo || 'No registrado'],
        ].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-900">{value}</dd></div>)}</dl>
        {data.personal.estado !== 'activo' && <p className="mt-4 text-sm text-amber-800">Este trabajador está inactivo. Puedes consultar o finalizar sus vínculos; actívalo antes de habilitar uno.</p>}
      </section>
      {showForm && canManage && <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-slate-900">{editing ? 'Actualizar vínculo laboral' : 'Registrar vínculo laboral'}</h3>
        <fieldset disabled={saving} className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Tipo de vínculo
            <select required name="tipo_vinculo" value={form.tipo_vinculo} onChange={change} className={inputClass}>{REGIMENES.map((r) => <option key={r}>{r}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Estado del registro
            <select name="estado" value={form.estado} onChange={change} className={inputClass}><option value="vigente">Habilitado</option><option value="finalizado">Finalizado</option></select></label>
          <label className="text-sm font-medium text-slate-700">Fecha de inicio
            <input required type="date" name="fecha_inicio" value={form.fecha_inicio} onChange={change} className={inputClass} /></label>
          <label className="text-sm font-medium text-slate-700">Fecha de término {form.estado === 'vigente' && '(opcional)'}
            <input type="date" required={form.estado === 'finalizado'} min={form.fecha_inicio || undefined} max={form.estado === 'finalizado' ? data.fecha_consulta : undefined}
              name="fecha_fin" value={form.fecha_fin} onChange={change} className={inputClass} /></label>
          <p className="text-sm text-slate-500 md:col-span-2">La vigencia se calcula con las fechas: un vínculo futuro aparece programado y uno cuya fecha de término ya pasó aparece vencido. Deja el término vacío solo si el vínculo no tiene una fecha de fin definida.</p>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">Observaciones (opcional)
            <textarea name="observaciones" value={form.observaciones} onChange={change} maxLength={2000} rows={3} className={inputClass} /></label>
          {editing && <label className="text-sm font-medium text-slate-700 md:col-span-2">Motivo de la actualización
            <textarea required name="motivo_cambio" value={form.motivo_cambio} onChange={change} maxLength={500} rows={2} className={inputClass} /></label>}
        </fieldset>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
          <p className="text-xs text-slate-500">Los cambios quedan registrados con tu usuario, fecha y motivo.</p>
          <div className="flex gap-3"><button type="button" disabled={saving} onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar vínculo'}</button></div>
        </div>
      </form>}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-slate-900">Períodos laborales</h3>
        <p className="mt-1 text-sm text-slate-500">Consulta al {formatDate(data.fecha_consulta)} · Hora de Lima</p>
        {!data.vinculos.length ? <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Sin vínculos registrados. Para asignar equipos a personal CAS o CAP debes registrar un período vigente.</p>
          : <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="px-3 py-3">Tipo</th><th className="px-3 py-3">Inicio</th><th className="px-3 py-3">Término</th><th className="px-3 py-3">Vigencia</th>{canManage && <th className="px-3 py-3">Acciones</th>}</tr></thead>
            <tbody>{data.vinculos.map((v) => <tr key={v.id} className="border-b border-slate-100"><td className="px-3 py-4 font-medium">{v.tipo_vinculo}</td><td className="px-3 py-4">{formatDate(v.fecha_inicio)}</td><td className="px-3 py-4">{formatDate(v.fecha_fin)}</td><td className="px-3 py-4"><EstadoVinculo vinculo={v} /></td>{canManage && <td className="px-3 py-4"><button type="button" disabled={saving} onClick={() => edit(v)} className="font-semibold text-blue-700">Actualizar</button></td>}</tr>)}</tbody>
          </table></div>}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-slate-900">Historial de cambios</h3>
        {!data.historial.length ? <p className="mt-4 text-sm text-slate-500">Todavía no hay cambios registrados.</p> : <ol className="mt-5 space-y-4">{data.historial.map((h) => <li key={h.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
          <div className="flex flex-wrap justify-between gap-2"><p className="font-semibold text-slate-900">{h.operacion === 'INSERT' ? 'Registro' : 'Actualización'} · {h.usuario_nombre || 'Usuario no disponible'}</p><time className="text-xs text-slate-500">{new Date(h.created_at).toLocaleString('es-PE', { timeZone: 'America/Lima' })}</time></div>
          <p className="mt-2 text-slate-700">{h.motivo}</p>
          <p className="mt-2 text-xs text-slate-500">{h.datos_nuevos.tipo_vinculo} · {formatDate(h.datos_nuevos.fecha_inicio)} — {formatDate(h.datos_nuevos.fecha_fin)} · {h.datos_nuevos.vigente ? 'Habilitado' : 'Finalizado'}</p>
          {h.datos_anteriores && <details className="mt-3 text-xs text-slate-600"><summary className="cursor-pointer font-medium text-blue-700">Ver valores anteriores</summary><p className="mt-2">{h.datos_anteriores.tipo_vinculo} · {formatDate(h.datos_anteriores.fecha_inicio)} — {formatDate(h.datos_anteriores.fecha_fin)} · {h.datos_anteriores.vigente ? 'Habilitado' : 'Finalizado'}</p><p className="mt-1">Observaciones: {h.datos_anteriores.observaciones || 'Sin observaciones'}</p></details>}
        </li>)}</ol>}
      </section>
    </>}
  </div>;
}
