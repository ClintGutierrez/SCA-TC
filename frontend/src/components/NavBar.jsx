import { useEffect, useState } from 'react';

export default function NavBar({ currentUser, onToggleSidebar, onLogout, searchValue, onSearchValueChange, title, description }) {
  const [localSearch, setLocalSearch] = useState(searchValue || '');

  useEffect(() => {
    setLocalSearch(searchValue || '');
  }, [searchValue]);

  const handleSearch = (event) => {
    event.preventDefault();
    onSearchValueChange(localSearch);
  };

  return (
    <nav className="sticky top-0 z-30 border-b border-white/60 bg-white/75 text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1800px] items-center gap-4 px-4 py-4 lg:px-6">
        <button
          onClick={onToggleSidebar}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700 lg:hidden"
          title="Abrir menú"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
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

        <form onSubmit={handleSearch} className="hidden w-full max-w-xl lg:block">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar bienes, usuarios o reportes..."
              value={localSearch}
              onChange={(event) => setLocalSearch(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pl-11 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
            <svg className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </form>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-2 text-right shadow-sm sm:block">
            <p className="text-sm font-semibold text-slate-900">{currentUser.nombre}</p>
            <p className="text-xs text-slate-500 capitalize">{currentUser.rol}</p>
          </div>
          <button onClick={onLogout} className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-rose-200 hover:text-rose-700 sm:block">
            Salir
          </button>
          <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
