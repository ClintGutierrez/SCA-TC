export default function Dashboard({ bienes, currentUser }) {
  const totalBienes = bienes.length;
  const bienesActivos = bienes.filter(b => b.estado === 'activo').length;
  const bienesInactivos = bienes.filter(b => b.estado !== 'activo').length;
  const valorTotal = bienes.reduce((sum, b) => sum + (b.costo || 0), 0);
  const porcentajeActivos = totalBienes > 0 ? Math.round((bienesActivos / totalBienes) * 100) : 0;
  const valorPromedio = totalBienes > 0 ? valorTotal / totalBienes : 0;
  const equipamientoCritico = bienes.filter(b => (b.tipo || '').toLowerCase().includes('servidor') || (b.tipo || '').toLowerCase().includes('laptop')).length;

  const cards = [
    {
      title: 'Total de Bienes',
      value: totalBienes,
      icon: '📦',
      accent: 'from-blue-500 to-cyan-400',
      helper: 'Inventario registrado',
      trend: `${totalBienes} activos en control`,
    },
    {
      title: 'Activos',
      value: bienesActivos,
      icon: '✅',
      accent: 'from-emerald-500 to-green-400',
      helper: 'Disponibles para uso',
      trend: `${porcentajeActivos}% del total`,
    },
    {
      title: 'Inactivos',
      value: bienesInactivos,
      icon: '🛑',
      accent: 'from-rose-500 to-orange-400',
      helper: 'Fuera de operación',
      trend: `${totalBienes > 0 ? Math.round((bienesInactivos / totalBienes) * 100) : 0}% del total`,
    },
    {
      title: 'Valor Total',
      value: `S/ ${valorTotal.toFixed(2)}`,
      icon: '💰',
      accent: 'from-violet-500 to-fuchsia-400',
      helper: 'Valor patrimonial',
      trend: `Promedio S/ ${valorPromedio.toFixed(2)}`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-slate-950 text-white shadow-[0_25px_70px_rgba(15,23,42,0.18)]">
          <div className="relative px-8 py-8 sm:px-10 sm:py-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.24),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(99,102,241,0.2),_transparent_28%)]" />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-blue-200">Resumen ejecutivo</p>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Panel de control del inventario</h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                  Monitorea activos, estado operativo y valor patrimonial con una vista limpia y compacta al estilo TailAdmin.
                </p>
                <div className="mt-5 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
                  Sesión: {currentUser?.nombre} · {currentUser?.rol}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:min-w-[280px]">
                <div className="rounded-3xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
                  <p className="text-xs text-slate-300">Activos</p>
                  <p className="mt-2 text-2xl font-semibold">{porcentajeActivos}%</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
                  <p className="text-xs text-slate-300">Críticos</p>
                  <p className="mt-2 text-2xl font-semibold">{equipamientoCritico}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-500">Disponibilidad</p>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Operativo</span>
            </div>
            <div className="mt-5 flex items-end justify-between">
              <div>
                <p className="text-4xl font-semibold text-slate-950">{porcentajeActivos}%</p>
                <p className="mt-2 text-sm text-slate-500">de los bienes están activos</p>
              </div>
              <div className="h-20 w-20 rounded-full border-[10px] border-slate-100 border-t-blue-500 rotate-[-45deg]" />
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Valor promedio</p>
            <p className="mt-4 text-4xl font-semibold text-slate-950">S/ {valorPromedio.toFixed(2)}</p>
            <p className="mt-2 text-sm text-slate-500">Base para depreciación y auditoría</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, index) => (
          <div
            key={index}
            className="group rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="flex items-start justify-between mb-5">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent} text-xl text-white shadow-lg`}>
                {card.icon}
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition group-hover:bg-slate-950 group-hover:text-white">
                {card.trend}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500">{card.title}</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">{card.value}</p>
            <p className="mt-3 text-sm text-slate-500">{card.helper}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-950">Actividad reciente</h3>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Últimos eventos</span>
          </div>
          <div className="mt-6 space-y-4">
            {[
              { title: 'Sincronización de inventario', detail: 'Actualización de bienes y metadatos', tone: 'bg-blue-500' },
              { title: 'Control de mantenimiento', detail: 'Registro y seguimiento de servicios', tone: 'bg-emerald-500' },
              { title: 'Exportación de reportes', detail: 'Datos listos para auditoría', tone: 'bg-violet-500' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className={`mt-1 h-3 w-3 rounded-full ${item.tone}`} />
                <div>
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Estado del sistema</h3>
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">Operativo</span>
          </div>
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <span className="text-sm text-slate-300">Versión</span>
              <span className="font-semibold">1.0.0</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <span className="text-sm text-slate-300">Base de datos</span>
              <span className="font-semibold">PostgreSQL</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <span className="text-sm text-slate-300">Tiempo de respuesta</span>
              <span className="font-semibold">&lt; 1s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
