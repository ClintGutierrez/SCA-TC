import { useState } from 'react';

export default function Login({ onLogin, loading, error }) {
  const [formData, setFormData] = useState({
    email: 'admin@tc.pe',
    password: 'Admin123!',
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onLogin(formData.email, formData.password);
  };

  const demoAccounts = [
    { role: 'Administrador', email: 'admin@tc.pe', password: 'Admin123!' },
    { role: 'Jefatura', email: 'jefatura@tc.pe', password: 'Jefe123!' },
    { role: 'Técnico', email: 'tecnico@tc.pe', password: 'Tecnico123!' },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.22),_transparent_30%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#111827_100%)] px-4 py-8 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl overflow-hidden rounded-[36px] border border-white/10 bg-white/5 shadow-[0_40px_120px_rgba(15,23,42,0.45)] backdrop-blur xl:grid-cols-[1.05fr_0.95fr]">
        <div className="relative overflow-hidden border-b border-white/10 px-8 py-10 sm:px-12 xl:border-b-0 xl:border-r">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.25),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(99,102,241,0.18),_transparent_28%)]" />
          <div className="relative flex h-full flex-col justify-between gap-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
                Sistema de control de activos
              </div>
              <h1 className="mt-8 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Gestión de inventario con acceso por roles y trazabilidad real.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
                Un panel administrativo para administrar bienes, mantenimiento, depreciación y usuarios con tokens JWT para administrador, jefatura y técnicos.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {['Autenticación JWT', 'Roles y permisos', 'Control de activos'].map((item) => (
                <div key={item} className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4 text-sm text-slate-200 shadow-lg">
                  {item}
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {demoAccounts.map((account) => (
                <div key={account.role} className="rounded-3xl border border-white/10 bg-slate-950/30 px-4 py-4 text-sm text-slate-200">
                  <p className="font-semibold text-white">{account.role}</p>
                  <p className="mt-1 text-slate-400">{account.email}</p>
                  <p className="text-slate-400">{account.password}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center px-6 py-10 sm:px-10">
          <form onSubmit={handleSubmit} className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-8 text-slate-900 shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">Bienvenido</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">Iniciar sesión</h2>
              <p className="mt-2 text-sm text-slate-500">Ingresa con una cuenta autorizada para administrar el sistema.</p>
            </div>

            <div className="mt-8 space-y-5">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Correo electrónico</span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder="usuario@tc.pe"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Contraseña</span>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder="••••••••"
                  required
                />
              </label>
            </div>

            {error && (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-blue-200 transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Ingresando...' : 'Acceder al sistema'}
            </button>

            <div className="mt-6 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Acceso controlado</p>
              <p className="mt-1">Las cuentas autorizadas se administran desde el backend y el acceso se renueva con cookie httpOnly.</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
