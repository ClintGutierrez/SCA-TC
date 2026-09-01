import { useState } from 'react';

export default function Mantenimiento({ bienes, canCreate, canDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [mantenimientos, setMantenimientos] = useState([]);
  const [formData, setFormData] = useState({
    bienId: '',
    tipo: 'preventivo',
    descripcion: '',
    fecha: '',
    costo: '',
    responsable: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      bienId: '',
      tipo: 'preventivo',
      descripcion: '',
      fecha: '',
      costo: '',
      responsable: '',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Implementar lógica de guardado
    resetForm();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">Gestión de Mantenimiento</h2>
        {canCreate ? (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            + Agregar Mantenimiento
          </button>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">Solo lectura para este rol</div>
        )}
      </div>

      {showForm && canCreate && (
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <select
                name="bienId"
                value={formData.bienId}
                onChange={handleInputChange}
                className="px-4 py-2 border rounded"
                required
              >
                <option value="">Selecciona el equipo</option>
                {bienes.map(bien => (
                  <option key={bien.id} value={bien.id}>
                    {bien.nombre} ({bien.tipo})
                  </option>
                ))}
              </select>

              <select
                name="tipo"
                value={formData.tipo}
                onChange={handleInputChange}
                className="px-4 py-2 border rounded"
                required
              >
                <option value="preventivo">Preventivo</option>
                <option value="correctivo">Correctivo</option>
                <option value="repotenciacion">Repotenciación</option>
              </select>
            </div>

            <textarea
              name="descripcion"
              placeholder="Descripción del mantenimiento"
              value={formData.descripcion}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border rounded"
            />

            <div className="grid grid-cols-3 gap-4">
              <input
                type="date"
                name="fecha"
                value={formData.fecha}
                onChange={handleInputChange}
                className="px-4 py-2 border rounded"
                required
              />

              <input
                type="number"
                name="costo"
                placeholder="Costo"
                value={formData.costo}
                onChange={handleInputChange}
                className="px-4 py-2 border rounded"
              />

              <input
                type="text"
                name="responsable"
                placeholder="Responsable"
                value={formData.responsable}
                onChange={handleInputChange}
                className="px-4 py-2 border rounded"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left">Equipo</th>
              <th className="px-6 py-3 text-left">Tipo</th>
              <th className="px-6 py-3 text-left">Descripción</th>
              <th className="px-6 py-3 text-left">Fecha</th>
              <th className="px-6 py-3 text-left">Costo</th>
              <th className="px-6 py-3 text-left">Responsable</th>
              <th className="px-6 py-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {mantenimientos.map(m => (
              <tr key={m.id} className="border-t hover:bg-gray-50">
                <td className="px-6 py-3">{m.equipoNombre}</td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-1 rounded text-sm ${
                    m.tipo === 'preventivo' ? 'bg-blue-100 text-blue-800' :
                    m.tipo === 'correctivo' ? 'bg-orange-100 text-orange-800' :
                    'bg-purple-100 text-purple-800'
                  }`}>
                    {m.tipo}
                  </span>
                </td>
                <td className="px-6 py-3">{m.descripcion}</td>
                <td className="px-6 py-3">{new Date(m.fecha).toLocaleDateString()}</td>
                <td className="px-6 py-3">S/ {m.costo?.toFixed(2)}</td>
                <td className="px-6 py-3">{m.responsable}</td>
                <td className="px-6 py-3">
                  <button className="text-blue-600 hover:text-blue-800 mr-4">
                    Editar
                  </button>
                  {canDelete && (
                    <button className="text-red-600 hover:text-red-800">
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
