import { useRef, useState } from 'react';
import * as api from '../services/api';

const EMPTY_SUMMARY = { total: 0, validos: 0, errores: 0 };
const formatFileSize = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const getRequestError = (requestError, fallback) => {
  const serverMessage = requestError.response?.data?.error || requestError.response?.data?.message;
  if (serverMessage) return serverMessage;
  if (requestError.response?.status) {
    return `${fallback} (HTTP ${requestError.response.status}). Verifique que el backend esté actualizado y conectado a la base de datos.`;
  }
  if (requestError.request) {
    return `${fallback} No se pudo contactar al servidor; compruebe que el backend esté iniciado.`;
  }
  return requestError.message || fallback;
};

export default function MigrarInventario({ onImported }) {
  const fileInput = useRef(null);
  const [archivo, setArchivo] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [registros, setRegistros] = useState([]);
  const [resumen, setResumen] = useState(EMPTY_SUMMARY);
  const [procesando, setProcesando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const resetPreview = () => {
    setRegistros([]);
    setResumen(EMPTY_SUMMARY);
    setError('');
    setExito('');
  };

  const selectFile = (file) => {
    if (!file) return;
    const extension = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'csv'].includes(extension)) {
      setArchivo(null);
      setRegistros([]);
      setResumen(EMPTY_SUMMARY);
      setError('Seleccione un archivo Excel (.xlsx) o CSV.');
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setArchivo(null);
      setRegistros([]);
      setResumen(EMPTY_SUMMARY);
      setError('El archivo supera el límite de 10 MB.');
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    setArchivo(file);
    resetPreview();
  };

  const downloadTemplate = async (format) => {
    setError('');
    try {
      const { data } = await api.descargarPlantillaInventario(format);
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `plantilla_migracion_inventario.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'No se pudo descargar la plantilla.');
    }
  };

  const processFile = async () => {
    if (!archivo) {
      setError('Seleccione un archivo antes de procesarlo.');
      return;
    }
    setProcesando(true);
    setError('');
    setExito('');
    try {
      const { data } = await api.validarMigracionInventario(archivo);
      setResumen(data.resumen);
      setRegistros(data.registros);
    } catch (requestError) {
      setRegistros([]);
      setResumen(EMPTY_SUMMARY);
      setError(getRequestError(requestError, 'No se pudo validar el archivo.'));
    } finally {
      setProcesando(false);
    }
  };

  const confirmImport = async () => {
    if (!archivo || resumen.validos < 1) return;
    setImportando(true);
    setError('');
    setExito('');
    try {
      const { data } = await api.confirmarMigracionInventario(archivo);
      setResumen(data.resumen);
      setRegistros(data.registros);
      setExito(`¡Importación completada! Se migraron ${data.cantidad} registros correctamente.`);
      setArchivo(null);
      setRegistros([]);
      setResumen(EMPTY_SUMMARY);
      if (fileInput.current) fileInput.current.value = '';
      try {
        await onImported?.();
      } catch (refreshError) {
        console.error('La migración se completó, pero falló la actualización del inventario:', refreshError);
        setError('La importación se completó, pero no se pudo actualizar la lista de inventario.');
      }
    } catch (requestError) {
      const response = requestError.response?.data;
      if (response?.resumen && response?.registros) {
        setResumen(response.resumen);
        setRegistros(response.registros);
      }
      setError(response?.error || getRequestError(requestError, 'No se pudo completar la importación.'));
    } finally {
      setImportando(false);
    }
  };

  const cancel = () => {
    setArchivo(null);
    if (fileInput.current) fileInput.current.value = '';
    resetPreview();
  };

  const onDrop = (event) => {
    event.preventDefault();
    setArrastrando(false);
    selectFile(event.dataTransfer.files?.[0]);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 text-slate-700">
      <nav aria-label="Ruta de navegación" className="text-xs text-slate-500">
        Inicio / Módulo Administración &amp; Configuración / <span className="font-semibold text-blue-700">Migrar Inventario</span>
      </nav>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span aria-hidden="true">⚠️</span><p>{error}</p>
        </div>
      )}
      {exito && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <span aria-hidden="true">✅</span><p>{exito}</p>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-wide text-blue-700">
          1. Selección y carga del archivo de migración (.xlsx / .csv)
        </h3>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.csv"
          className="sr-only"
          onChange={(event) => selectFile(event.target.files?.[0])}
          aria-label="Seleccionar archivo de inventario"
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          onDragOver={(event) => { event.preventDefault(); setArrastrando(true); }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={onDrop}
          className={`mt-4 flex min-h-32 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center transition ${
            arrastrando ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50'
          }`}
        >
          <span className="text-2xl" aria-hidden="true">📁</span>
          <span className="mt-2 text-sm text-slate-600">Arrastra aquí el archivo Excel/CSV o haz clic para examinar</span>
          {archivo && <span className="mt-2 max-w-full truncate text-xs font-semibold text-blue-700">{archivo.name} ({formatFileSize(archivo.size)})</span>}
        </button>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => downloadTemplate('csv')} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            📥 Descargar CSV
          </button>
          <button type="button" onClick={() => downloadTemplate('xlsx')} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            📥 Descargar Plantilla Excel
          </button>
          <button type="button" onClick={processFile} disabled={!archivo || procesando || importando} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
            {procesando ? 'Validando…' : '⚡ Procesar Archivo'}
          </button>
        </div>
      </section>

      {registros.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h3 className="border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-wide text-blue-700">
            2. Previsualización y validación de datos ({resumen.total} registros detectados)
          </h3>
          <div className="mt-3 grid gap-2 text-center text-sm font-semibold sm:grid-cols-3">
            <div className="rounded-md bg-sky-50 px-3 py-2 text-blue-700">Total Registros: {resumen.total}</div>
            <div className="rounded-md bg-emerald-50 px-3 py-2 text-emerald-700">Válidos: {resumen.validos} Registros</div>
            <div className="rounded-md bg-red-50 px-3 py-2 text-red-700">Con Errores: {resumen.errores} Registros</div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse text-left text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  {['Fila', 'Cód. Patrimonial', 'Tipo / Equipo', 'Nº Serie', 'Sede / Ubicación', 'Estado Val.', 'Detalle Validación'].map((column) => (
                    <th key={column} scope="col" className="border-b border-slate-200 px-2 py-2 font-bold">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registros.map((record) => (
                  <tr key={`${record.fila}-${record.codigoPatrimonial}`} className="border-b border-slate-100 last:border-0">
                    <td className="px-2 py-2.5 text-slate-500">{record.fila}</td>
                    <td className="px-2 py-2.5 font-semibold text-slate-800">{record.codigoPatrimonial || '—'}</td>
                    <td className="px-2 py-2.5">{record.tipoEquipo || '—'}</td>
                    <td className="px-2 py-2.5">{record.numeroSerie || '—'}</td>
                    <td className="px-2 py-2.5">{record.ubicacion || '—'}</td>
                    <td className={`whitespace-nowrap px-2 py-2.5 font-semibold ${record.valido ? 'text-emerald-700' : 'text-red-600'}`}>
                      {record.valido ? '✓ Válido' : '✕ Error'}
                    </td>
                    <td className={`px-2 py-2.5 ${record.valido ? 'text-emerald-700' : 'text-red-600'}`}>{record.detalleValidacion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={cancel} disabled={importando} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              Cancelar
            </button>
            <button type="button" onClick={confirmImport} disabled={resumen.validos < 1 || importando || procesando} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
              {importando ? 'Importando…' : `🚀 Confirmar e Importar (${resumen.validos} Válidos)`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
