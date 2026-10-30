import { useEffect, useId, useMemo, useRef, useState } from 'react';
import * as api from '../services/api';
import VinculoLaboral, { EstadoVinculo } from './VinculoLaboral';

const emptyForm = {
  nombre: '', apellido: '', dni: '', correo_institucional: '', numero_celular: '',
  regimen_laboral: '', oficina: '', area: '', cargo: '', sede: '', piso: '', jefe_inmediato: '', correo_jefe: '', estado: 'activo',
};
const REGIMENES = ['Practicante', 'Locador de servicios', 'CAS', 'CAP', 'Personal de confianza', 'Servir'];
const SEDES = ['Centro de Lima', 'Sede Central', 'Centro de estudios constitucionales', 'Sede Arequipa'];
const REQUIRED = ['nombre', 'apellido', 'dni', 'correo_institucional', 'regimen_laboral'];
const cx = (...values) => values.filter(Boolean).join(' ');
const inputClass = (error) => cx('mt-2 block w-full min-w-0 rounded-xl border bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600',
  error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-50');
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-wait disabled:opacity-60';
const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:opacity-50';
const fullName = (person) => person.apellido + ', ' + person.nombre;
const initials = (person) => (person.nombre?.[0] || '') + (person.apellido?.[0] || '');
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function Icon({ name, className = 'h-5 w-5' }) {
  const paths = {
    person: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    location: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    briefcase: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 6h18v14H3ZM3 11a22 22 0 0 0 18 0M10 12h4',
    plus: 'M12 5v14M5 12h14',
    search: 'm21 21-4.5-4.5M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    check: 'm5 12 4 4L19 6',
    close: 'm6 6 12 12M6 18 18 6',
    arrow: 'M5 12h14m-5-5 5 5-5 5',
    down: 'm6 9 6 6 6-6',
    refresh: 'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1',
    lock: 'M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5Z',
  };
  return <svg className={cx('shrink-0', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.person} /></svg>;
}

function Field({ name, label, required, error, hint, className, children }) {
  return <div className={cx('min-w-0', className)}>
    <label htmlFor={'personal-' + name} className="block text-sm font-semibold text-slate-700">{label}
      {required && <span className="ml-1 text-blue-600" aria-hidden="true">*</span>}</label>
    {children}
    {error ? <p id={'personal-' + name + '-help'} className="mt-2 text-xs leading-5 text-rose-600">{error}</p>
      : hint && <p id={'personal-' + name + '-help'} className="mt-2 text-xs leading-5 text-slate-500">{hint}</p>}
  </div>;
}

function FormSection({ number, icon, title, description, columns = 'xl:grid-cols-3', children }) {
  return <section className="py-6 first:pt-0 last:pb-0" aria-labelledby={'personal-section-' + number}>
    <div className="mb-5 flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon name={icon} /></span>
      <div><h4 id={'personal-section-' + number} className="text-base font-semibold text-slate-900">{title}</h4>
        <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p></div>
    </div>
    <div className={cx('grid gap-x-5 gap-y-5 md:grid-cols-2', columns)}>{children}</div>
  </section>;
}

function ManagerSelect({ people, value, onSelect, error, onBlur, disabled }) {
  const uid = useId();
  const container = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = people.find((p) => String(p.id) === String(value));
  const options = people.filter((p) => p.estado === 'activo' && normalize(fullName(p) + ' ' + p.dni + ' ' + p.correo_institucional).includes(normalize(query)));

  useEffect(() => {
    const close = (event) => { if (!container.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  useEffect(() => {
    if (open) container.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const choose = (person) => { onSelect(person); setOpen(false); setQuery(''); setActiveIndex(0); };
  return <div ref={container} className="relative" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); onBlur(); }
  }}>
    <div className="relative">
      <input id="personal-jefe_inmediato" name="jefe_inmediato" role="combobox" aria-autocomplete="list"
        aria-expanded={open} aria-controls={uid + '-list'} aria-activedescendant={open && options[activeIndex] ? uid + '-' + activeIndex : undefined}
        aria-invalid={Boolean(error)} aria-describedby={error ? 'personal-jefe_inmediato-help' : undefined}
        autoComplete="off" disabled={disabled} placeholder="Buscar por nombre o DNI"
        value={open ? query : selected ? fullName(selected) : value ? 'Jefe no disponible; selecciona otro' : ''}
        onFocus={() => { setOpen(true); setQuery(''); setActiveIndex(0); }}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveIndex(0); if (value) onSelect(null); }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return; }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setOpen(true);
            setActiveIndex((index) => Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
          }
          if (event.key === 'Enter' && open) { event.preventDefault(); if (options[activeIndex]) choose(options[activeIndex]); }
        }} className={cx(inputClass(error), 'pr-11')} />
      {value ? <button type="button" disabled={disabled} onClick={() => choose(null)} aria-label="Quitar jefe seleccionado"
        className="absolute bottom-0 right-0 flex h-11 w-10 items-center justify-center text-slate-400 hover:text-slate-700"><Icon name="close" className="h-4 w-4" /></button>
        : <span className="pointer-events-none absolute bottom-0 right-0 flex h-11 w-10 items-center justify-center text-slate-400"><Icon name="search" className="h-4 w-4" /></span>}
    </div>
    {open && <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
      <div id={uid + '-list'} role="listbox" aria-label="Jefes disponibles" className="max-h-64 overflow-y-auto p-1.5">
        {options.map((p, index) => <button key={p.id} id={uid + '-' + index} type="button" role="option" aria-selected={activeIndex === index}
          onPointerDown={(event) => event.preventDefault()} onClick={() => choose(p)} onMouseEnter={() => setActiveIndex(index)}
          className={cx('block w-full rounded-lg px-3 py-2.5 text-left', index === activeIndex ? 'bg-blue-50' : 'hover:bg-slate-50')}>
          <span className="block text-sm font-medium text-slate-900">{fullName(p)}</span>
          <span className="mt-1 block break-all text-xs text-slate-500">DNI {p.dni} · {p.correo_institucional}</span>
        </button>)}
        {!options.length && <p className="px-3 py-4 text-sm leading-6 text-slate-500">{people.some((p) => p.estado === 'activo')
          ? 'No encontramos coincidencias. Prueba con otro nombre o DNI.' : 'Aún no hay personal activo para seleccionar. Puedes asignar un jefe después.'}</p>}
      </div>
    </div>}
  </div>;
}

function validateForm(form, people, editingId) {
  const errors = {};
  const labels = { nombre: 'los nombres', apellido: 'los apellidos', dni: 'el DNI', correo_institucional: 'el correo institucional', regimen_laboral: 'el régimen laboral' };
  REQUIRED.forEach((name) => { if (!String(form[name]).trim()) errors[name] = 'Ingresa ' + labels[name] + '.'; });
  if (form.dni && !/^\d{8}$/.test(form.dni)) errors.dni = 'El DNI debe tener exactamente 8 dígitos.';
  if (form.correo_institucional && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo_institucional.trim())) errors.correo_institucional = 'Ingresa un correo válido, por ejemplo nombre@tc.gob.pe.';
  if (form.numero_celular && !/^[0-9+() -]{7,20}$/.test(form.numero_celular.trim())) errors.numero_celular = 'Usa entre 7 y 20 caracteres: números, espacios, +, paréntesis o guiones.';
  if (form.jefe_inmediato) {
    const manager = people.find((p) => String(p.id) === String(form.jefe_inmediato));
    if (!manager || manager.estado !== 'activo' || String(manager.id) === String(editingId)) errors.jefe_inmediato = 'Selecciona un jefe activo diferente al trabajador.';
    else if (normalize(form.correo_jefe) !== normalize(manager.correo_institucional)) errors.jefe_inmediato = 'Vuelve a seleccionar al jefe para actualizar su correo.';
  } else if (form.correo_jefe) errors.jefe_inmediato = 'Selecciona al jefe al que corresponde este correo.';
  return errors;
}

export default function Personal({ personal: initialPersonal = [], onRefresh, currentUser }) {
  const [personal, setPersonal] = useState(initialPersonal);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState(null);
  const [vinculoPersonalId, setVinculoPersonalId] = useState(null);
  const formRef = useRef(null);
  const canEdit = ['administrador', 'jefatura'].includes(currentUser?.rol);
  const canManageVinculo = ['administrador', 'jefatura', 'tecnico', 'almacen'].includes(currentUser?.rol);

  useEffect(() => setPersonal(initialPersonal), [initialPersonal]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    api.getPersonal().then(({ data }) => { if (active) setPersonal(data); })
      .catch((error) => { if (active) setLoadError(error.response?.data?.error || 'No se pudo cargar el directorio.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const loadPersonal = async () => {
    setLoading(true); setLoadError('');
    try { const { data } = await api.getPersonal(); setPersonal(data); }
    catch (error) { setLoadError(error.response?.data?.error || 'No se pudo actualizar el directorio. Intenta recargarlo.'); }
    finally { setLoading(false); }
  };
  const notifyParent = async () => { try { await onRefresh?.(); } catch { /* El directorio puede recargarse desde esta pantalla. */ } };
  const filteredPersonal = useMemo(() => personal.filter((p) => (!statusFilter || p.estado === statusFilter)
    && normalize([p.nombre, p.apellido, p.dni, p.correo_institucional, p.regimen_laboral, p.oficina, p.area, p.cargo, p.sede, p.piso, p.jefe_inmediato_nombre, p.correo_jefe].join(' ')).includes(normalize(search))), [personal, search, statusFilter]);

  const resetForm = () => { setFormData(emptyForm); setEditingId(null); setShowForm(false); setFieldErrors({}); setFormError(''); };
  const scrollToForm = () => requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  const startNew = () => { resetForm(); setSuccess(null); setShowForm(true); scrollToForm(); };
  const edit = (item) => {
    setEditingId(item.id);
    setFormData(Object.fromEntries(Object.keys(emptyForm).map((key) => [key, item[key] ?? emptyForm[key]])));
    setFieldErrors({}); setFormError(''); setSuccess(null); setShowForm(true); scrollToForm();
  };
  const clearError = (name) => setFieldErrors((previous) => { const next = { ...previous }; delete next[name]; return next; });
  const changeField = (event) => {
    const { name } = event.target;
    const value = name === 'dni' ? event.target.value.replace(/\D/g, '').slice(0, 8) : event.target.value;
    setFormData((previous) => ({ ...previous, [name]: value })); clearError(name);
  };
  const validateField = (name) => {
    const errors = validateForm(formData, personal, editingId);
    setFieldErrors((previous) => { const next = { ...previous }; if (errors[name]) next[name] = errors[name]; else delete next[name]; return next; });
  };
  const selectManager = (manager) => {
    setFormData((previous) => ({ ...previous, jefe_inmediato: manager?.id || '', correo_jefe: manager?.correo_institucional || '' }));
    clearError('jefe_inmediato');
  };
  const submit = async (event) => {
    event.preventDefault();
    const errors = validateForm(formData, personal, editingId);
    setFieldErrors(errors); setFormError('');
    if (Object.keys(errors).length) {
      setFormError('Revisa los campos marcados para continuar.');
      requestAnimationFrame(() => formRef.current?.querySelector('[name="' + Object.keys(errors)[0] + '"]')?.focus());
      return;
    }
    setSaving(true);
    const payload = Object.fromEntries(Object.entries(formData).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
    try {
      const response = editingId ? await api.updatePersonal(editingId, payload) : await api.createPersonal(payload);
      const previous = personal.find((p) => p.id === response.data.id);
      const saved = { ...previous, ...response.data };
      setPersonal((rows) => [...rows.filter((p) => p.id !== saved.id), saved].sort((a, b) => fullName(a).localeCompare(fullName(b), 'es')));
      setSuccess({ id: saved.id, nombre: saved.nombre, created: !editingId, hasVinculo: previous?.tiene_vinculos || false });
      resetForm();
      void notifyParent();
    } catch (error) { setFormError(error.response?.data?.error || 'No se pudo guardar el personal. Tus datos siguen en el formulario.'); }
    finally { setSaving(false); }
  };
  const disable = async (item) => {
    if (!window.confirm('¿Deseas marcar como inactivo a ' + fullName(item) + '? Su información y su historial se conservarán.')) return;
    setSaving(true); setLoadError('');
    try {
      const { data } = await api.disablePersonal(item.id);
      setPersonal((rows) => rows.map((p) => p.id === item.id ? { ...p, ...data.personal } : p));
      setSuccess({ message: 'El trabajador fue marcado como inactivo.' });
      if (editingId === item.id) resetForm();
      void notifyParent();
    } catch (error) { setLoadError(error.response?.data?.error || 'No se pudo deshabilitar al trabajador.'); }
    finally { setSaving(false); }
  };

  const field = (name, label, { type = 'text', placeholder, hint, maxLength, required = REQUIRED.includes(name), className, ...props } = {}) =>
    <Field key={name} name={name} label={label} required={required} error={fieldErrors[name]} hint={hint} className={className}>
      <input id={'personal-' + name} name={name} type={type} value={formData[name]} onChange={changeField} onBlur={() => validateField(name)}
        required={required} aria-invalid={Boolean(fieldErrors[name])} aria-describedby={fieldErrors[name] || hint ? 'personal-' + name + '-help' : undefined}
        placeholder={placeholder} maxLength={maxLength} className={inputClass(fieldErrors[name])} {...props} />
    </Field>;
  const actions = (item) => <div className="flex flex-wrap items-center gap-2">
    <button type="button" disabled={saving} onClick={() => setVinculoPersonalId(item.id)} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50">
      <Icon name="briefcase" className="h-3.5 w-3.5" />Vínculo laboral</button>
    {canEdit && <details className="relative">
      <summary aria-label={'Más acciones para ' + fullName(item)} aria-disabled={saving} onClick={(event) => { if (saving) event.preventDefault(); }} className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100 [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="text-lg leading-none">⋯</span>
      </summary>
      <div className="mt-2 flex min-w-32 flex-col gap-1 rounded-xl border border-slate-200 bg-white p-1.5 text-xs">
        <button type="button" disabled={saving} onClick={(event) => { event.currentTarget.closest('details').open = false; edit(item); }} className="rounded-lg px-3 py-2 text-left font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Editar datos</button>
        {item.estado === 'activo' && <button type="button" disabled={saving} onClick={(event) => { event.currentTarget.closest('details').open = false; disable(item); }} className="rounded-lg px-3 py-2 text-left font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">Deshabilitar</button>}
      </div>
    </details>}
  </div>;
  const workerStatus = (item) => <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
    item.estado === 'activo' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600')}><span className={cx('h-1.5 w-1.5 rounded-full', item.estado === 'activo' ? 'bg-emerald-500' : 'bg-slate-400')} />{item.estado === 'activo' ? 'Activo' : 'Inactivo'}</span>;

  if (vinculoPersonalId) return <VinculoLaboral personalId={vinculoPersonalId} currentUser={currentUser}
    onClose={() => { setVinculoPersonalId(null); void loadPersonal(); }} onSaved={() => { void loadPersonal(); void notifyParent(); }} />;

  return <div data-personal-screen className="space-y-5">
    <header className="flex flex-col justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 lg:flex-row lg:items-center">
      <div className="flex items-start gap-4">
        <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white sm:flex"><Icon name="person" className="h-6 w-6" /></span>
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Directorio institucional</p>
          <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Personal de la institución</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Administra los datos de los trabajadores y sus vínculos laborales.</p>
        </div>
      </div>
      {canEdit && <button type="button" disabled={saving} onClick={showForm ? resetForm : startNew} className={showForm ? secondaryButton : primaryButton}>
        <Icon name={showForm ? 'close' : 'plus'} className="h-4 w-4" />{showForm ? 'Cerrar formulario' : 'Registrar personal'}</button>}
    </header>

    {success && <div role="status" className="flex flex-col justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"><Icon name="check" className="h-4 w-4" /></span>
        <div><p className="text-sm font-semibold text-emerald-900">{success.message || (success.created ? 'Personal registrado correctamente' : 'Datos actualizados correctamente')}</p>
          {success.id && <p className="mt-1 text-sm leading-6 text-emerald-800">{success.hasVinculo ? 'Puedes consultar sus períodos laborales desde Vínculo laboral.' : 'Continúa con el vínculo laboral de ' + success.nombre + '. Para CAS y CAP es necesario antes de asignar equipos.'}</p>}
        </div></div>
      {success.id && canManageVinculo && <button type="button" onClick={() => setVinculoPersonalId(success.id)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800">{success.hasVinculo ? 'Ver vínculo laboral' : 'Registrar vínculo laboral'}<Icon name="arrow" className="h-4 w-4" /></button>}
    </div>}

    {showForm && canEdit && <form ref={formRef} noValidate onSubmit={submit} className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:p-6 lg:flex-row lg:items-center">
        <div><h3 className="text-lg font-semibold text-slate-950">{editingId ? 'Editar personal' : 'Registrar personal'}</h3>
          <p className="mt-1.5 text-sm text-slate-500">Completa la información del trabajador. <span className="whitespace-nowrap"><span className="text-blue-600">*</span> Campos obligatorios.</span></p></div>
        {!editingId && <div className="flex flex-wrap items-center gap-2 text-xs font-medium"><span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-2 text-blue-700"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">1</span>Datos del trabajador</span><Icon name="arrow" className="h-3 w-3 text-slate-300" /><span className="text-slate-500">2. Vínculo laboral</span></div>}
      </div>
      {formError && <div role="alert" className="mx-5 mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:mx-6">{formError}</div>}
      <fieldset disabled={saving} className="min-w-0 divide-y divide-slate-100 px-5 py-6 sm:px-6">
        <FormSection number="1" icon="person" title="Datos personales" description="Identificación y medios de contacto del trabajador.">
          {field('nombre', 'Nombres', { placeholder: 'Ej. Ana María', maxLength: 100, autoComplete: 'given-name' })}
          {field('apellido', 'Apellidos', { placeholder: 'Ej. Quispe Torres', maxLength: 150, autoComplete: 'family-name' })}
          {field('dni', 'DNI', { placeholder: '8 dígitos', maxLength: 8, inputMode: 'numeric', hint: 'Identificador único de 8 dígitos.' })}
          {field('correo_institucional', 'Correo institucional', { type: 'email', placeholder: 'nombre@tc.gob.pe', maxLength: 255, autoComplete: 'email', className: 'xl:col-span-2' })}
          {field('numero_celular', 'Celular', { type: 'tel', placeholder: 'Ej. 999 888 777', maxLength: 20, autoComplete: 'tel', hint: 'Opcional. Incluye el código de país si corresponde.' })}
        </FormSection>
        <FormSection number="2" icon="location" title="Ubicación institucional" description="Indica dónde desarrolla sus actividades. Estos datos son opcionales." columns="xl:grid-cols-4">
          <Field name="sede" label="Sede"><select id="personal-sede" name="sede" value={formData.sede} onChange={changeField} className={inputClass()}><option value="">Selecciona una sede</option>{SEDES.map((s) => <option key={s}>{s}</option>)}</select></Field>
          {field('area', 'Área', { placeholder: 'Ej. Tecnología de la Información', maxLength: 150 })}
          {field('oficina', 'Oficina', { placeholder: 'Ej. Soporte técnico', maxLength: 150 })}
          {field('piso', 'Piso', { placeholder: 'Ej. 2.º piso', maxLength: 50 })}
        </FormSection>
        <FormSection number="3" icon="briefcase" title="Datos laborales" description="Cargo, régimen y jefatura del trabajador.">
          {field('cargo', 'Cargo', { placeholder: 'Ej. Analista de sistemas', maxLength: 150 })}
          <Field name="regimen_laboral" label="Régimen laboral" required error={fieldErrors.regimen_laboral} hint={editingId ? 'Los cambios de régimen se registran desde Vínculo laboral.' : 'Después de guardar podrás registrar sus fechas de vigencia.'}>
            <select id="personal-regimen_laboral" name="regimen_laboral" required value={formData.regimen_laboral} onChange={changeField} onBlur={() => validateField('regimen_laboral')} disabled={Boolean(editingId)}
              aria-invalid={Boolean(fieldErrors.regimen_laboral)} aria-describedby="personal-regimen_laboral-help" className={inputClass(fieldErrors.regimen_laboral)}><option value="">Selecciona un régimen</option>{REGIMENES.map((r) => <option key={r}>{r}</option>)}</select>
          </Field>
          <Field name="estado" label="Estado del trabajador" hint="Este estado es independiente de la vigencia de su vínculo.">
            <select id="personal-estado" name="estado" value={formData.estado} onChange={changeField} className={inputClass()}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select>
          </Field>
          <Field name="jefe_inmediato" label="Jefe inmediato" error={fieldErrors.jefe_inmediato} hint="Opcional. Para locadores y practicantes se requiere al solicitar una asignación." className="xl:col-span-2">
            <ManagerSelect people={personal.filter((p) => String(p.id) !== String(editingId))} value={formData.jefe_inmediato} onSelect={selectManager} error={fieldErrors.jefe_inmediato} onBlur={() => validateField('jefe_inmediato')} disabled={saving} />
          </Field>
          <Field name="correo_jefe" label="Correo del jefe inmediato" hint="Se completa automáticamente al seleccionar un jefe.">
            <div className="relative"><input id="personal-correo_jefe" name="correo_jefe" value={formData.correo_jefe} readOnly placeholder="Selecciona primero al jefe" className={cx(inputClass(), 'bg-slate-50 pr-10 text-slate-600')} />
              <span className="pointer-events-none absolute bottom-0 right-0 flex h-11 w-10 items-center justify-center text-slate-400"><Icon name="lock" className="h-4 w-4" /></span></div>
          </Field>
        </FormSection>
      </fieldset>
      <div className="flex flex-col-reverse justify-between gap-4 rounded-b-2xl border-t border-slate-100 bg-slate-50/70 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
        <p className="text-xs leading-5 text-slate-500">{editingId ? 'Los cambios en sus datos quedarán registrados en auditoría.' : 'Al guardar se habilitará el registro de su vínculo laboral.'}</p>
        <div className="flex flex-wrap gap-3"><button type="button" disabled={saving} onClick={resetForm} className={secondaryButton}>Cancelar</button><button type="submit" disabled={saving} className={primaryButton}><Icon name="check" className="h-4 w-4" />{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Guardar personal'}</button></div>
      </div>
    </form>}

    <section className="rounded-2xl border border-slate-200 bg-white" aria-labelledby="personal-directory-title">
      <div className="flex flex-col justify-between gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 id="personal-directory-title" className="text-lg font-semibold text-slate-950">Personal registrado</h3>
          <p className="mt-1 text-sm text-slate-500">{personal.length ? filteredPersonal.length + ' de ' + personal.length + ' trabajadores' : 'Tu directorio institucional en un solo lugar.'}</p></div>
          {personal.length > 0 && <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">{personal.filter((p) => p.estado === 'activo').length} activos</span>}
        </div>
        {personal.length > 0 && <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1"><span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400"><Icon name="search" className="h-4 w-4" /></span>
            <input aria-label="Buscar personal" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, DNI, área o sede" className={cx(inputClass(), 'mt-0 pl-10 pr-10')} />
            {search && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setSearch('')} className="absolute inset-y-0 right-2 flex w-8 items-center justify-center text-slate-400 hover:text-slate-700"><Icon name="close" className="h-4 w-4" /></button>}
          </div>
          <select aria-label="Filtrar por estado del trabajador" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={cx(inputClass(), 'mt-0 sm:w-52')}><option value="">Todos los estados</option><option value="activo">Trabajadores activos</option><option value="inactivo">Trabajadores inactivos</option></select>
        </div>}
      </div>
      {loadError && <div role="alert" className="mx-5 mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 sm:mx-6">{loadError}<button type="button" onClick={loadPersonal} className="ml-3 inline-flex items-center gap-1.5 font-semibold underline"><Icon name="refresh" className="h-3 w-3" />Recargar</button></div>}
      {loading ? <div role="status" className="flex items-center justify-center gap-3 border-t border-slate-100 py-12 text-sm text-slate-500"><span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />Cargando directorio...</div>
        : !personal.length && loadError ? <p className="border-t border-slate-100 px-5 py-10 text-center text-sm text-slate-500">El directorio no está disponible. Recarga para consultar los registros.</p>
        : !personal.length ? <div className="mx-5 mb-6 flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-10 text-center sm:mx-6">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-blue-600"><Icon name="person" className="h-6 w-6" /></span>
          <h4 className="mt-4 text-base font-semibold text-slate-900">Todavía no hay personal registrado</h4>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{canEdit ? showForm ? 'Completa el formulario de arriba para agregar al primer trabajador.' : 'Registra al primer trabajador para gestionar su información y sus vínculos laborales.' : 'Los trabajadores aparecerán aquí cuando Administración o Jefatura los registren.'}</p>
          {canEdit && !showForm && <button type="button" onClick={startNew} className={cx(primaryButton, 'mt-5')}><Icon name="plus" className="h-4 w-4" />Registrar primer trabajador</button>}
        </div>
          : !filteredPersonal.length ? <div className="border-t border-slate-100 px-5 py-12 text-center">
            <Icon name="search" className="mx-auto h-8 w-8 text-slate-300" /><h4 className="mt-4 font-semibold text-slate-900">No encontramos coincidencias</h4>
            <p className="mt-2 text-sm text-slate-500">Prueba con otro nombre o DNI, o ajusta el estado del trabajador.</p>
            <button type="button" onClick={() => { setSearch(''); setStatusFilter(''); }} className="mt-4 text-sm font-semibold text-blue-700">Limpiar filtros</button>
          </div> : <>
            <div className="hidden overflow-x-auto border-t border-slate-100 xl:block"><table className="w-full min-w-[940px] text-left text-sm">
              <thead className="bg-slate-50/80"><tr>{['Trabajador', 'Régimen y vínculo', 'Ubicación', 'Jefe inmediato', 'Estado del trabajador', 'Acciones'].map((title) => <th key={title} className="px-5 py-3.5 text-xs font-semibold text-slate-500">{title}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{filteredPersonal.map((p) => <tr key={p.id} className="align-top transition hover:bg-slate-50/60">
                <td className="px-5 py-5"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold uppercase text-blue-700">{initials(p)}</span><div className="min-w-0"><p className="font-semibold text-slate-900">{fullName(p)}</p><p className="mt-1 break-all text-xs text-slate-500">{p.correo_institucional}</p><p className="mt-1 text-xs text-slate-400">DNI {p.dni}{p.cargo ? ' · ' + p.cargo : ''}</p></div></div></td>
                <td className="px-5 py-5"><p className="mb-2 font-medium text-slate-700">{p.regimen_laboral}</p><EstadoVinculo vinculo={p.vinculo_laboral} /></td>
                <td className="px-5 py-5"><p className="font-medium text-slate-700">{p.area || 'Área no registrada'}</p><p className="mt-1 text-xs leading-5 text-slate-500">{[p.sede, p.oficina, p.piso].filter(Boolean).join(' · ') || 'Ubicación no registrada'}</p></td>
                <td className="px-5 py-5"><p className="text-slate-700">{p.jefe_inmediato_nombre || 'Sin asignar'}</p>{p.correo_jefe && <p className="mt-1 break-all text-xs text-slate-500">{p.correo_jefe}</p>}</td>
                <td className="px-5 py-5">{workerStatus(p)}</td><td className="px-5 py-5">{actions(p)}</td>
              </tr>)}</tbody>
            </table></div>
            <div className="grid gap-4 border-t border-slate-100 p-5 sm:grid-cols-2 sm:p-6 xl:hidden">{filteredPersonal.map((p) => <article key={p.id} className="min-w-0 rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold text-slate-900">{fullName(p)}</p><p className="mt-1 text-xs text-slate-500">DNI {p.dni}</p></div>{workerStatus(p)}</div>
              <p className="mt-3 break-all text-sm text-slate-500">{p.correo_institucional}</p>
              <dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs text-slate-400">Régimen y vínculo laboral</dt><dd className="mt-1 flex flex-wrap items-center gap-2"><span className="font-medium text-slate-700">{p.regimen_laboral}</span><EstadoVinculo vinculo={p.vinculo_laboral} /></dd></div>
                <div><dt className="text-xs text-slate-400">Ubicación</dt><dd className="mt-1 text-slate-600">{[p.area, p.sede, p.oficina, p.piso].filter(Boolean).join(' · ') || 'No registrada'}</dd></div>
                <div><dt className="text-xs text-slate-400">Jefe inmediato</dt><dd className="mt-1 text-slate-600">{p.jefe_inmediato_nombre || 'Sin asignar'}</dd></div></dl>
              <div className="mt-4 border-t border-slate-100 pt-4">{actions(p)}</div>
            </article>)}</div>
          </>}
    </section>
  </div>;
}
