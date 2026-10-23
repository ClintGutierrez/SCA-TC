import { useEffect, useState } from 'react';
import * as api from '../services/api';

const initialForm = {
  bienId: '',
  motivo: '',
  observaciones: '',
  fotoFrontal: null,
  fotoLateral: null,
  documentoSustentatorio: null,
};

export default function Bajas({ bienes, canCreate }) {
  const [form, setForm] = useState(initialForm);
  const [bajas, setBajas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [bienSearch, setBienSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const loadBajas = async () => {
    setLoading(true);
    try {
      const response = await api.getBajas();
      setBajas(response.data);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'No se pudieron cargar las bajas.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBajas();
  }, []);

  const availableBienes = bienes.filter((bien) => bien.estado !== 'baja');
  const normalizedSearch = bienSearch.trim().toLowerCase();
  const suggestions = normalizedSearch.length >= 3
    ? availableBienes.filter((bien) => [
      bien.codigo_patrimonial,
      bien.numero_serie,
      bien.nombre,
      bien.marca,
      bien.modelo,
    ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch))).slice(0, 8)
    : [];

  const handleChange = (event) => {
    const { name, value, files } = event.target;
    setForm((previous) => ({ ...previous, [name]: files ? files[0] : value }));
  };

  const handleBienSearch = (event) => {
    const value = event.target.value;
    setBienSearch(value);
    setForm((previous) => ({ ...previous, bienId: '' }));
  };

  const selectBien = (bien) => {
    setBienSearch(`${bien.codigo_patrimonial || 'Sin código'} · ${bien.numero_serie || 'Sin serie'} · ${bien.nombre}`);
    setForm((previous) => ({ ...previous, bienId: String(bien.id) }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);
    if (!form.bienId || !form.motivo.trim() || !form.fotoFrontal || !form.fotoLateral) {
      setMessage({ type: 'error', text: 'Seleccione un bien, indique el motivo y adjunte la foto frontal y la foto lateral.' });
      return;
    }

    const data = new FormData();
    data.append('motivo', form.motivo.trim());
    data.append('observaciones', form.observaciones.trim());
    data.append('fotoFrontal', form.fotoFrontal);
    data.append('fotoLateral', form.fotoLateral);
    data.append('documentoSustentatorio', form.documentoSustentatorio);

    setSaving(true);
    try {
      await api.createBaja(form.bienId, data);
      setForm(initialForm);
      setBienSearch('');
      setShowForm(false);
      setMessage({ type: 'success', text: 'La baja fue registrada con sus evidencias.' });
      await loadBajas();
    } catch (error) {
      const fields = error.response?.data?.campos;
      setMessage({ type: 'error', text: fields ? Object.values(fields).join(' ') : error.response?.data?.error || 'No se pudo registrar la baja.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">Control patrimonial</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">Bajas de bienes informáticos</h2>
            <p className="mt-2 text-slate-600">Consulta las bajas realizadas y conserva sus evidencias fotográficas.</p>
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setMessage(null);
                setShowForm((visible) => !visible);
              }}
              className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-red-700"
            >
              {showForm ? 'Cerrar formulario' : 'Dar de baja un bien'}
            </button>
          )}
        </div>
      </div>

      {canCreate && showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative text-sm font-medium text-slate-700">
              <label htmlFor="bien-search">Bien a dar de baja *</label>
              <input
                id="bien-search"
                type="search"
                value={bienSearch}
                onChange={handleBienSearch}
                placeholder="Digite al menos 3 caracteres..."
                autoComplete="off"
                className={`mt-2 w-full rounded-lg border px-3 py-2.5 ${form.bienId ? 'border-green-400 bg-green-50' : 'border-slate-300'}`}
              />
              <p className="mt-1 text-xs font-normal text-slate-500">
                Busque por código patrimonial, número de serie, nombre, marca o modelo.
              </p>
              {normalizedSearch.length > 0 && normalizedSearch.length < 3 && (
                <p className="mt-1 text-xs font-normal text-amber-600">Digite 3 caracteres para mostrar sugerencias.</p>
              )}
              {normalizedSearch.length >= 3 && !form.bienId && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                  {suggestions.length > 0 ? suggestions.map((bien) => (
                    <button
                      key={bien.id}
                      type="button"
                      onClick={() => selectBien(bien)}
                      className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-blue-50"
                    >
                      <span className="block font-semibold text-slate-900">{bien.nombre}</span>
                      <span className="mt-1 block text-xs font-normal text-slate-500">
                        {bien.codigo_patrimonial || 'Sin código'} · Serie: {bien.numero_serie || 'Sin serie'} · {bien.marca || 'Sin marca'} {bien.modelo || ''}
                      </span>
                    </button>
                  )) : (
                    <p className="px-4 py-3 text-sm font-normal text-slate-500">No se encontraron bienes disponibles.</p>
                  )}
                </div>
              )}
              {form.bienId && (
                <button type="button" onClick={() => { setBienSearch(''); setForm((previous) => ({ ...previous, bienId: '' })); }} className="mt-2 text-xs font-semibold text-blue-700 hover:underline">
                  Cambiar bien seleccionado
                </button>
              )}
            </div>
            <label className="text-sm font-medium text-slate-700">
              Motivo de baja *
              <input name="motivo" value={form.motivo} onChange={handleChange} maxLength="255" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Obsolescencia, daño irreparable..." />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Foto frontal *
              <input name="fotoFrontal" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChange} className="mt-2 block w-full rounded-lg border border-slate-300 p-2 text-sm" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Foto lateral *
              <input name="fotoLateral" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChange} className="mt-2 block w-full rounded-lg border border-slate-300 p-2 text-sm" />
            </label>
            <label className="text-sm font-medium text-slate-700 md:col-span-2">
              Documento sustentatorio (opcional)
              <input name="documentoSustentatorio" type="file" accept="application/pdf,image/jpeg,image/png" onChange={handleChange} className="mt-2 block w-full rounded-lg border border-slate-300 p-2 text-sm" />
            </label>
            <label className="text-sm font-medium text-slate-700 md:col-span-2">
              Observaciones
              <textarea name="observaciones" value={form.observaciones} onChange={handleChange} rows="3" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
            </label>
          </div>
          {message && <p className={`mt-4 rounded-lg border px-4 py-3 text-sm ${message.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{message.text}</p>}
          <button type="submit" disabled={saving} className="mt-5 rounded-lg bg-red-600 px-5 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {saving ? 'Guardando evidencias...' : 'Confirmar baja'}
          </button>
        </form>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Bajas realizadas</h3>
            <p className="mt-1 text-sm text-slate-500">{bajas.length} baja{bajas.length === 1 ? '' : 's'} registrada{bajas.length === 1 ? '' : 's'}</p>
          </div>
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">Historial patrimonial</span>
        </div>
        {loading ? <p className="mt-4 text-slate-500">Cargando bajas...</p> : bajas.length === 0 ? <p className="mt-4 text-slate-500">No hay bajas registradas.</p> : (
          <div className="mt-4 space-y-3">
            {bajas.map((baja) => (
              <div key={baja.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{baja.bien_nombre}</p>
                    <p className="text-sm text-slate-500">{baja.codigo_patrimonial} · {baja.numero_serie}</p>
                  </div>
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">{baja.fecha_baja}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{baja.motivo}</p>
                <div className="mt-3 flex gap-3 text-sm font-semibold">
                  <a href={baja.foto_frontal_url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">Foto frontal</a>
                  <a href={baja.foto_lateral_url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">Foto lateral</a>
                  <a href={baja.documento_sustentatorio} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">Documento</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
