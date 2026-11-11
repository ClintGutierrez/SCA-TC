import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Select from './Select';
import * as api from '../services/api';
import { ACCESOS_USUARIO, ROLES_USUARIO, accesoUsuario, esRolTI, filtrarUsuarios, formularioUsuario, payloadUsuario, resumirUsuarios, validarUsuario } from '../utils/usuarios';

const primary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-wait disabled:opacity-50';
const secondary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:opacity-50';
const EMPTY_USERS = [];
const input = (error) => `min-h-11 w-full min-w-0 rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-50'}`;
const roleLabel = (role) => ROLES_USUARIO.find((item) => item.value === role)?.label || role;
const date = (value) => !value || !Number.isFinite(Date.parse(value)) ? 'Sin ingreso registrado'
  : new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

function Icon({ name, className = 'h-5 w-5' }) {
  const paths = {
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    search: 'm21 21-4.5-4.5M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0', plus: 'M12 5v14M5 12h14',
    close: 'm6 6 12 12M6 18 18 6', check: 'm5 12 4 4L19 6',
    refresh: 'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1',
    lock: 'M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5Z', shield: 'm12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3Zm-4 9 3 3 5-6',
    edit: 'm16 3 5 5-12 12-6 1 1-6L16 3ZM13 6l5 5',
  };
  return <svg className={'shrink-0 ' + className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.users} /></svg>;
}
function AccessBadge({ user }) {
  const access = accesoUsuario(user);
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${access === 'habilitado' ? 'bg-emerald-50 text-emerald-700' : access === 'bloqueado' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${access === 'habilitado' ? 'bg-emerald-500' : access === 'bloqueado' ? 'bg-amber-500' : 'bg-slate-400'}`} />{ACCESOS_USUARIO.find((item) => item.value === access).label}
  </span>;
}
function Field({ name, label, error, required, hint, children }) {
  return <div className="min-w-0 space-y-2"><label htmlFor={'usuario-' + name} className="block text-sm font-semibold text-slate-700">{label}{required && <span className="ml-1 text-blue-600" aria-hidden="true">*</span>}</label>{children}
    {(error || hint) && <p id={'usuario-' + name + '-help'} className={'text-xs leading-5 ' + (error ? 'text-rose-700' : 'text-slate-500')}>{error || hint}</p>}
  </div>;
}

function UserDrawer({ user, currentUser, adminCount, onClose, onSaved }) {
  const [form, setForm] = useState(() => formularioUsuario(user));
  const [changePassword, setChangePassword] = useState(!user);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState('');
  const panelRef = useRef(null);
  const savingRef = useRef(false);
  const requestClose = useRef(null);
  const initial = useRef(JSON.stringify(formularioUsuario(user)));
  const self = user && Number(user.id) === Number(currentUser?.id);
  const lastAdmin = user?.rol === 'administrador' && accesoUsuario(user) === 'habilitado' && adminCount <= 1;
  const protectedAccount = self || lastAdmin;
  requestClose.current = () => {
    if (savingRef.current) return;
    if (JSON.stringify(form) !== initial.current) setConfirm('discard'); else onClose();
  };
  useEffect(() => {
    const previousFocus = document.activeElement;
    const appRoot = document.getElementById('root');
    const previousInert = appRoot?.inert;
    const previousOverflow = document.body.style.overflow;
    if (appRoot) appRoot.inert = true;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector('[name="nombre"]')?.focus();
    const keydown = (event) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') { event.preventDefault(); requestClose.current(); }
      if (event.key !== 'Tab') return;
      const elements = [...panelRef.current.querySelectorAll('button, input, select, [tabindex="0"]'), ...document.querySelectorAll('.sca-select-panel input')]
        .filter((element) => !element.disabled && element.getClientRects().length && element.tabIndex >= 0);
      if (!elements.length) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === elements.at(-1)) { event.preventDefault(); elements[0].focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      if (appRoot) appRoot.inert = previousInert;
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  const change = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((previous) => ({ ...previous, [name]: type === 'checkbox' ? checked : value }));
    setErrors((previous) => ({ ...previous, [name]: undefined })); setError('');
  };
  const save = async (event) => {
    event.preventDefault(); if (savingRef.current) return;
    const found = validarUsuario(form, changePassword);
    setErrors(found); setError('');
    if (Object.keys(found).length) { document.getElementById('usuario-' + Object.keys(found)[0])?.focus(); return; }
    savingRef.current = true; setSaving(true);
    try {
      const payload = payloadUsuario(form, changePassword);
      const { data } = await (user ? api.updateUsuario(user.id, payload) : api.createUsuario(payload));
      onSaved(data, user ? 'Cuenta actualizada correctamente.' : 'Cuenta creada correctamente.');
    } catch (failure) {
      setError(failure.response?.data?.error || 'No se pudo guardar la cuenta. Intenta nuevamente.');
      setErrors(failure.response?.data?.campos || {});
    } finally { savingRef.current = false; setSaving(false); }
  };
  const deactivate = async () => {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true); setError('');
    try { const { data } = await api.disableUsuario(user.id); onSaved(data.user, 'Cuenta desactivada. Sus registros se conservaron.'); }
    catch (failure) { setError(failure.response?.data?.error || 'No se pudo desactivar la cuenta.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const control = (name, extra = {}) => <input id={'usuario-' + name} name={name} value={form[name]} onChange={change} disabled={saving} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] || name === 'password' ? 'usuario-' + name + '-help' : undefined} className={input(errors[name])} {...extra} />;

  return createPortal(<div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/40" onClick={(event) => { if (event.target === event.currentTarget) requestClose.current(); }}>
    <section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="usuario-panel-title" aria-describedby="usuario-panel-description" className="flex h-[100dvh] w-full max-w-lg flex-col bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-7"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Accesos y roles</p><h2 id="usuario-panel-title" className="mt-1 text-xl font-semibold text-slate-950">{user ? 'Editar cuenta' : 'Crear cuenta'}</h2><p id="usuario-panel-description" className="mt-1 break-all text-sm text-slate-500">{user ? user.email : 'Registra los datos y define su acceso al sistema.'}</p></div><button type="button" onClick={() => requestClose.current()} disabled={saving} aria-label="Cerrar panel" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:ring-4 focus-visible:ring-blue-100 disabled:opacity-50"><Icon name="close" /></button></header>
      <form onSubmit={save} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7">
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          {confirm && <div role="alert" className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">{confirm === 'discard' ? '¿Descartar los cambios sin guardar?' : '¿Desactivar esta cuenta?'}</p>{confirm === 'deactivate' && <p>Se bloqueará el acceso de {user.nombre}. Sus registros se conservarán.</p>}<div className="flex flex-wrap gap-2"><button type="button" disabled={saving} onClick={confirm === 'discard' ? onClose : deactivate} className={secondary}>{saving ? 'Procesando…' : confirm === 'discard' ? 'Descartar cambios' : 'Desactivar cuenta'}</button><button type="button" disabled={saving} onClick={() => setConfirm('')} className={secondary}>Seguir editando</button></div></div>}
          <fieldset disabled={saving} className="space-y-4"><legend className="mb-4 text-sm font-semibold text-slate-900">Datos de la cuenta</legend>
            <Field name="nombre" label="Nombre completo" required error={errors.nombre}>{control('nombre', { autoComplete: 'name', maxLength: 255, required: true })}</Field>
            <Field name="email" label="Correo institucional" required error={errors.email}>{control('email', { type: 'email', autoComplete: 'email', maxLength: 255, required: true })}</Field>
            <Field name="departamento" label="Departamento" error={errors.departamento}>{control('departamento', { maxLength: 255, autoComplete: 'organization' })}</Field>
          </fieldset>
          <fieldset disabled={saving} className="space-y-4 border-t border-slate-200 pt-5"><legend className="pr-2 text-sm font-semibold text-slate-900">Rol y funciones</legend>
            <Field name="rol" label="Rol del sistema" required error={errors.rol}><Select id="usuario-rol" name="rol" value={form.rol} onChange={change} disabled={saving || protectedAccount} aria-invalid={Boolean(errors.rol)} className={input(errors.rol)}>{ROLES_USUARIO.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</Select></Field>
            <div className="flex gap-3 rounded-xl bg-slate-50 p-3 text-sm"><span className="text-blue-600"><Icon name="shield" /></span><div><p className="font-semibold text-slate-800">{roleLabel(form.rol)}</p><p className="mt-1 leading-6 text-slate-600">{ROLES_USUARIO.find((role) => role.value === form.rol)?.description}</p></div></div>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3"><input type="checkbox" name="esTI" checked={form.esTI || esRolTI(form.rol)} disabled={saving || esRolTI(form.rol)} onChange={change} className="mt-1 h-4 w-4 rounded accent-blue-600" /><span><span className="block text-sm font-semibold text-slate-800">Pertenece al personal de TI</span><span className="mt-1 block text-xs leading-5 text-slate-500">Puede recibir solicitudes y recepcionar pedidos.{esRolTI(form.rol) ? ' Incluido en el rol seleccionado.' : ''}</span></span></label>
          </fieldset>
          <fieldset disabled={saving} className="space-y-4 border-t border-slate-200 pt-5"><legend className="pr-2 text-sm font-semibold text-slate-900">Acceso y credenciales</legend>
            <Field name="acceso" label="Acceso al sistema" error={errors.acceso} hint={ACCESOS_USUARIO.find((access) => access.value === form.acceso)?.description}><Select id="usuario-acceso" name="acceso" value={form.acceso} onChange={change} disabled={saving || protectedAccount} className={input(errors.acceso)} aria-describedby="usuario-acceso-help">{ACCESOS_USUARIO.map((access) => <option key={access.value} value={access.value}>{access.label}</option>)}</Select></Field>
            {protectedAccount && <p className="rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-800">{self ? 'Tu rol y tu acceso están protegidos para evitar que pierdas el control de tu propia cuenta.' : 'Esta es la última cuenta de administrador con acceso. Habilita otra antes de cambiar su rol o bloquearla.'}</p>}
            {user && <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={changePassword} disabled={saving} onChange={(event) => { setChangePassword(event.target.checked); setForm((old) => ({ ...old, password: '' })); setErrors((old) => ({ ...old, password: undefined })); }} className="h-4 w-4 accent-blue-600" />Cambiar contraseña</label>}
            {changePassword && <Field name="password" label={user ? 'Nueva contraseña' : 'Contraseña inicial'} required error={errors.password} hint="Al menos 8 caracteres. Activa esta opción únicamente si deseas cambiar la contraseña."><div className="relative">{control('password', { type: showPassword ? 'text' : 'password', autoComplete: 'new-password', required: true, className: input(errors.password) + ' pr-20' })}<button type="button" disabled={saving} onClick={() => setShowPassword((old) => !old)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} className="absolute inset-y-0 right-3 rounded text-xs font-semibold text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500">{showPassword ? 'Ocultar' : 'Mostrar'}</button></div></Field>}
          </fieldset>
          {user && <div className="border-t border-slate-200 pt-4"><p className="text-xs text-slate-500">Último ingreso · {date(user.last_login)}</p><button type="button" disabled={saving || protectedAccount || user.estado === 'inactivo'} onClick={() => setConfirm('deactivate')} className="mt-3 min-h-11 rounded-lg text-sm font-semibold text-rose-700 underline-offset-4 hover:underline focus-visible:ring-4 focus-visible:ring-rose-100 disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline">Desactivar cuenta</button></div>}
        </div>
        <footer className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-7"><button type="button" disabled={saving} onClick={() => requestClose.current()} className={secondary}>Cancelar</button><button type="submit" disabled={saving || Boolean(confirm)} className={primary}>{saving ? 'Guardando…' : user ? 'Guardar cambios' : 'Crear cuenta'}</button></footer>
      </form>
    </section>
  </div>, document.body);
}

export default function Usuarios({ usuarios: initialUsuarios = EMPTY_USERS, onRefresh, currentUser }) {
  const [users, setUsers] = useState(initialUsuarios);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [success, setSuccess] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [access, setAccess] = useState('');
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState(null);
  const sequence = useRef(0);
  const canManage = currentUser?.rol === 'administrador';
  useEffect(() => { setUsers(initialUsuarios); }, [initialUsuarios]);
  const reload = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true); setLoadError('');
    try { const { data } = await api.getUsuarios(); if (request === sequence.current) setUsers(data); }
    catch (error) { if (request === sequence.current) setLoadError(error.response?.data?.error || 'No se pudieron cargar las cuentas. Intenta actualizar.'); }
    finally { if (request === sequence.current) setLoading(false); }
  }, []);
  useEffect(() => { void reload(); return () => { sequence.current++; }; }, [reload]);
  const summary = useMemo(() => resumirUsuarios(users), [users]);
  const found = useMemo(() => filtrarUsuarios(users, query, role, access), [users, query, role, access]);
  const pages = Math.max(1, Math.ceil(found.length / 10));
  const currentPage = Math.min(page, pages);
  const visible = found.slice((currentPage - 1) * 10, currentPage * 10);
  const edit = (user) => { setSuccess(''); setDrawer({ user }); };
  const saved = (user, message) => {
    setUsers((old) => old.some((item) => item.id === user.id) ? old.map((item) => item.id === user.id ? user : item) : [user, ...old]);
    setDrawer(null); setSuccess(message);
    Promise.resolve().then(() => onRefresh?.()).catch(() => setSuccess(message + ' Actualiza la lista para sincronizar el resto del sistema.'));
  };
  const name = (user) => <><p className="font-semibold text-slate-900">{user.nombre}{Number(user.id) === Number(currentUser?.id) && <span className="ml-2 text-xs font-normal text-blue-700">Tú</span>}</p><p className="mt-0.5 break-all text-xs text-slate-500">{user.email}</p></>;
  const editButton = (user) => canManage ? <button type="button" onClick={() => edit(user)} aria-label={'Editar a ' + user.nombre} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:ring-4 focus-visible:ring-blue-100"><Icon name="edit" className="h-4 w-4" />Editar</button> : <span className="text-xs text-slate-500">Solo lectura</span>;
  return <div className="min-w-0 space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Administración</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Usuarios</h1><p className="mt-2 text-sm text-slate-600">Administra cuentas, roles y acceso al sistema.</p></div><div className="flex flex-wrap gap-2"><button type="button" className={secondary} disabled={loading} onClick={reload}><Icon name="refresh" className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} />Actualizar</button>{canManage && <button type="button" className={primary} onClick={() => edit(null)}><Icon name="plus" className="h-4 w-4" />Crear cuenta</button>}</div></header>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[['Cuentas registradas', 'total', 'users'], ['Acceso habilitado', 'habilitado', 'check'], ['Acceso bloqueado', 'bloqueado', 'lock'], ['Cuentas inactivas', 'inactiva', 'users']].map(([label, key, icon]) => <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-slate-500 sm:text-sm">{label}</p><span className="text-slate-400"><Icon name={icon} className="h-4 w-4" /></span></div><p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{loading && !users.length ? '—' : summary[key]}</p></div>)}</div>
    {loadError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><span>{loadError}</span><button type="button" onClick={reload} className="font-semibold underline">Reintentar</button></div>}
    {success && <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><span>{success}</span><button type="button" onClick={() => setSuccess('')} aria-label="Cerrar confirmación" className="rounded p-1 focus-visible:ring-2 focus-visible:ring-emerald-600"><Icon name="close" className="h-4 w-4" /></button></div>}
    <section aria-label="Directorio de cuentas" aria-busy={loading} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="grid items-end gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(180px,1fr)_170px_170px] sm:p-5"><div className="min-w-0 sm:col-span-2 lg:col-span-1"><label htmlFor="usuarios-buscar" className="mb-2 block text-xs font-semibold text-slate-600">Buscar cuenta</label><div className="relative"><span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"><Icon name="search" className="h-4 w-4" /></span><input id="usuarios-buscar" type="search" placeholder="Nombre, correo o departamento" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className={input() + ' pl-10'} /></div></div><div><label htmlFor="usuarios-rol" className="mb-2 block text-xs font-semibold text-slate-600">Rol</label><Select id="usuarios-rol" value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }} className={input()}><option value="">Todos los roles</option>{ROLES_USUARIO.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</Select></div><div><label htmlFor="usuarios-acceso" className="mb-2 block text-xs font-semibold text-slate-600">Acceso</label><Select id="usuarios-acceso" value={access} onChange={(event) => { setAccess(event.target.value); setPage(1); }} className={input()}><option value="">Todos los accesos</option>{ACCESOS_USUARIO.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</Select></div></div>
      {loading && !users.length ? <div className="p-12 text-center text-sm text-slate-500" role="status">Cargando cuentas…</div> : !visible.length ? <div className="flex flex-col items-center px-5 py-12 text-center"><span className="rounded-2xl bg-slate-50 p-4 text-slate-400"><Icon name="users" className="h-7 w-7" /></span><h2 className="mt-4 font-semibold text-slate-800">{users.length ? 'No hay coincidencias' : loadError ? 'No se pudo cargar el directorio' : 'Aún no hay cuentas registradas'}</h2><p className="mt-2 text-sm text-slate-500">{users.length ? 'Prueba otro nombre, rol o acceso.' : loadError ? 'Reintenta la carga para consultar las cuentas.' : 'Crea la primera cuenta desde el botón superior.'}</p>{(query || role || access) && <button type="button" className={secondary + ' mt-4'} onClick={() => { setQuery(''); setRole(''); setAccess(''); setPage(1); }}>Limpiar filtros</button>}</div> : <>
        <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr><th scope="col" className="px-5 py-3">Cuenta</th><th scope="col" className="hidden px-5 py-3 xl:table-cell">Departamento</th><th scope="col" className="px-5 py-3">Rol</th><th scope="col" className="px-5 py-3">Acceso</th><th scope="col" className="hidden px-5 py-3 2xl:table-cell">Último ingreso</th><th scope="col" className="px-5 py-3 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-slate-100">{visible.map((user) => <tr key={user.id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{user.nombre?.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('')}</span><div className="min-w-0">{name(user)}<p className="mt-1 text-xs text-slate-500 xl:hidden">{user.departamento || 'Sin departamento'}</p></div></div></td><td className="hidden px-5 py-4 text-slate-600 xl:table-cell">{user.departamento || 'Sin departamento'}</td><td className="px-5 py-4"><span className="whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{roleLabel(user.rol)}</span>{user.es_ti && <p className="mt-2 text-xs text-slate-500">Personal TI</p>}</td><td className="px-5 py-4"><AccessBadge user={user} /></td><td className="hidden whitespace-nowrap px-5 py-4 text-xs text-slate-500 2xl:table-cell">{date(user.last_login)}</td><td className="px-5 py-4 text-right">{editButton(user)}</td></tr>)}</tbody></table></div>
        <ul className="divide-y divide-slate-100 md:hidden">{visible.map((user) => <li key={user.id} className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0">{name(user)}<p className="mt-1 text-xs text-slate-500">{user.departamento || 'Sin departamento'}</p></div>{editButton(user)}</div><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{roleLabel(user.rol)}</span><AccessBadge user={user} />{user.es_ti && <span className="text-xs text-slate-500">Personal TI</span>}</div><p className="text-xs text-slate-500">Último ingreso: {date(user.last_login)}</p></li>)}</ul>
      </>}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-xs text-slate-500"><p aria-live="polite">{found.length ? (currentPage - 1) * 10 + 1 : 0}–{Math.min(currentPage * 10, found.length)} de {found.length} cuentas{found.length !== users.length ? ` · ${users.length} en total` : ''} · Hora de Lima</p>{pages > 1 && <div className="flex items-center gap-3"><button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className={secondary}>Anterior</button><span>{currentPage} / {pages}</span><button type="button" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)} className={secondary}>Siguiente</button></div>}</footer>
    </section>
    {drawer && <UserDrawer key={drawer.user?.id || 'new'} user={drawer.user} currentUser={currentUser} adminCount={summary.administradores} onClose={() => setDrawer(null)} onSaved={saved} />}
  </div>;
}
