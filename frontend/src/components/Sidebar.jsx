export default function Sidebar({ isOpen, onViewChange, currentView, onCloseSidebar, currentUser }) {
  const allMenuItems = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard', description: 'Resumen ejecutivo', roles: ['administrador', 'jefatura', 'tecnico'] },
    { id: 'inventario', icon: '💻', label: 'Inventario', description: 'Gestión de bienes', roles: ['administrador', 'jefatura', 'tecnico'] },
    { id: 'mantenimiento', icon: '🔧', label: 'Mantenimiento', description: 'Control de servicios', roles: ['administrador', 'jefatura', 'tecnico'] },
    { id: 'reportes', icon: '📈', label: 'Reportes', description: 'Análisis y reportes', roles: ['administrador', 'jefatura', 'tecnico'] },
    { id: 'usuarios', icon: '👥', label: 'Usuarios', description: 'Accesos y roles', roles: ['administrador'] },
  ];

  const role = currentUser?.rol || 'tecnico';
  const menuItems = allMenuItems.filter((item) => item.roles.includes(role));

  const handleMenuClick = (viewId) => {
    onViewChange(viewId);
    onCloseSidebar();
  };

  return (
    <>
      <div className={`fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={onCloseSidebar} />

      <div className={`fixed left-4 top-4 z-50 flex h-[calc(100vh-2rem)] w-[280px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 text-white shadow-[0_30px_80px_rgba(15,23,42,0.25)] transition-transform duration-300 lg:sticky lg:top-6 lg:z-20 lg:flex lg:h-[calc(100vh-3rem)] lg:w-[286px] ${isOpen ? 'translate-x-0' : '-translate-x-[110%] lg:translate-x-0'}`}>
        <div className="border-b border-white/10 bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-950 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur-sm">📋</div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Inventario TPG</h2>
              <p className="text-xs text-blue-100/90">Panel administrativo</p>
            </div>
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
              <div className="min-w-0">
                <p className="text-sm font-semibold">{item.label}</p>
                <p className={`text-xs ${currentView === item.id ? 'text-slate-500' : 'text-slate-400'}`}>{item.description}</p>
              </div>
            </button>
          ))}
        </nav>

        <div className="mx-4 border-t border-white/10" />

        <div className="px-4 py-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">Herramientas</p>
          <button className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-slate-300 transition hover:bg-white/8 hover:text-white">
            <span>⚙️</span>
            <span>Configuración</span>
          </button>
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
