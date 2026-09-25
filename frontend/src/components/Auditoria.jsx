import { useEffect, useState } from 'react';
import * as api from '../services/api';

const actionStyles = {
  CREAR: 'bg-emerald-100 text-emerald-700',
  ACTUALIZAR: 'bg-blue-100 text-blue-700',
  ELIMINAR: 'bg-rose-100 text-rose-700',
};

export default function Auditoria() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.getAuditoria();
      setLogs(response.data);
    } catch (fetchError) {
      setError(fetchError?.response?.data?.error || 'No se pudo cargar el log de auditoría');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">Seguridad y trazabilidad</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Log de auditoría</h2>
          <p className="mt-2 text-sm text-slate-500">Registro de acciones que modifican la información del sistema.</p>
        </div>
        <button type="button" onClick={loadLogs} disabled={loading} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700 disabled:opacity-60">
          {loading ? 'Actualizando...' : 'Actualizar log'}
        </button>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="overflow-x-auto rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-4">Fecha</th>
              <th className="px-5 py-4">Usuario</th>
              <th className="px-5 py-4">Acción</th>
              <th className="px-5 py-4">Recurso</th>
              <th className="px-5 py-4">Estado</th>
              <th className="px-5 py-4">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="6" className="px-5 py-12 text-center text-slate-500">Cargando registros...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan="6" className="px-5 py-12 text-center text-slate-500">Todavía no hay acciones registradas.</td></tr>
            ) : logs.map((log) => (
              <tr key={log.id} className="transition hover:bg-slate-50">
                <td className="whitespace-nowrap px-5 py-4 text-slate-600">{new Date(log.created_at).toLocaleString('es-PE')}</td>
                <td className="px-5 py-4"><p className="font-semibold text-slate-900">{log.usuario || 'Sistema'}</p><p className="text-xs text-slate-500">{log.email || 'Sin usuario autenticado'}</p></td>
                <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${actionStyles[log.accion] || 'bg-slate-100 text-slate-700'}`}>{log.accion}</span></td>
                <td className="max-w-xs truncate px-5 py-4 font-mono text-xs text-slate-600" title={log.recurso}>{log.recurso}</td>
                <td className="px-5 py-4"><span className={log.estado_http < 400 ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>{log.estado_http}</span></td>
                <td className="px-5 py-4 text-slate-500">{log.ip || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
