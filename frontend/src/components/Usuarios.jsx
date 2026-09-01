import { useEffect, useMemo, useState } from 'react';
import * as api from '../services/api';

const defaultForm = {
  nombre: '',
  email: '',
  departamento: '',
  rol: 'tecnico',
  estado: 'activo',
  activoLogin: true,
  password: '',
};

const roleLabels = {
  administrador: 'Administrador',
  jefatura: 'Jefatura',
  tecnico: 'Técnico',
};

export default function Usuarios({ usuarios: initialUsuarios = [], onRefresh, currentUser }) {
  const [usuarios, setUsuarios] = useState(initialUsuarios);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState(defaultForm);

  useEffect(() => {
    setUsuarios(initialUsuarios);
  }, [initialUsuarios]);

  useEffect(() => {
    loadUsuarios();
  }, []);

  const loadUsuarios = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getUsuarios();
      setUsuarios(response.data);
      onRefresh?.();
    } catch (fetchError) {
      setError(fetchError?.response?.data?.error || 'No se pudieron cargar los usuarios');
    } finally {
      setLoading(false);
    }
  };

  const roleStats = useMemo(() => {
    return usuarios.reduce(
      (accumulator, user) => {
        const role = user.rol || 'tecnico';
        accumulator.total += 1;
        accumulator[role] = (accumulator[role] || 0) + 1;
        return accumulator;
      },
      { total: 0, administrador: 0, jefatura: 0, tecnico: 0 },
    );
  }, [usuarios]);

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const resetForm = () => {
    setEditingId(null);
    setShowForm(false);
    setFormData(defaultForm);
  };

  const handleEdit = (usuario) => {
    setEditingId(usuario.id);
    setFormData({
      nombre: usuario.nombre || '',
      email: usuario.email || '',
      departamento: usuario.departamento || '',
      rol: usuario.rol || 'tecnico',
      estado: usuario.estado || 'activo',
      activoLogin: usuario.activo_login !== false,
      password: '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        nombre: formData.nombre,
        email: formData.email,
        departamento: formData.departamento,
        rol: formData.rol,
        estado: formData.estado,
        activoLogin: formData.activoLogin,
      };

      if (!editingId || formData.password) {
        payload.password = formData.password;
      }

      if (editingId) {
        await api.updateUsuario(editingId, payload);
      } else {
        await api.createUsuario({ ...payload, password: formData.password });
      }

      await loadUsuarios();
      resetForm();
    } catch (submitError) {
      setError(submitError?.response?.data?.error || 'No se pudo guardar el usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async (id) => {
    if (!window.confirm('¿Deseas deshabilitar este usuario?')) {
      return;
    }

    setSaving(true);
    setError('');
    try {
      await api.disableUsuario(id);
      await loadUsuarios();
    } catch (disableError) {
      setError(disableError?.response?.data?.error || 'No se pudo deshabilitar el usuario');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total usuarios', value: roleStats.total, tone: 'from-blue-500 to-cyan-400' },
          { label: 'Administradores', value: roleStats.administrador, tone: 'from-violet-500 to-fuchsia-400' },
          { label: 'Jefaturas', value: roleStats.jefatura, tone: 'from-emerald-500 to-teal-400' },
          { label: 'Técnicos', value: roleStats.tecnico, tone: 'from-amber-500 to-orange-400' },
        ].map((item) => (
          <div key={item.label} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{item.label}</p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <p className="text-4xl font-semibold tracking-tight text-slate-950">{item.value}</p>
              <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${item.tone}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">Usuarios del sistema</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Gestión de accesos y credenciales</h2>
          <p className="mt-2 text-sm text-slate-500">Solo administradores pueden crear, editar o deshabilitar cuentas.</p>
        </div>
        {currentUser?.rol === 'administrador' && (
          <button
            onClick={() => setShowForm((previous) => !previous)}
            className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:from-blue-700 hover:to-indigo-700"
          >
            {showForm ? 'Cerrar formulario' : 'Nuevo usuario'}
          </button>
        )}
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {showForm && currentUser?.rol === 'administrador' && (
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-950">{editingId ? 'Editar usuario' : 'Crear usuario'}</h3>
              <p className="mt-1 text-sm text-slate-500">{editingId ? 'Actualiza credenciales y rol.' : 'Asigna un acceso al sistema con rol específico.'}</p>
            </div>
            <button type="button" onClick={resetForm} className="text-sm font-semibold text-slate-500 hover:text-slate-900">Cerrar</button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Nombre</span>
                <input name="nombre" value={formData.nombre} onChange={handleInputChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100" required />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Email</span>
                <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100" required />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Departamento</span>
                <input name="departamento" value={formData.departamento} onChange={handleInputChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Rol</span>
                <select name="rol" value={formData.rol} onChange={handleInputChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100">
                  <option value="administrador">Administrador</option>
                  <option value="jefatura">Jefatura</option>
                  <option value="tecnico">Técnico</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Estado</span>
                <select name="estado" value={formData.estado} onChange={handleInputChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100">
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Contraseña {editingId ? '(opcional)' : ''}</span>
                <input type="password" name="password" value={formData.password} onChange={handleInputChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100" placeholder={editingId ? 'Dejar en blanco para conservar' : 'Nueva contraseña'} required={!editingId} />
              </label>
              <label className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:mt-0">
                <input type="checkbox" name="activoLogin" checked={formData.activoLogin} onChange={handleInputChange} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm font-medium text-slate-700">Habilitar acceso al sistema</span>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={saving} className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60">
                {saving ? 'Guardando...' : 'Guardar usuario'}
              </button>
              <button type="button" onClick={resetForm} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="text-left text-xs uppercase tracking-[0.28em] text-slate-400">
              <tr>
                <th className="px-4 py-4">Nombre</th>
                <th className="px-4 py-4">Email</th>
                <th className="px-4 py-4">Departamento</th>
                <th className="px-4 py-4">Rol</th>
                <th className="px-4 py-4">Estado</th>
                <th className="px-4 py-4">Último acceso</th>
                <th className="px-4 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-10 text-center text-slate-500">Cargando usuarios...</td>
                </tr>
              ) : usuarios.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-10 text-center text-slate-500">No hay usuarios registrados</td>
                </tr>
              ) : (
                usuarios.map((usuario) => (
                  <tr key={usuario.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-4 font-medium text-slate-900">{usuario.nombre}</td>
                    <td className="px-4 py-4 text-slate-600">{usuario.email}</td>
                    <td className="px-4 py-4 text-slate-600">{usuario.departamento || '-'}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{roleLabels[usuario.rol] || usuario.rol}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${usuario.estado === 'activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {usuario.estado === 'activo' ? 'Activo' : 'Inactivo'}
                      </span>
                      <p className="mt-2 text-xs text-slate-500">{usuario.activo_login ? 'Acceso habilitado' : 'Acceso bloqueado'}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-500">{usuario.last_login ? new Date(usuario.last_login).toLocaleString('es-PE') : 'Sin acceso registrado'}</td>
                    <td className="px-4 py-4">
                      {currentUser?.rol === 'administrador' ? (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleEdit(usuario)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700">
                            Editar
                          </button>
                          <button onClick={() => handleDisable(usuario.id)} className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50" disabled={saving}>
                            Deshabilitar
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">Solo lectura</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
