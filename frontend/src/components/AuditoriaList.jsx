import { useState, useEffect } from 'react';
import * as api from '../services/api';

export default function AuditoriaList() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // NUEVO: Estado para controlar la ventana emergente (Pasos 5 y 6)
  const [logSeleccionado, setLogSeleccionado] = useState(null);
  
  const [filtros, setFiltros] = useState({
    desde: '', hasta: '', usuario: '', modulo: '', accion: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFiltros(prev => ({ ...prev, [name]: value }));
  };

  const buscarLogs = async (e) => {
    if (e) e.preventDefault();
    
    if (filtros.desde && filtros.hasta && new Date(filtros.hasta) < new Date(filtros.desde)) {
      alert("El rango de fechas ingresado no es valido. Verifique los parametros de busqueda");
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await api.getAuditoria(filtros);
      setLogs(response.data || []);
      
      if (response.data?.length === 0) {
        setError("No se encontraron registros de auditoria para los criterios especificados");
      }
    } catch (err) {
      if (err.response?.status === 408) {
        setError("La consulta excede el limite de procesamiento. Por favor refine los filtros aplicados");
      } else {
        setError("Ocurrió un error al consultar el log de auditoría.");
      }
    } finally {
      setLoading(false);
    }
  };

  // NUEVO: Función para exportar la auditoría (Pasos 7, 8 y 9)
  const exportarAuditoria = () => {
    if (logs.length === 0) return alert("No hay datos para exportar");
    
    const headers = ["Fecha", "Usuario", "Accion", "Modulo", "IP Origen", "Resultado"];
    const csv = [
      headers.join(','),
      ...logs.map(log => [
        new Date(log.fecha_hora).toLocaleString('es-PE').replace(/,/g, ''),
        log.usuario,
        log.accion,
        log.modulo,
        log.ip_origen,
        log.resultado
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Log_Auditoria_${new Date().getTime()}.csv`;
    a.click();
  };

  useEffect(() => {
    buscarLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">Seguridad y Administración</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Log de Auditoría</h2>
          <p className="mt-2 text-sm text-slate-500">Consulta la trazabilidad inmutable de las operaciones realizadas en el sistema.</p>
        </div>
        {/* NUEVO: Botón de exportación */}
        <button onClick={exportarAuditoria} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-2">
          <span>📥</span> Exportar Excel/CSV
        </button>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={buscarLogs} className="space-y-4">
           {/* ... (Mantén tus inputs de filtros exactamente igual que antes) ... */}
           <div className="grid gap-4 md:grid-cols-5">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Desde</span>
              <input type="date" name="desde" value={filtros.desde} onChange={handleInputChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Hasta</span>
              <input type="date" name="hasta" value={filtros.hasta} onChange={handleInputChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Usuario</span>
              <input type="text" name="usuario" placeholder="Nombre..." value={filtros.usuario} onChange={handleInputChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Módulo</span>
              <select name="modulo" value={filtros.modulo} onChange={handleInputChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100">
                <option value="">Todos</option>
                <option value="Usuarios">Usuarios</option>
                <option value="Bienes">Bienes</option>
                <option value="Mantenimiento">Mantenimiento</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Acción</span>
              <select name="accion" value={filtros.accion} onChange={handleInputChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100">
                <option value="">Todas</option>
                <option value="Creación">Creación</option>
                <option value="Edición">Edición</option>
                <option value="Eliminación">Eliminación</option>
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setFiltros({ desde: '', hasta: '', usuario: '', modulo: '', accion: '' })} className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Limpiar</button>
            <button type="submit" disabled={loading} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{loading ? 'Consultando...' : 'Aplicar Filtros'}</button>
          </div>
        </form>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 text-center">
          {error}
        </div>
      )}

      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="text-left text-xs uppercase tracking-[0.2em] text-slate-400">
              <tr>
                <th className="px-4 py-4">Fecha y Hora</th>
                <th className="px-4 py-4">Usuario</th>
                <th className="px-4 py-4">Acción</th>
                <th className="px-4 py-4">Módulo</th>
                <th className="px-4 py-4">IP Origen</th>
                <th className="px-4 py-4">Resultado</th>
                <th className="px-4 py-4 text-center">Detalle</th> {/* NUEVA COLUMNA */}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id_log || log.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-4 text-sm font-medium text-slate-900">{new Date(log.fecha_hora).toLocaleString('es-PE')}</td>
                  <td className="px-4 py-4 text-sm text-slate-600">{log.usuario}</td>
                  <td className="px-4 py-4 text-sm"><span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">{log.accion}</span></td>
                  <td className="px-4 py-4 text-sm text-slate-600">{log.modulo}</td>
                  <td className="px-4 py-4 text-sm text-slate-500 font-mono">{log.ip_origen}</td>
                  <td className="px-4 py-4 text-sm">
                    <span className={`font-semibold ${log.resultado === 'Éxito' ? 'text-emerald-600' : 'text-rose-600'}`}>{log.resultado}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    {/* NUEVO: Botón para abrir modal */}
                    <button onClick={() => setLogSeleccionado(log)} className="text-blue-600 hover:text-blue-800 font-semibold text-sm px-3 py-1 rounded bg-blue-50 transition">
                      Inspeccionar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* NUEVO: Ventana Emergente (Modal) para el Detalle del Evento (Paso 6) */}
      {logSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[32px] bg-white p-8 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Detalle de Operación</h3>
                <p className="text-sm text-slate-500 mt-1">ID Transacción: {logSeleccionado.id_log || logSeleccionado.id}</p>
              </div>
              <button onClick={() => setLogSeleccionado(null)} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200">
                ✕
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-slate-500 font-medium">Actor</p>
                <p className="font-semibold text-slate-900 mt-1">{logSeleccionado.usuario}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-slate-500 font-medium">Fecha Exacta</p>
                <p className="font-semibold text-slate-900 mt-1">{new Date(logSeleccionado.fecha_hora).toLocaleString('es-PE')}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6">
              <div>
                <p className="font-semibold text-slate-700 mb-2">Datos Modificados (Nuevos):</p>
                <pre className="rounded-xl bg-slate-950 p-4 text-sm text-emerald-400 overflow-x-auto font-mono">
                  {logSeleccionado.datos_modificados ? JSON.stringify(logSeleccionado.datos_modificados, null, 2) : 'Sin datos registrados'}
                </pre>
              </div>
              <div>
                <p className="font-semibold text-slate-700 mb-2">Datos Previos (Anteriores):</p>
                <pre className="rounded-xl bg-slate-950 p-4 text-sm text-rose-400 overflow-x-auto font-mono">
                  {logSeleccionado.datos_previos ? JSON.stringify(logSeleccionado.datos_previos, null, 2) : 'Sin datos previos (Aplica para creación)'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}