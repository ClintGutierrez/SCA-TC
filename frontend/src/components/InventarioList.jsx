import { useState } from 'react';
import * as api from '../services/api';

export default function InventarioList({ bienes, onRefresh, canCreate, canEdit, canDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
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
        await api.updateBien(editingId, formData);
      } else {
        await api.createBien(formData);
      }
      resetForm();
      onRefresh();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar el bien');
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
      fechaAdquisicion: bien.fecha_adquisicion,
      costo: bien.costo,
      usuarioAsignado: bien.usuario_asignado,
      ubicacion: bien.ubicacion,
    });
    setEditingId(bien.id);
    setShowForm(true);
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
      {showForm && canCreate && (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 overflow-hidden">
          <h3 className="text-xl font-bold text-slate-900 mb-6">
            {editingId ? 'Editar Bien' : 'Registrar Nuevo Bien'}
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
                {loading ? '⏳ Guardando...' : '💾 Guardar'}
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
                      S/ {bien.costo?.toFixed(2) || '0.00'}
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
                        {canEdit && (
                          <button
                            onClick={() => handleEdit(bien)}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1 rounded transition font-semibold text-sm"
                            disabled={loading}
                          >
                            ✏️ Editar
                          </button>
                        )}
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
    </div>
  );
}
