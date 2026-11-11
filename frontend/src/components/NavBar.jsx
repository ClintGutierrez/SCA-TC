import { useEffect, useState } from 'react';
import './NavBar.css';

export default function NavBar({ currentUser, sidebarOpen, onProfileUpdate, onToggleSidebar, onLogout, onHome, title }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ nombre: '', email: '', departamento: '', password: '', currentPassword: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const userName = currentUser.nombre?.trim() || 'Mi cuenta';
  const initials = userName.split(/\s+/).slice(0, 2).map((word) => Array.from(word)[0]).join('').toUpperCase();
  const roleLabel = { administrador: 'Administrador', jefatura: 'Jefatura', tecnico: 'Técnico', auditor: 'Auditor', almacen: 'Almacén' }[currentUser.rol] || currentUser.rol;

  useEffect(() => {
    if (!profileOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [profileOpen]);

  const openProfile = () => {
    setProfileForm({
      nombre: currentUser.nombre || '',
      email: currentUser.email || '',
      departamento: currentUser.departamento || '',
      password: '',
      currentPassword: '',
    });
    setProfileError('');
    setProfileSuccess('');
    setEditingProfile(false);
    setProfileOpen(true);
  };

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfileForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      await onProfileUpdate(profileForm);
      setProfileSuccess('Perfil actualizado correctamente');
      setEditingProfile(false);
      setProfileForm((previous) => ({ ...previous, password: '', currentPassword: '' }));
    } catch (error) {
      setProfileError(error?.response?.data?.error || 'No se pudo actualizar el perfil');
    } finally {
      setProfileSaving(false);
    }
  };

  // El backend exige la contraseña actual para cambiar la contraseña. El correo de acceso
  // solo lo cambia un administrador, por eso el formulario lo muestra sin permitir editarlo.
  const needsCurrentPassword = profileForm.password !== '';

  return (
    <header className="sca-topbar">
      <div className="sca-topbar-inner">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="topbar-menu-toggle"
          title={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={sidebarOpen}
          aria-controls="main-sidebar"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            {sidebarOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>

        <nav className="topbar-breadcrumb" aria-label="Ubicación actual">
          <ol>
            <li className="topbar-home">{onHome ? <button type="button" onClick={onHome}>Inicio</button> : <span>Inicio</span>}</li>
            <li className="topbar-current">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
              <span aria-current="page" title={title}>{title}</span>
            </li>
          </ol>
        </nav>

        <button type="button" onClick={openProfile} className="topbar-profile" aria-label={'Abrir perfil de ' + userName}
          aria-haspopup="dialog" aria-expanded={profileOpen} aria-controls={profileOpen ? 'user-profile-dialog' : undefined} title={userName + ' · ' + roleLabel}>
          <span className="topbar-avatar" aria-hidden="true">{initials}</span>
          <span className="topbar-user-copy"><span className="topbar-user-name">{userName}</span><span className="topbar-user-role">{roleLabel}</span></span>
          <svg className="topbar-profile-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </div>

      {profileOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 px-4 pt-24 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setProfileOpen(false);
            }
          }}
        >
          <section
            id="user-profile-dialog"
            className="w-full max-w-md rounded-[28px] border border-white/70 bg-white p-6 text-slate-900 shadow-[0_25px_80px_rgba(15,23,42,0.25)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-modal-title"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Cuenta activa</p>
                <h2 id="profile-modal-title" className="mt-2 text-2xl font-semibold tracking-tight">Perfil de usuario</h2>
              </div>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-xl text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
                aria-label="Cerrar perfil"
              >
                ×
              </button>
            </div>

            {editingProfile ? (
              <form onSubmit={handleProfileSubmit} className="mt-6 space-y-4">
                <label className="block text-sm font-medium text-slate-700">
                  Nombre
                  <input name="nombre" value={profileForm.nombre} onChange={handleProfileChange} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" required />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Correo electrónico
                  <input type="email" name="email" value={profileForm.email} readOnly aria-describedby="profile-email-help" className="mt-1 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-500 outline-none" />
                  <span id="profile-email-help" className="mt-1 block text-xs font-normal text-slate-500">Solo un administrador puede cambiar el correo de acceso.</span>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Departamento
                  <input name="departamento" value={profileForm.departamento} onChange={handleProfileChange} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Nueva contraseña <span className="font-normal text-slate-400">(opcional)</span>
                  <input type="password" name="password" value={profileForm.password} onChange={handleProfileChange} minLength="8" autoComplete="new-password" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
                </label>
                {needsCurrentPassword && (
                  <label className="block text-sm font-medium text-slate-700">
                    Contraseña actual
                    <span className="block text-xs font-normal text-slate-500">Necesaria para cambiar tu contraseña.</span>
                    <input type="password" name="currentPassword" value={profileForm.currentPassword} onChange={handleProfileChange} autoComplete="current-password" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" required />
                  </label>
                )}

                {profileError && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{profileError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setEditingProfile(false)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
                  <button type="submit" disabled={profileSaving} className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{profileSaving ? 'Guardando...' : 'Guardar cambios'}</button>
                </div>
              </form>
            ) : (
              <>
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-lg font-semibold text-slate-900">{currentUser.nombre}</p>
                  <p className="mt-1 text-sm text-slate-500">{currentUser.email}</p>
                </div>

                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                    <dt className="text-slate-500">Rol</dt>
                    <dd className="font-semibold capitalize text-slate-900">{currentUser.rol}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500">Departamento</dt>
                    <dd className="text-right font-semibold text-slate-900">{currentUser.departamento || 'No registrado'}</dd>
                  </div>
                </dl>

                {profileSuccess && <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{profileSuccess}</p>}
                <div className="mt-6 flex gap-3">
                  <button type="button" onClick={() => setEditingProfile(true)} className="flex-1 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">Editar perfil</button>
                  <button type="button" onClick={onLogout} className="flex-1 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100">Cerrar sesión</button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </header>
  );
}
