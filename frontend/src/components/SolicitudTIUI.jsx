export const botonPrincipalTI = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50';
export const botonSecundarioTI = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50';

export function IconoTI({ name = 'documento', className = 'h-5 w-5' }) {
  const icons = {
    documento: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
    personas: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5.65" /></>,
    equipo: <><rect x="3" y="3" width="18" height="13" rx="2" /><path d="M8 21h8M12 16v5" /></>,
    cambio: <><path d="M3 7h17l-4-4M21 17H4l4 4M20 7l-4 4M4 17l4-4" /></>,
    ubicacion: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z" /><circle cx="12" cy="10" r="2.5" /></>,
    impresora: <><path d="M6 9V3h12v6M6 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v7H6zM18 12h.01" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    flecha: <path d="M5 12h14m-6-6 6 6-6 6" />,
    atras: <path d="M19 12H5m6-6-6 6 6 6" />,
    subir: <><path d="M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></>,
    descargar: <><path d="M12 3v13m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></>,
    copiar: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V3H3v13h5" /></>,
    buscar: <><circle cx="10.5" cy="10.5" r="7.5" /><path d="m16 16 5 5" /></>,
    ojo: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    llave: <><circle cx="8" cy="8" r="5" /><path d="m12 12 9 9m-4-4 3-3m-6 0 3-3" /></>,
    reloj: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    correo: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 5 10 8L22 5" /></>,
    cerrar: <path d="m6 6 12 12M6 18 18 6" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">{icons[name] || icons.documento}</svg>;
}

export function CampoTI({ id, label, error, hint, required, as: Tag = 'input', className = '', children, ...props }) {
  const description = [hint && `${id}-ayuda`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return <div className={className}>
    <label htmlFor={id} className="mb-2 block text-sm font-semibold text-slate-800">{label}{required && <span className="ml-1 text-blue-700" aria-hidden="true">*</span>}</label>
    <Tag id={id} required={required} aria-invalid={Boolean(error)} aria-describedby={description} className={`w-full rounded-xl border bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 disabled:bg-slate-50 ${error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-100' : 'border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:ring-blue-100'}`} {...props}>{children}</Tag>
    {hint && <p id={`${id}-ayuda`} className="mt-2 text-xs leading-5 text-slate-500">{hint}</p>}
    {error && <p id={`${id}-error`} className="mt-2 text-sm text-rose-700">{error}</p>}
  </div>;
}
