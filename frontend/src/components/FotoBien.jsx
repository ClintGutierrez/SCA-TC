import { useEffect, useId, useState } from 'react';
import { getFotoBien } from '../services/api';

const tipos = ['image/jpeg', 'image/png', 'image/webp'];
const limiteBytes = 5 * 1024 * 1024;
const rutaFoto = /^\/api\/bienes\/fotos\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

export function VistaFotoBien({ imagen, alt, className, fallback = null }) {
  const [previa, setPrevia] = useState(null);
  const [imagenFallida, setImagenFallida] = useState(null);
  const rutaPrivada = typeof imagen === 'string' && rutaFoto.test(imagen);
  const necesitaPrevia = Boolean(imagen) && (rutaPrivada || typeof imagen !== 'string');

  useEffect(() => {
    if (!necesitaPrevia) return undefined;
    const controller = new AbortController();
    let url;
    const mostrar = (blob) => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob);
      setPrevia({ imagen, url });
    };
    if (rutaPrivada) {
      getFotoBien(imagen, controller.signal).then(({ data }) => mostrar(data)).catch(() => {});
    } else {
      mostrar(imagen);
    }
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [imagen, necesitaPrevia, rutaPrivada]);

  const src = necesitaPrevia ? (previa?.imagen === imagen ? previa.url : null) : imagen;
  if (!src || imagenFallida === src) return fallback;
  return <img src={src} alt={alt} className={className} onError={() => setImagenFallida(src)} />;
}

export function CampoFotoBien({ archivo, imagen, onArchivo, onQuitar, onError, error, disabled }) {
  const id = useId();
  const [arrastrando, setArrastrando] = useState(false);
  const foto = archivo || imagen;

  const elegir = (files) => {
    if (disabled || !files.length) return;
    const [file] = files;
    if (files.length !== 1) return onError('Selecciona una sola foto del equipo.');
    if (!tipos.includes(file.type) || file.size === 0) return onError('Selecciona una imagen JPG, PNG o WebP válida.');
    if (file.size > limiteBytes) return onError('La foto supera el límite de 5 MB.');
    onArchivo(file);
  };

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-800">Foto del equipo <span className="font-normal text-slate-600">(opcional)</span></p>
      <div
        className={`rounded-xl border border-dashed p-4 transition-colors ${arrastrando && !disabled ? 'border-blue-600 bg-blue-50' : error ? 'border-rose-500 bg-rose-50' : 'border-slate-300 bg-slate-50'}`}
        onDragOver={(event) => { event.preventDefault(); if (!disabled) setArrastrando(true); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setArrastrando(false); }}
        onDrop={(event) => { event.preventDefault(); setArrastrando(false); elegir(Array.from(event.dataTransfer.files)); }}
      >
        <div className="flex flex-wrap items-center gap-4">
          {foto && <VistaFotoBien imagen={foto} alt="Vista previa de la foto del equipo" className="h-20 w-24 shrink-0 rounded-lg border border-slate-200 bg-white object-contain" />}
          <div className="min-w-0 flex-1 basis-44">
            {foto ? <p className="break-all text-sm font-semibold text-slate-800">{archivo?.name || 'Foto actual'}</p> : <p className="text-sm font-medium text-slate-800">Arrastra y suelta una foto aquí.</p>}
            <p id={`${id}-ayuda`} className="mt-1 text-xs text-slate-600">JPG, PNG o WebP. Máximo 5 MB.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className={`inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-blue-800 focus-within:ring-2 focus-within:ring-blue-600 ${disabled ? 'opacity-50' : 'cursor-pointer hover:bg-blue-50'}`}>
              {foto ? 'Cambiar foto' : 'Elegir foto'}
              <input
                type="file" className="sr-only" aria-label="Foto del equipo" accept={tipos.join(',')}
                disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={`${id}-ayuda${error ? ` ${id}-error` : ''}`}
                onChange={(event) => { elegir(Array.from(event.target.files)); event.target.value = ''; }}
              />
            </label>
            {(foto || error) && <button type="button" disabled={disabled} onClick={error && !archivo ? () => onError(null) : onQuitar} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">{error ? 'Descartar selección' : 'Quitar foto'}</button>}
          </div>
        </div>
      </div>
      {error && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
