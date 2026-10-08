import { useEffect, useMemo, useState } from 'react';
import * as api from '../services/api';

const emptyForm = {
  nombre: '', apellido: '', dni: '', correo_institucional: '', numero_celular: '',
  regimen_laboral: '', oficina: '', area: '', sede: '', piso: '', estado: 'activo',
};
const inputClass = 'mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100';
const REGIMENES_LABORALES = ['Practicante', 'Locador de servicios', 'CAS', 'CAP', 'Personal de confianza', 'Servir'];
const SEDES = ['Centro de Lima', 'Sede Central', 'Centro de estudios constitucionales', 'Sede Arequipa'];
const fields = [
  ['nombre', 'Nombre', 'text'], ['apellido', 'Apellido', 'text'], ['dni', 'DNI', 'text'],
  ['correo_institucional', 'Correo institucional', 'email'], ['numero_celular', 'Número celular', 'tel'],
  ['oficina', 'Oficina', 'text'], ['area', 'Área', 'text'], ['piso', 'Piso', 'text'],
];

export default function Personal({ personal: initialPersonal = [], onRefresh, currentUser }) {
  const [personal, setPersonal] = useState(initialPersonal);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const canEdit = ['administrador', 'jefatura'].includes(currentUser?.rol);

  useEffect(() => setPersonal(initialPersonal), [initialPersonal]);
  useEffect(() => { loadPersonal(); }, []);

  const loadPersonal = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getPersonal();
      setPersonal(response.data);
      onRefresh?.();
    } catch (loadError) {
      setError(loadError?.response?.data?.error || 'No se pudo cargar el personal');
    } finally {
      setLoading(false);
    }
  };

  const filteredPersonal = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return personal;
    return personal.filter((item) => [
      item.nombre, item.apellido, item.dni, item.correo_institucional, item.regimen_laboral,
      item.oficina, item.area, item.sede, item.piso,
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [personal, search]);

  const changeField = (event) => setFormData((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  const resetForm = () => { setFormData(emptyForm); setEditingId(null); setShowForm(false); };
  const edit = (item) => {
    setEditingId(item.id);
    setFormData(Object.fromEntries(Object.keys(emptyForm).map((key) => [key, item[key] || emptyForm[key]])));
    setShowForm(true);
  };
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingId) await api.updatePersonal(editingId, formData);
      else await api.createPersonal(formData);
      await loadPersonal();
      resetForm();
    } catch (saveError) {
      setError(saveError?.response?.data?.error || 'No se pudo guardar el personal');
    } finally {
      setSaving(false);
    }
  };
  const disable = async (id) => {
    if (!window.confirm('¿Deseas marcar este registro de personal como inactivo?')) return;
    setSaving(true);
    setError('');
    try {
      await api.disablePersonal(id);
      await loadPersonal();
    } catch (disableError) {
      setError(disableError?.response?.data?.error || 'No se pudo deshabilitar el personal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">Directorio institucional</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Personal de la institución</h2>
          <p className="mt-2 text-sm text-slate-500">Independiente de los usuarios que tienen acceso al sistema.</p>
        </div>
        {canEdit && <button type="button" onClick={() => setShowForm((value) => !value)} className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white">{showForm ? 'Cerrar formulario' : 'Nuevo personal'}</button>}
      </div>
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {showForm && canEdit && (
        <form onSubmit={submit} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-950">{editingId ? 'Editar personal' : 'Registrar personal'}</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {fields.map(([name, label, type]) => (
              <label key={name} className="block">
                <span className="text-sm font-medium text-slate-700">{label}</span>
                <input type={type} name={name} value={formData[name]} onChange={changeField} className={inputClass} required={['nombre', 'apellido', 'dni', 'correo_institucional', 'regimen_laboral'].includes(name)} />
              </label>
            ))}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Régimen laboral</span>
              <select name="regimen_laboral" value={formData.regimen_laboral} onChange={changeField} className={inputClass} required>
                <option value="">Selecciona un régimen</option>
                {REGIMENES_LABORALES.map((regimen) => <option key={regimen} value={regimen}>{regimen}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Sede</span>
              <select name="sede" value={formData.sede} onChange={changeField} className={inputClass}>
                <option value="">Selecciona una sede</option>
                {SEDES.map((sede) => <option key={sede} value={sede}>{sede}</option>)}
              </select>
            </label>
            <label className="block"><span className="text-sm font-medium text-slate-700">Estado</span><select name="estado" value={formData.estado} onChange={changeField} className={inputClass}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></label>
          </div>
          <div className="mt-5 flex gap-3"><button type="submit" disabled={saving} className="rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar personal'}</button><button type="button" onClick={resetForm} className="rounded-2xl border border-slate-200 px-5 py-3 font-semibold text-slate-600">Cancelar</button></div>
        </form>
      )}
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-xl font-semibold text-slate-950">Personal registrado</h3><p className="text-sm text-slate-500">{filteredPersonal.length} de {personal.length} registros</p></div><input aria-label="Buscar personal" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, DNI, área o sede" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm sm:w-80" /></div>
        {loading ? <p className="py-8 text-center text-sm text-slate-500">Cargando personal...</p> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Nombre completo</th><th className="px-3 py-3">DNI</th><th className="px-3 py-3">Correo</th><th className="px-3 py-3">Régimen</th><th className="px-3 py-3">Ubicación</th><th className="px-3 py-3">Estado</th>{canEdit && <th className="px-3 py-3">Acciones</th>}</tr></thead><tbody>{filteredPersonal.map((item) => <tr key={item.id} className="border-b border-slate-100"><td className="px-3 py-4 font-medium text-slate-900">{item.apellido}, {item.nombre}</td><td className="px-3 py-4 text-slate-600">{item.dni}</td><td className="px-3 py-4 text-slate-600">{item.correo_institucional}</td><td className="px-3 py-4 text-slate-600">{item.regimen_laboral}</td><td className="px-3 py-4 text-slate-600">{[item.sede, item.oficina, item.area, item.piso && `Piso ${item.piso}`].filter(Boolean).join(' · ') || 'Sin ubicación'}</td><td className="px-3 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.estado === 'activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{item.estado}</span></td>{canEdit && <td className="px-3 py-4"><div className="flex gap-2"><button type="button" onClick={() => edit(item)} className="font-semibold text-blue-600">Editar</button>{item.estado === 'activo' && <button type="button" onClick={() => disable(item.id)} className="font-semibold text-rose-600">Deshabilitar</button>}</div></td>}</tr>)}</tbody></table></div>}
      </div>
    </div>
  );
}
