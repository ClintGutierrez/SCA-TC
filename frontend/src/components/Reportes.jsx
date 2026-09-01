import { useState, useEffect } from 'react';
import * as api from '../services/api';

export default function Reportes() {
  const [reporteInventario, setReporteInventario] = useState(null);
  const [reporteDepreciacion, setReporteDepreciacion] = useState([]);
  const [reporteMantenimiento, setReporteMantenimiento] = useState([]);
  const [reporteAsignaciones, setReporteAsignaciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('inventario');

  useEffect(() => {
    fetchReportes();
  }, []);

  const fetchReportes = async () => {
    setLoading(true);
    try {
      const [inv, dep, man, asig] = await Promise.all([
        api.getReporteInventario(),
        api.getReporteDepreciacion(),
        api.getReporteMantenimiento(),
        api.getReporteAsignaciones(),
      ]);
      
      setReporteInventario(inv.data);
      setReporteDepreciacion(dep.data);
      setReporteMantenimiento(man.data);
      setReporteAsignaciones(asig.data);
    } catch (error) {
      console.error('Error fetching reportes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = (data, filename) => {
    if (!data || data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row => headers.map(h => row[h] || '').join(','))].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">Reportes</h2>
        <button
          onClick={fetchReportes}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b">
        {['inventario', 'depreciacion', 'mantenimiento', 'asignaciones'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium ${
              activeTab === tab
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Reporte de Inventario */}
      {activeTab === 'inventario' && reporteInventario && (
        <div>
          <h3 className="text-2xl font-bold mb-4">Reporte de Inventario</h3>
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
              <p className="text-gray-600 text-sm">Total de Bienes</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{reporteInventario.total_bienes}</p>
            </div>
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <p className="text-gray-600 text-sm">Activos</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{reporteInventario.activos}</p>
            </div>
            <div className="bg-red-50 p-6 rounded-lg border border-red-200">
              <p className="text-gray-600 text-sm">Inactivos</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{reporteInventario.inactivos}</p>
            </div>
            <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
              <p className="text-gray-600 text-sm">Valor Total</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">S/ {parseFloat(reporteInventario.valor_total || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Reporte de Depreciación */}
      {activeTab === 'depreciacion' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold">Reporte de Depreciación</h3>
            <button
              onClick={() => handleExportCSV(reporteDepreciacion, 'reporte-depreciacion')}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Exportar CSV
            </button>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left">Nombre</th>
                  <th className="px-6 py-3 text-left">Tipo</th>
                  <th className="px-6 py-3 text-left">Valor Inicial</th>
                  <th className="px-6 py-3 text-left">Valor Actual</th>
                  <th className="px-6 py-3 text-left">Depreciación</th>
                  <th className="px-6 py-3 text-left">% Depreciación</th>
                </tr>
              </thead>
              <tbody>
                {reporteDepreciacion.map(item => (
                  <tr key={item.id} className="border-t hover:bg-gray-50">
                    <td className="px-6 py-3">{item.nombre}</td>
                    <td className="px-6 py-3">{item.tipo}</td>
                    <td className="px-6 py-3">S/ {parseFloat(item.valor_inicial || 0).toFixed(2)}</td>
                    <td className="px-6 py-3">S/ {parseFloat(item.valor_actual || 0).toFixed(2)}</td>
                    <td className="px-6 py-3">S/ {parseFloat(item.depreciacion_total || 0).toFixed(2)}</td>
                    <td className="px-6 py-3">{parseFloat(item.porcentaje_depreciacion || 0).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reporte de Mantenimiento */}
      {activeTab === 'mantenimiento' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold">Reporte de Mantenimiento</h3>
            <button
              onClick={() => handleExportCSV(reporteMantenimiento, 'reporte-mantenimiento')}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Exportar CSV
            </button>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left">Equipo</th>
                  <th className="px-6 py-3 text-left">Tipo</th>
                  <th className="px-6 py-3 text-left">Mantenimientos</th>
                  <th className="px-6 py-3 text-left">Costo Total</th>
                  <th className="px-6 py-3 text-left">Último Mantenimiento</th>
                </tr>
              </thead>
              <tbody>
                {reporteMantenimiento.map((item, idx) => (
                  <tr key={idx} className="border-t hover:bg-gray-50">
                    <td className="px-6 py-3">{item.nombre}</td>
                    <td className="px-6 py-3">{item.tipo}</td>
                    <td className="px-6 py-3">{item.cantidad_mantenimientos || 0}</td>
                    <td className="px-6 py-3">S/ {parseFloat(item.costo_total_mantenimiento || 0).toFixed(2)}</td>
                    <td className="px-6 py-3">{item.ultimo_mantenimiento ? new Date(item.ultimo_mantenimiento).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reporte de Asignaciones */}
      {activeTab === 'asignaciones' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold">Reporte de Asignaciones</h3>
            <button
              onClick={() => handleExportCSV(reporteAsignaciones, 'reporte-asignaciones')}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Exportar CSV
            </button>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left">Usuario</th>
                  <th className="px-6 py-3 text-left">Cantidad de Equipos</th>
                  <th className="px-6 py-3 text-left">Equipos</th>
                </tr>
              </thead>
              <tbody>
                {reporteAsignaciones.map((item, idx) => (
                  <tr key={idx} className="border-t hover:bg-gray-50">
                    <td className="px-6 py-3">{item.usuario}</td>
                    <td className="px-6 py-3">{item.cantidad_equipos || 0}</td>
                    <td className="px-6 py-3 max-w-xs truncate">{item.equipos || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

