import { useEffect, useState } from 'react';
import * as api from '../services/api';

const relativeDate = (dateValue) => {
  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (elapsedMinutes < 1) return 'hace unos segundos';
  if (elapsedMinutes < 60) return `hace ${elapsedMinutes} min`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `hace ${elapsedHours} h`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `hace ${elapsedDays} día${elapsedDays === 1 ? '' : 's'}`;
};

export default function NavBar({
  currentUser,
  sidebarOpen,
  onProfileUpdate,
  onToggleSidebar,
  onLogout,
  onViewChange,
  onNotificationNavigate,
  title,
  description,
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notificationError, setNotificationError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ nombre: '', email: '', departamento: '', password: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  useEffect(() => {
    let active = true;
    const refreshCount = async () => {
      try {
        const response = await api.getNotificacionesCount();
        if (active) setNotificationCount(response.data.count);
      } catch (error) {
        console.error('Error actualizando contador de notificaciones:', error);
        if (active && notificationsOpen) {
          setNotificationError(error?.response?.data?.error || 'No se pudo actualizar el contador de notificaciones');
        }
      }
    };

    refreshCount();
    const intervalId = window.setInterval(refreshCount, 60_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;
    let active = true;
    api.getNotificaciones()
      .then((response) => {
        if (active) {
          setNotifications(response.data);
          setNotificationError('');
        }
      })
      .catch((error) => {
        console.error('Error cargando notificaciones:', error);
        if (active) setNotificationError(error?.response?.data?.error || 'No se pudieron cargar las notificaciones');
      });
    return () => { active = false; };
  }, [notificationsOpen]);

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
      setProfileForm((previous) => ({ ...previous, password: '' }));
    } catch (error) {
      setProfileError(error?.response?.data?.error || 'No se pudo actualizar el perfil');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleNotificationClick = async (notification) => {
    setNotificationError('');
    try {
      if (!notification.leida) {
        await api.marcarNotificacionLeida(notification.id);
        setNotifications((current) => current.map((item) => (
          item.id === notification.id ? { ...item, leida: true } : item
        )));
        setNotificationCount((count) => Math.max(0, count - 1));
      }
      setNotificationsOpen(false);
      if (notification.pedido_id) {
        onViewChange?.('almacen');
        onNotificationNavigate?.(notification.pedido_id);
      }
    } catch (error) {
      setNotificationError(error?.response?.data?.error || 'No se pudo abrir la notificación');
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setMarkingAll(true);
    setNotificationError('');
    try {
      await api.marcarTodasNotificacionesLeidas();
      setNotifications((current) => current.map((item) => ({ ...item, leida: true })));
      setNotificationCount(0);
    } catch (error) {
      setNotificationError(error?.response?.data?.error || 'No se pudieron marcar las notificaciones como leídas');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <nav className="sticky top-0 z-30 border-b border-white/60 bg-white/75 text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1800px] items-center gap-4 px-4 py-4 lg:px-6">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700 lg:hidden"
          title={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={sidebarOpen}
          aria-controls="main-sidebar"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            {sidebarOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>

        <div className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-lg font-bold text-white shadow-lg shadow-blue-200 lg:flex">
          T
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-600">Sistema de Inventario</p>
          <h1 className="truncate text-lg font-semibold text-slate-900 lg:text-xl">{title}</h1>
          <p className="mt-0.5 hidden text-sm text-slate-500 lg:block">{description}</p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen((open) => !open);
                setNotificationError('');
              }}
              className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
              aria-label={`Notificaciones${notificationCount ? `, ${notificationCount} sin leer` : ''}`}
              aria-expanded={notificationsOpen}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
              </svg>
              {notificationCount > 0 && (
                <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold leading-4 text-white">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </button>
            {notificationsOpen && (
              <section className="absolute right-0 z-50 mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl" aria-label="Notificaciones">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <h2 className="font-semibold">Notificaciones</h2>
                  <button type="button" disabled={!notificationCount || markingAll} onClick={handleMarkAllNotificationsRead} className="text-xs font-semibold text-blue-700 disabled:text-slate-400">
                    {markingAll ? 'Actualizando…' : 'Marcar todas como leídas'}
                  </button>
                </div>
                {notificationError && <p role="alert" className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">{notificationError}</p>}
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length ? notifications.map((notification) => (
                    <button
                      type="button"
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-blue-50 ${notification.leida ? 'bg-white' : 'bg-blue-50/60'}`}
                    >
                      <span className="flex items-start gap-2">
                        {!notification.leida && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-600" />}
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{notification.titulo}</span>
                          <span className="mt-1 block text-xs text-slate-600">{notification.mensaje}</span>
                          <span className="mt-1 block text-[11px] text-slate-400">{notification.created_at ? relativeDate(notification.created_at) : ''}</span>
                        </span>
                      </span>
                    </button>
                  )) : <p className="px-4 py-8 text-center text-sm text-slate-500">No tienes notificaciones.</p>}
                </div>
              </section>
            )}
          </div>
          <button
            type="button"
            onClick={openProfile}
            className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-2 text-right shadow-sm transition hover:border-blue-200 hover:bg-blue-50 sm:block"
            aria-label="Abrir perfil de usuario"
          >
            <p className="text-sm font-semibold text-slate-900">{currentUser.nombre}</p>
            <p className="text-xs text-slate-500 capitalize">{currentUser.rol}</p>
          </button>
          <button
            type="button"
            onClick={openProfile}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
            title="Abrir perfil"
            aria-label="Abrir perfil de usuario"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
            </svg>
          </button>
        </div>
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
                  <input type="email" name="email" value={profileForm.email} onChange={handleProfileChange} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" required />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Departamento
                  <input name="departamento" value={profileForm.departamento} onChange={handleProfileChange} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Nueva contraseña <span className="font-normal text-slate-400">(opcional)</span>
                  <input type="password" name="password" value={profileForm.password} onChange={handleProfileChange} minLength="8" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
                </label>

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
    </nav>
  );
}
