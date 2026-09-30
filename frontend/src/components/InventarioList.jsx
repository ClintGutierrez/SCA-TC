import { useState } from 'react';
import * as api from '../services/api';

export default function InventarioList({ bienes, onRefresh, canCreate, canEdit, canDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [historyBien, setHistoryBien] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    tipo: '',
    marca: '',
    modelo: '',
    numeroSerie: '',
    fechaAdquisicion: '',
    costo: '',
    usuarioAsignado: '',
    ubicacion: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      descripcion: '',
      tipo: '',
      marca: '',
      modelo: '',
      numeroSerie: '',
      fechaAdquisicion: '',
      costo: '',
      usuarioAsignado: '',
      ubicacion: '',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        const response = await api.updateBien(editingId, formData);
        setSuccessMessage(response.data.message);
      } else {
        await api.createBien(formData);
      }
      resetForm();
      onRefresh();
    } catch (error) {
      console.error('Error:', error);
      alert(error?.response?.data?.error || 'Error al guardar el bien');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (bien) => {
    setFormData({
      nombre: bien.nombre,
      descripcion: bien.descripcion,
      tipo: bien.tipo,
      marca: bien.marca,
      modelo: bien.modelo,
      numeroSerie: bien.numero_serie,
      fechaAdquisicion: bien.fecha_adquisicion?.slice(0, 10) || '',
      costo: bien.costo,
      usuarioAsignado: bien.usuario_asignado,
      ubicacion: bien.ubicacion,
    });
    setEditingId(bien.id);
    setShowForm(true);
  };

  const handleShowHistory = async (bien) => {
    setHistoryBien(bien);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const response = await api.getHistorialBien(bien.id);
      setHistory(response.data);
    } catch (error) {
      console.error('Error cargando historial:', error);
      setHistoryBien(null);
      alert(error?.response?.data?.error || 'Error al cargar el historial del bien');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este bien?')) {
      setLoading(true);
      try {
        await api.deleteBien(id);
        onRefresh();
      } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar el bien');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Inventario de Bienes</h1>
          <p className="text-slate-600 mt-2">Total: {bienes.length} equipos</p>
        </div>
        {canCreate ? (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
            disabled={loading}
          >
            <span>➕</span> Agregar Equipo
          </button>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
            Modo lectura para tu perfil
          </div>
        )}
      </div>

      {/* Formulario */}
      {successMessage && (
        <div role="status" className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          <span>{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage('')} aria-label="Cerrar mensaje" className="ml-4 text-green-700 hover:text-green-900">✕</button>
        </div>
      )}

      {showForm && (canCreate || canEdit) && (
        <div
          className={editingId ? 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4' : ''}
          role={editingId ? 'presentation' : undefined}
          onClick={editingId ? (event) => {
            if (event.target === event.currentTarget) resetForm();
          } : undefined}
        >
          <section
            className={`bg-white rounded-xl shadow-md border border-slate-200 p-6 overflow-hidden ${editingId ? 'max-h-[90vh] w-full max-w-4xl overflow-y-auto' : ''}`}
            role={editingId ? 'dialog' : undefined}
            aria-modal={editingId ? 'true' : undefined}
            aria-labelledby="asset-form-title"
          >
          <h3 id="asset-form-title" className="text-xl font-bold text-slate-900 mb-6">
            {editingId ? 'Actualizar Ficha Técnica de Bien Informático' : 'Registrar Nuevo Bien'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nombre *</label>
                <input
                  type="text"
                  name="nombre"
                  placeholder="Nombre del equipo"
                  value={formData.nombre}
                  onChange={handleInputChange}
                  autoFocus={Boolean(editingId)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tipo *</label>
                <select
                  name="tipo"
                  value={formData.tipo}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  required
                >
                  <option value="">Selecciona tipo</option>
                  <option value="computadora">Computadora</option>
                  <option value="laptop">Laptop</option>
                  <option value="impresora">Impresora</option>
                  <option value="servidor">Servidor</option>
                  <option value="monitor">Monitor</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Marca</label>
                <input
                  type="text"
                  name="marca"
                  placeholder="Marca"
                  value={formData.marca}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Modelo</label>
                <input
                  type="text"
                  name="modelo"
                  placeholder="Modelo"
                  value={formData.modelo}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Serie</label>
                <input
                  type="text"
                  name="numeroSerie"
                  placeholder="Número de serie"
                  value={formData.numeroSerie}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Descripción</label>
              <textarea
                name="descripcion"
                placeholder="Descripción del equipo"
                value={formData.descripcion}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                rows="3"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Fecha de Adquisición *</label>
                <input
                  type="date"
                  name="fechaAdquisicion"
                  value={formData.fechaAdquisicion}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Costo (S/) *</label>
                <input
                  type="number"
                  name="costo"
                  placeholder="0.00"
                  step="0.01"
                  value={formData.costo}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Usuario Asignado</label>
                <input
                  type="text"
                  name="usuarioAsignado"
                  placeholder="Usuario o departamento"
                  value={formData.usuarioAsignado}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Ubicación</label>
                <input
                  type="text"
                  name="ubicacion"
                  placeholder="Ubicación física"
                  value={formData.ubicacion}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-200">
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? '⏳ Guardando...' : editingId ? '💾 Guardar cambios' : '💾 Guardar'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-slate-300 hover:bg-slate-400 text-slate-800 px-6 py-2.5 rounded-lg font-semibold transition-all duration-200"
              >
                ✕ Cancelar
              </button>
            </div>
          </form>
          </section>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
              <tr>
                <th className="px-6 py-4 text-left font-semibold">Equipo</th>
                <th className="px-6 py-4 text-left font-semibold">Tipo</th>
                <th className="px-6 py-4 text-left font-semibold">Marca/Modelo</th>
                <th className="px-6 py-4 text-right font-semibold">Costo</th>
                <th className="px-6 py-4 text-left font-semibold">Asignado a</th>
                <th className="px-6 py-4 text-center font-semibold">Estado</th>
                <th className="px-6 py-4 text-center font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {bienes && bienes.length > 0 ? (
                bienes.map(bien => (
                  <tr key={bien.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 font-medium text-slate-900">{bien.nombre}</td>
                    <td className="px-6 py-4 text-slate-600">
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                        {bien.tipo}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-sm">
                      {bien.marca || '-'} {bien.modelo ? `/ ${bien.modelo}` : ''}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900">
                      S/ {Number(bien.costo || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {bien.usuario_asignado || <span className="text-slate-400">Sin asignar</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                        bien.estado === 'activo'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {bien.estado === 'activo' ? '✓ Activo' : '✕ Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex gap-2 justify-center">
                        {canEdit && (['baja', 'dado_de_baja'].includes(String(bien.estado).toLowerCase()) ? (
                          <span className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800" title="Bien dado de baja - Ficha bloqueada">
                            Ficha bloqueada
                          </span>
                        ) : (
                          <button
                            onClick={() => handleEdit(bien)}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1 rounded transition font-semibold text-sm"
                            disabled={loading}
                          >
                            📝 Actualizar Ficha Técnica
                          </button>
                        ))}
                        <button
                          onClick={() => handleShowHistory(bien)}
                          className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-1 rounded transition font-semibold text-sm"
                          disabled={historyLoading}
                        >
                          🕒 Historial
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(bien.id)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded transition font-semibold text-sm"
                            disabled={loading}
                          >
                            🗑️ Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-slate-500">
                    <span className="text-2xl">📭</span>
                    <p className="mt-2">No hay bienes registrados</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {historyBien && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onClick={() => setHistoryBien(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-title"
            className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="history-title" className="text-xl font-bold text-slate-900">Historial de ficha técnica</h2>
                <p className="mt-1 text-sm text-slate-600">{historyBien.nombre}</p>
              </div>
              <button type="button" onClick={() => setHistoryBien(null)} aria-label="Cerrar historial" className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900">✕</button>
            </div>
            {historyLoading ? (
              <p className="py-8 text-center text-slate-500">Cargando historial...</p>
            ) : history.length === 0 ? (
              <p className="py-8 text-center text-slate-500">Este bien aún no tiene versiones anteriores.</p>
            ) : (
              <ol className="space-y-4">
                {history.map((version) => {
                  const previous = typeof version.datos_anteriores === 'string'
                    ? JSON.parse(version.datos_anteriores)
                    : version.datos_anteriores;
                  return (
                    <li key={version.id} className="border-l-2 border-blue-200 pl-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {new Date(version.created_at).toLocaleString('es-PE')} · {version.modificado_por_nombre || 'Usuario no disponible'}
                      </p>
                      <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                        {[
                          ['Nombre', previous.nombre], ['Tipo', previous.tipo], ['Marca', previous.marca],
                          ['Modelo', previous.modelo], ['Número de serie', previous.numero_serie],
                          ['Fecha de adquisición', previous.fecha_adquisicion], ['Costo', previous.costo],
                          ['Asignado a', previous.usuario_asignado], ['Ubicación', previous.ubicacion],
                          ['Descripción', previous.descripcion],
                        ].map(([label, value]) => (
                          <div key={label} className="flex gap-2">
                            <dt className="shrink-0 text-slate-500">{label}:</dt>
                            <dd className="break-words text-slate-800">{value || 'Sin dato'}</dd>
                          </div>
                        ))}
                      </dl>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
