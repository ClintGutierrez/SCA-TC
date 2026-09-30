import { Fragment, useEffect, useState } from 'react';
import * as api from '../services/api';

const operationStyles = {
  CREAR: 'bg-emerald-100 text-emerald-700',
  ACTUALIZAR: 'bg-blue-100 text-blue-700',
  ELIMINAR: 'bg-rose-100 text-rose-700',
};

const formatAuditData = (data) => {
  if (!data) {
    return '-';
  }

  return JSON.stringify(data, null, 2);
};

export default function Auditoria() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedLogs, setExpandedLogs] = useState(() => new Set());

  const toggleLogDetails = (logId) => {
    setExpandedLogs((current) => {
      const next = new Set(current);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

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
              <th className="px-5 py-4">Operación</th>
              <th className="px-5 py-4">Tabla afectada</th>
              <th className="px-5 py-4">Registro ID</th>
              <th className="px-5 py-4">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="6" className="px-5 py-12 text-center text-slate-500">Cargando registros...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan="6" className="px-5 py-12 text-center text-slate-500">Todavía no hay acciones registradas.</td></tr>
            ) : logs.map((log) => (
              <Fragment key={log.id}>
                <tr className="transition hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">{new Date(log.created_at).toLocaleString('es-PE')}</td>
                  <td className="px-5 py-4"><p className="font-semibold text-slate-900">{log.usuario || 'Usuario no disponible'}</p><p className="text-xs text-slate-500">{log.email || 'Correo no disponible'}</p></td>
                  <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${operationStyles[log.operacion] || 'bg-slate-100 text-slate-700'}`}>{log.operacion}</span></td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-600">{log.tabla_afectada || '-'}</td>
                  <td className="px-5 py-4 text-slate-600">{log.registro_id || '-'}</td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => toggleLogDetails(log.id)}
                      className="font-semibold text-blue-600 hover:text-blue-800"
                      aria-expanded={expandedLogs.has(log.id)}
                    >
                      {expandedLogs.has(log.id) ? 'Ocultar' : 'Ver'}
                    </button>
                  </td>
                </tr>
                {expandedLogs.has(log.id) && (
                  <tr className="bg-slate-50">
                    <td colSpan="6" className="px-5 py-5">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Datos anteriores</p>
                          <pre className="max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700">{formatAuditData(log.datos_anteriores)}</pre>
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Datos nuevos</p>
                          <pre className="max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700">{formatAuditData(log.datos_nuevos)}</pre>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
