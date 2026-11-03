import { useEffect, useState } from 'react';
import { getSolicitudesTI, getNotificacionesTI } from '../services/api';

export default function Sidebar({ isOpen, onViewChange, currentView, onCloseSidebar, currentUser }) {
  const [pendingSolicitudes, setPendingSolicitudes] = useState(0);
  const [unread,setUnread] = useState(0);

  useEffect(() => {
    let active=true;
    const syncCount = async () => {
      const results = await Promise.allSettled([getNotificacionesTI(), ...(currentUser?.rol !== 'almacen' || currentUser?.es_ti ? [getSolicitudesTI()] : [])]);
      if (!active) return;
      if (results[0].status === 'fulfilled') setUnread(results[0].value.data.filter((r) => !r.leida_at).length);
      if (results[1]?.status === 'fulfilled') setPendingSolicitudes(results[1].value.data.filter((r) => ['recibida','asignada','en_atencion'].includes(r.estado)).length);
    };
    syncCount();const timer=setInterval(syncCount,30000);
    window.addEventListener('sca-ti-updated', syncCount);
    return () => {
      active=false;clearInterval(timer);
      window.removeEventListener('sca-ti-updated', syncCount);
    };
  }, [currentUser?.id,currentUser?.rol,currentUser?.es_ti]);
  const allMenuItems = [
    { id:'notificaciones_ti',icon:'🔔',label:'Notificaciones',description:'Alertas del sistema',roles:['administrador','jefatura','tecnico','auditor','almacen'],badge:unread },
    { id:'almacen_ti',icon:'📦',label:'Pedidos y Almacén',description:'Llegada y recepción de pedidos',roles:['administrador','jefatura','tecnico','auditor','almacen'] },
    { id: 'dashboard', icon: '📊', label: 'Dashboard', description: 'Resumen ejecutivo', roles: ['administrador', 'jefatura', 'tecnico'] },
    { id: 'solicitudes_ti', icon: '📄', label: 'Solicitudes TI', description: 'Mesa de servicios', roles: ['administrador', 'jefatura', 'tecnico', 'auditor'], badge: pendingSolicitudes },
    { id: 'inventario', icon: '💻', label: 'Inventario', description: 'Gestión de bienes', roles: ['administrador', 'jefatura', 'tecnico'] },
    { id: 'bajas', icon: '📤', label: 'Bajas', description: 'Retiro con evidencias', roles: ['administrador', 'jefatura', 'auditor'] },
    { id: 'movimientos', icon: '↔', label: 'Movimientos', description: 'Asignación, cambio, retiro y préstamo', roles: ['administrador', 'jefatura', 'tecnico', 'auditor'] },
    { id: 'mantenimiento', icon: '🔧', label: 'Mantenimiento', description: 'Control de servicios', roles: ['administrador', 'jefatura', 'tecnico'] },
    { id: 'reportes', icon: '📈', label: 'Reportes', description: 'Análisis y reportes', roles: ['administrador', 'jefatura', 'tecnico'] },
    { id: 'usuarios', icon: '👥', label: 'Usuarios', description: 'Accesos y roles', roles: ['administrador'] },
    { id: 'personal', icon: '🧑‍💼', label: 'Personal', description: 'Directorio y vínculos laborales', roles: ['administrador', 'jefatura', 'tecnico', 'almacen', 'auditor'] },
    { id: 'auditoria', icon: '🛡️', label: 'Auditoría', description: 'Log de acciones', roles: ['administrador', 'auditor'] },
  ];

  const role = currentUser?.rol || 'tecnico';
  const menuItems = allMenuItems.filter((item) => item.roles.includes(role) || (item.id === 'solicitudes_ti' && currentUser?.es_ti));

  const handleMenuClick = (viewId) => {
    onViewChange(viewId);
    onCloseSidebar();
  };

  return (
    <>
      <div className={`fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={onCloseSidebar} />

      <div id="main-sidebar" className={`fixed left-4 top-4 z-50 flex h-[calc(100vh-2rem)] w-[280px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 text-white shadow-[0_30px_80px_rgba(15,23,42,0.25)] transition-transform duration-300 lg:sticky lg:top-6 lg:z-20 lg:flex lg:h-[calc(100vh-3rem)] lg:w-[286px] ${isOpen ? 'visible translate-x-0' : 'invisible -translate-x-[110%] lg:visible lg:translate-x-0'}`}>
        <div className="border-b border-white/10 bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-950 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur-sm">📋</div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Inventario TPG</h2>
              <p className="text-xs text-blue-100/90">Panel administrativo</p>
            </div>
            <button
              type="button"
              onClick={onCloseSidebar}
              className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Cerrar menú"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Sesión activa</p>
            <p className="mt-2 text-sm font-medium text-white">{currentUser?.nombre}</p>
            <p className="text-xs text-slate-400 capitalize">{currentUser?.rol}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleMenuClick(item.id)}
              className={`group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition duration-200 ${currentView === item.id ? 'bg-white text-slate-950 shadow-lg shadow-black/10' : 'text-slate-300 hover:bg-white/8 hover:text-white'}`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-xl transition-transform group-hover:scale-105">{item.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{item.label}</p>
                  {item.badge > 0 && (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${currentView === item.id ? 'bg-blue-600 text-white' : 'bg-amber-400 text-slate-950'}`}>
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className={`text-xs ${currentView === item.id ? 'text-slate-500' : 'text-slate-400'}`}>{item.description}</p>
              </div>
            </button>
          ))}
        </nav>

        <div className="mx-4 border-t border-white/10" />

        <div className="px-4 py-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">Herramientas</p>
          {role === 'administrador' && <button onClick={() => handleMenuClick('configuracion')} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition hover:bg-white/8 hover:text-white ${currentView === 'configuracion' ? 'bg-white text-slate-950' : 'text-slate-300'}`}>
            <span>⚙️</span>
            <span>Configuración</span>
          </button>}
        </div>

        <div className="border-t border-white/10 bg-white/5 p-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Última actualización</p>
            <p className="mt-2 text-sm font-medium text-white">Hace 2 minutos</p>
            <p className="mt-1 text-xs text-slate-400">v1.0.0 • {new Date().getFullYear()}</p>
          </div>
        </div>
      </div>
    </>
  );
}
