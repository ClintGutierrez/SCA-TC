import Select from './Select';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as api from '../services/api';
import VinculoLaboral, { EstadoVinculo } from './VinculoLaboral';
import './Personal.css';

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
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    edit: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z',
    inactive: 'M5 12h14M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  };
  return <svg width="20" height="20" className={cx('shrink-0', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.person} /></svg>;
}

const locationSummary = (person) => {
  const seen = new Set([normalize(person.area)].filter(Boolean));
  return [person.sede, person.oficina, person.piso].filter((part) => {
    const key = normalize(part);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(' · ');
};

function PersonalActions({ person, saving, canEdit, onVinculo, onEdit, onDisable }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const menuId = useId();
  const close = (restoreFocus = false) => {
    setOpen(false); setPosition(null);
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!open) return;
    const rect = trigger.current.getBoundingClientRect();
    const height = menu.current.getBoundingClientRect().height;
    const width = Math.min(200, window.innerWidth - 24);
    const above = window.innerHeight - rect.bottom < height + 12 && rect.top > height + 12;
    setPosition({ width, left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
      top: Math.max(12, Math.min(above ? rect.top - height - 6 : rect.bottom + 6, window.innerHeight - height - 12)) });
    const frame = requestAnimationFrame(() => menu.current?.querySelector('button:not(:disabled)')?.focus());
    const outside = (event) => { if (!trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) close(); };
    const moved = (event) => { if (!menu.current?.contains(event.target)) close(); };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('scroll', moved, true);
    window.addEventListener('resize', moved);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('scroll', moved, true);
      window.removeEventListener('resize', moved);
    };
  }, [open]);

  const keydown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (event.key === 'Tab') { close(true); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...menu.current.querySelectorAll('button:not(:disabled)')];
    if (!buttons.length) return;
    const current = buttons.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };
  const run = (callback) => { close(true); callback(person); };

  return <div className="personal-row-actions">
    <button type="button" disabled={saving} onClick={() => onVinculo(person.id)} className="personal-link-button" title="Consultar y gestionar vínculo laboral" aria-label={'Vínculo laboral de ' + fullName(person)}>
      <Icon name="briefcase" />Vínculo</button>
    {canEdit && <button ref={trigger} type="button" disabled={saving} className="personal-menu-trigger" aria-label={'Más acciones para ' + fullName(person)}
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      onClick={() => open ? close() : setOpen(true)} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); } }}><Icon name="more" /></button>}
    {open && createPortal(<div ref={menu} id={menuId} role="menu" aria-label={'Acciones de ' + fullName(person)} className="personal-row-menu" onKeyDown={keydown}
      style={position || { width: 200, top: 0, left: 0, visibility: 'hidden' }}>
      <button type="button" role="menuitem" disabled={saving} onClick={() => run(onEdit)}><Icon name="edit" />Editar datos</button>
      {person.estado === 'activo' && <button type="button" role="menuitem" disabled={saving} className="is-danger" onClick={() => run(onDisable)}><Icon name="inactive" />Deshabilitar</button>}
    </div>, document.body)}
  </div>;
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
  const selected = people.find((person) => String(person.id) === String(value));
  return <Select id="personal-jefe_inmediato" name="jefe_inmediato" value={value} disabled={disabled}
    searchable searchPlaceholder="Buscar por nombre o DNI" aria-invalid={Boolean(error)} aria-describedby="personal-jefe_inmediato-help"
    onBlur={onBlur} onChange={(event) => onSelect(people.find((person) => String(person.id) === event.target.value) || null)} className={inputClass(error)}>
    <option value="">Sin jefe asignado</option>
    {value && (!selected || selected.estado !== 'activo') && <option value={value} disabled>Jefe no disponible; selecciona otro</option>}
    {people.filter((person) => person.estado === 'activo').map((person) => <option key={person.id} value={person.id} data-search={person.correo_institucional}>{fullName(person)} · DNI {person.dni}</option>)}
  </Select>;
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
  const activeCount = personal.filter((person) => person.estado === 'activo').length;
  const hasFilters = Boolean(search.trim() || statusFilter);
  const clearFilters = () => { setSearch(''); setStatusFilter(''); };
  const actions = (person) => <PersonalActions person={person} saving={saving} canEdit={canEdit}
    onVinculo={setVinculoPersonalId} onEdit={edit} onDisable={disable} />;
  const workerStatus = (person) => <span className={cx('personal-worker-status', person.estado === 'activo' && 'is-active')}>
    {person.estado === 'activo' ? 'Activo' : 'Inactivo'}</span>;

  if (vinculoPersonalId) return <VinculoLaboral personalId={vinculoPersonalId} currentUser={currentUser}
    onClose={() => { setVinculoPersonalId(null); void loadPersonal(); }} onSaved={() => { void loadPersonal(); void notifyParent(); }} />;

  return <div data-personal-screen className="personal-screen">
    <header className="personal-header">
      <div>
        <h1 id="personal-directory-title">Personal de la institución</h1>
        <div className="personal-counts">
          <span>{personal.length.toLocaleString('es-PE')} {personal.length === 1 ? 'trabajador registrado' : 'trabajadores registrados'}</span>
          {personal.length > 0 && <><span className="personal-count-active">{activeCount} {activeCount === 1 ? 'activo' : 'activos'}</span>
            {personal.length > activeCount && <span>{personal.length - activeCount} {personal.length - activeCount === 1 ? 'inactivo' : 'inactivos'}</span>}</>}
        </div>
      </div>
      {canEdit ? <button type="button" disabled={saving} onClick={showForm ? resetForm : startNew} className={cx('personal-create-button', showForm && 'is-secondary')}>
        <Icon name={showForm ? 'close' : 'plus'} />{showForm ? 'Cerrar formulario' : 'Registrar personal'}</button>
        : <span className="personal-read-only">Solo consulta</span>}
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
          <Field name="sede" label="Sede"><Select id="personal-sede" name="sede" value={formData.sede} onChange={changeField} className={inputClass()}><option value="">Selecciona una sede</option>{SEDES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          {field('area', 'Área', { placeholder: 'Ej. Tecnología de la Información', maxLength: 150 })}
          {field('oficina', 'Oficina', { placeholder: 'Ej. Soporte técnico', maxLength: 150 })}
          {field('piso', 'Piso', { placeholder: 'Ej. 2.º piso', maxLength: 50 })}
        </FormSection>
        <FormSection number="3" icon="briefcase" title="Datos laborales" description="Cargo, régimen y jefatura del trabajador.">
          {field('cargo', 'Cargo', { placeholder: 'Ej. Analista de sistemas', maxLength: 150 })}
          <Field name="regimen_laboral" label="Régimen laboral" required error={fieldErrors.regimen_laboral} hint={editingId ? 'Los cambios de régimen se registran desde Vínculo laboral.' : 'Después de guardar podrás registrar sus fechas de vigencia.'}>
            <Select id="personal-regimen_laboral" name="regimen_laboral" required value={formData.regimen_laboral} onChange={changeField} onBlur={() => validateField('regimen_laboral')} disabled={Boolean(editingId)}
              aria-invalid={Boolean(fieldErrors.regimen_laboral)} aria-describedby="personal-regimen_laboral-help" className={inputClass(fieldErrors.regimen_laboral)}><option value="">Selecciona un régimen</option>{REGIMENES.map((r) => <option key={r}>{r}</option>)}</Select>
          </Field>
          <Field name="estado" label="Estado del trabajador" hint="Este estado es independiente de la vigencia de su vínculo.">
            <Select id="personal-estado" name="estado" value={formData.estado} onChange={changeField} className={inputClass()}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></Select>
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

    <section className="personal-directory" aria-labelledby="personal-directory-title">
      <div className="personal-toolbar">
        <div className="personal-toolbar-row">
          <div className="personal-search"><Icon name="search" />
            <input type="search" aria-label="Buscar personal" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, DNI, área o sede" />
          </div>
          <div className="personal-status-filter"><Select aria-label="Filtrar por estado del trabajador" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="personal-status-select"><option value="">Todos los estados</option><option value="activo">Trabajadores activos</option><option value="inactivo">Trabajadores inactivos</option></Select></div>
          <button type="button" className="personal-refresh" onClick={loadPersonal} disabled={loading || saving}><Icon name="refresh" />Actualizar</button>
        </div>
        <div role="status" aria-live="polite" className={hasFilters ? 'personal-filter-summary' : 'sr-only'}>
          <span>{hasFilters ? `${filteredPersonal.length.toLocaleString('es-PE')} resultados de ${personal.length.toLocaleString('es-PE')} trabajadores` : ''}</span>
          {hasFilters && <button type="button" onClick={clearFilters}>Limpiar filtros</button>}
        </div>
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
            <div className="personal-desktop"><table className="personal-table">
              <caption className="sr-only">Directorio institucional: datos de contacto, ubicación y situación laboral del personal.</caption>
              <colgroup><col className="personal-col-worker" /><col className="personal-col-contract" /><col className="personal-col-location" /><col className="personal-col-manager" /><col className="personal-col-status" /><col className="personal-col-actions" /></colgroup>
              <thead><tr>{['Trabajador', 'Régimen y vínculo', 'Área y ubicación', 'Jefe inmediato', 'Estado', 'Acciones'].map((title) => <th key={title} scope="col">{title}</th>)}</tr></thead>
              <tbody>{filteredPersonal.map((p) => <tr key={p.id}>
                <td><div className="personal-worker"><span className="personal-avatar" aria-hidden="true">{initials(p)}</span><div className="personal-worker-copy"><strong>{fullName(p)}</strong>
                  <p className="personal-worker-meta">DNI {p.dni}{p.cargo ? ' · ' + p.cargo : ''}</p><p className="personal-contact">{p.correo_institucional}</p></div></div></td>
                <td><div className="personal-contract"><span className="personal-regime">{p.regimen_laboral || 'Sin régimen'}</span><EstadoVinculo vinculo={p.vinculo_laboral} /></div></td>
                <td><p className="personal-cell-title">{p.area || 'Área no registrada'}</p><p className="personal-cell-secondary">{locationSummary(p) || (!p.area ? 'Ubicación no registrada' : '')}</p></td>
                <td><p className={p.jefe_inmediato_nombre ? 'personal-manager' : 'personal-missing'}>{p.jefe_inmediato_nombre || 'Sin asignar'}</p>{p.correo_jefe && <p className="personal-contact">{p.correo_jefe}</p>}</td>
                <td>{workerStatus(p)}</td><td>{actions(p)}</td>
              </tr>)}</tbody>
            </table></div>
            <div className="personal-cards">{filteredPersonal.map((p) => <article key={p.id} className="personal-card">
              <div className="personal-card-heading"><div className="personal-worker"><span className="personal-avatar" aria-hidden="true">{initials(p)}</span><div className="personal-worker-copy"><strong>{fullName(p)}</strong><p className="personal-worker-meta">DNI {p.dni}</p></div></div>{workerStatus(p)}</div>
              {p.cargo && <p className="personal-card-role">{p.cargo}</p>}
              <p className="personal-contact">{p.correo_institucional}</p>
              <dl className="personal-card-details"><div><dt>Régimen y vínculo</dt><dd className="personal-card-contract"><span className="personal-regime">{p.regimen_laboral || 'Sin régimen'}</span><EstadoVinculo vinculo={p.vinculo_laboral} /></dd></div>
                <div><dt>Área y ubicación</dt><dd>{p.area || 'Área no registrada'}{locationSummary(p) && <span className="personal-cell-secondary">{locationSummary(p)}</span>}</dd></div>
                <div><dt>Jefe inmediato</dt><dd>{p.jefe_inmediato_nombre || 'Sin asignar'}{p.correo_jefe && <span className="personal-contact">{p.correo_jefe}</span>}</dd></div></dl>
              <footer className="personal-card-footer">{actions(p)}</footer>
            </article>)}</div>
          </>}
    </section>
  </div>;
}
