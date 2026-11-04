import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as api from '../services/api';

const inputClass = 'mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100';
const stateLabels = {
  solicitado: 'Solicitado',
  en_almacen: 'En almacén – Pendiente',
  recepcionado: 'Recepcionado',
  cancelado: 'Cancelado',
};
const stateClasses = {
  solicitado: 'bg-amber-100 text-amber-800',
  en_almacen: 'bg-blue-100 text-blue-800',
  recepcionado: 'bg-emerald-100 text-emerald-800',
  cancelado: 'bg-rose-100 text-rose-800',
};
const localDateTime = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('es-PE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value))
  : '—';

const comparePedidoNumbers = (first, second) => {
  const parsePedidoNumber = (value) => {
    const match = /^OC-(\d{4})-(\d{4})$/.exec(String(value || '').trim());
    if (match) return { year: Number(match[1]), sequence: Number(match[2]) };

    const numeric = /^(\d+)$/.exec(String(value || '').trim());
    return numeric ? { year: 0, sequence: Number(numeric[1]) } : { year: -1, sequence: -1 };
  };

  const firstNumber = parsePedidoNumber(first.numero_pedido);
  const secondNumber = parsePedidoNumber(second.numero_pedido);

  return (secondNumber.year - firstNumber.year) || (secondNumber.sequence - firstNumber.sequence);
};

export default function Almacen({
  currentUser,
  permissions,
  initialPedidoId = null,
  onPedidoOpened,
}) {
  const [pedidos, setPedidos] = useState([]);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [tecnicos, setTecnicos] = useState([]);
  const [form, setForm] = useState({
    numero_pedido: '',
    descripcion: '',
    cantidad: '1',
  });
  const [arrivalForm, setArrivalForm] = useState({
    fecha_llegada: localDateTime(),
    observaciones_almacen: '',
  });
  const [deriveForm, setDeriveForm] = useState({
    derivado_a_usuario_id: '',
    observaciones_derivacion: '',
  });
  const [receiveForm, setReceiveForm] = useState({
    conformidad: 'conforme',
    observaciones_recepcion: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pedidoToCancel, setPedidoToCancel] = useState(null);

  const loadPedidos = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getPedidos({
        ...(statusFilter ? { estado: statusFilter } : {}),
        ...(query ? { search: query } : {}),
      });
      setPedidos(response.data);
      if (canCreate) {
        const nextNumber = await api.getNextPedidoNumber();
        setForm((previous) => ({
          ...previous,
          numero_pedido: nextNumber.data.numero_pedido,
        }));
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'No se pudieron cargar los pedidos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPedidos(); }, [statusFilter, query]);

  useEffect(() => {
    if (currentUser?.rol !== 'jefatura') return;
    api.getTecnicosActivos()
      .then((response) => {
        setTecnicos(response.data.filter((user) => (
          user.rol === 'tecnico'
          && user.estado === 'activo'
          && user.activo_login !== false
        )));
      })
      .catch((requestError) => {
        setError(requestError?.response?.data?.error || 'No se pudieron cargar los usuarios de TI');
      });
  }, [currentUser?.rol]);

  useEffect(() => {
    if (!initialPedidoId) return;
    api.getPedido(initialPedidoId)
      .then((response) => setSelectedPedido(response.data))
      .catch((requestError) => {
        setError(requestError?.response?.data?.error || 'No se pudo abrir el pedido de la notificación');
      })
      .finally(() => onPedidoOpened?.());
  }, [initialPedidoId, onPedidoOpened]);

  useEffect(() => {
    if (!selectedPedido) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event) => {
      if (event.key === 'Escape') setSelectedPedido(null);
    };
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [selectedPedido]);

  const canCreate = currentUser?.rol === 'administrador' && permissions?.canCreatePedido === true;
  const canArrive = permissions?.canRegisterArrival;
  const canDerive = permissions?.canDerivePedido;
  const canReceive = permissions?.canReceivePedido;
  const activeTechnicians = tecnicos;

  const openPedido = async (id) => {
    setError('');
    setMessage('');
    try {
      const response = await api.getPedido(id);
      setSelectedPedido(response.data);
      setDeriveForm({ derivado_a_usuario_id: '', observaciones_derivacion: '' });
      setReceiveForm({ conformidad: 'conforme', observaciones_recepcion: '' });
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'No se pudo obtener el detalle del pedido');
    }
  };

  const submitCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.createPedido({ ...form, cantidad: Number(form.cantidad) });
      setForm({ numero_pedido: '', descripcion: '', cantidad: '1' });
      setMessage(`Pedido ${response.data.numero_pedido} creado.`);
      await loadPedidos();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'No se pudo crear el pedido');
    } finally {
      setSaving(false);
    }
  };

  const confirmCancelPedido = async () => {
    if (!pedidoToCancel) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.cancelarPedido(pedidoToCancel.id);
      setMessage(response.data.message || `Pedido ${pedidoToCancel.numero_pedido} cancelado.`);
      if (selectedPedido?.id === pedidoToCancel.id) setSelectedPedido(null);
      setPedidoToCancel(null);
      await loadPedidos();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'No se pudo cancelar el pedido');
      setPedidoToCancel(null);
    } finally {
      setSaving(false);
    }
  };

  const runPedidoAction = async (action, successMessage) => {
    if (!selectedPedido) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await action(selectedPedido.id);
      const emailResults = response.data.correo || [];
      const failedEmails = emailResults.filter((item) => item.status !== 'enviado');
      const emailMessage = failedEmails.length
        ? ` Correo pendiente o fallido: ${failedEmails.map((item) => item.reason || item.status).join('; ')}.`
        : emailResults.length ? ' Correo de aviso enviado.' : '';
      setMessage(`${response.data.message || successMessage}${emailMessage}`);
      await loadPedidos();
      const detail = await api.getPedido(selectedPedido.id);
      setSelectedPedido(detail.data);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'No se pudo actualizar el pedido');
    } finally {
      setSaving(false);
    }
  };

  const submitArrival = (event) => {
    event.preventDefault();
    const date = new Date(arrivalForm.fecha_llegada);
    if (Number.isNaN(date.getTime())) {
      setError('La fecha de llegada no es válida');
      return;
    }
    runPedidoAction(
      (id) => api.registrarLlegadaPedido(id, {
        ...arrivalForm,
        fecha_llegada: date.toISOString(),
      }),
      'Llegada registrada y jefatura notificada.',
    );
  };

  const submitDerivation = (event) => {
    event.preventDefault();
    runPedidoAction(
      (id) => api.derivarPedido(id, deriveForm),
      'Pedido derivado correctamente.',
    );
  };

  const submitReception = (event) => {
    event.preventDefault();
    runPedidoAction(
      (id) => api.recepcionarPedido(id, receiveForm),
      'Recepción del pedido registrada.',
    );
  };

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">Control de pedidos</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">Almacén</h2>
        <p className="mt-2 text-sm text-slate-500">Consulta los pedidos y registra su llegada, derivación y recepción.</p>
      </header>

      {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {message && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}

      {canCreate && (
        <form onSubmit={submitCreate} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-950">Crear pedido</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Número de pedido
              <input className={`${inputClass} cursor-not-allowed text-slate-500`} value={form.numero_pedido} readOnly disabled required />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Cantidad
              <input className={inputClass} type="number" min="1" step="1" value={form.cantidad} onChange={(event) => setForm({ ...form, cantidad: event.target.value })} required />
            </label>
            <label className="text-sm font-medium text-slate-700 md:col-span-3">
              Descripción
              <textarea className={inputClass} value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} required rows={2} />
            </label>
          </div>
          <button type="submit" disabled={saving} className="mt-4 rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Guardando…' : 'Registrar pedido'}
          </button>
        </form>
      )}

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-950">Lista de pedidos</h3>
            <p className="mt-1 text-sm text-slate-500">Busca por número y filtra por estado.</p>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); }} className="flex flex-col gap-3 sm:flex-row">
            <input className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-300" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="N.º de pedido" aria-label="Buscar por número de pedido" />
            <select className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrar por estado">
              <option value="">Todos los estados</option>
              {Object.entries(stateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700">Buscar</button>
          </form>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-3 py-3">Pedido</th><th className="px-3 py-3">Descripción</th><th className="px-3 py-3">Cantidad</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3">Llegada</th><th className="px-3 py-3">Acciones</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...pedidos].sort(comparePedidoNumbers).map((pedido) => (
                <tr key={pedido.id} className="text-slate-700">
                  <td className="px-3 py-4 font-semibold text-slate-950">{pedido.numero_pedido}</td>
                  <td className="max-w-sm px-3 py-4">{pedido.descripcion}</td>
                  <td className="px-3 py-4">{pedido.cantidad}</td>
                  <td className="px-3 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${stateClasses[pedido.estado] || 'bg-slate-100 text-slate-700'}`}>{stateLabels[pedido.estado] || pedido.estado}</span></td>
                  <td className="px-3 py-4">{formatDate(pedido.fecha_llegada)}</td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => openPedido(pedido.id)} className="font-semibold text-blue-700 hover:text-blue-900">Ver detalle</button>
                      {canCreate && pedido.estado === 'solicitado' && (
                        <button
                          type="button"
                          onClick={() => setPedidoToCancel(pedido)}
                          disabled={saving}
                          className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                          title={`Cancelar pedido ${pedido.numero_pedido}`}
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && pedidos.length === 0 && <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={6}>No se encontraron pedidos.</td></tr>}
              {loading && <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={6}>Cargando pedidos…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {selectedPedido && (
        createPortal(
          <div
            className="fixed inset-0 z-50 flex h-[100dvh] items-center justify-center overflow-hidden bg-slate-950/60 p-4 backdrop-blur-sm"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelectedPedido(null);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="pedido-detail-title"
              className="max-h-[calc(100dvh-2rem)] w-full max-w-5xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl"
            >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">Detalle del pedido</p>
              <h3 id="pedido-detail-title" className="mt-2 text-xl font-semibold text-slate-950">{selectedPedido.numero_pedido}</h3>
            </div>
            <button type="button" onClick={() => setSelectedPedido(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Cerrar detalle</button>
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="text-xs uppercase text-slate-500">Estado</dt><dd className="mt-1 font-medium text-slate-900">{stateLabels[selectedPedido.estado] || selectedPedido.estado}</dd></div>
            <div><dt className="text-xs uppercase text-slate-500">Cantidad</dt><dd className="mt-1 font-medium text-slate-900">{selectedPedido.cantidad}</dd></div>
            <div><dt className="text-xs uppercase text-slate-500">Creado</dt><dd className="mt-1 font-medium text-slate-900">{formatDate(selectedPedido.created_at)}</dd></div>
            <div className="sm:col-span-2 lg:col-span-3"><dt className="text-xs uppercase text-slate-500">Descripción</dt><dd className="mt-1 text-slate-900">{selectedPedido.descripcion}</dd></div>
            <div><dt className="text-xs uppercase text-slate-500">Llegada</dt><dd className="mt-1 text-slate-900">{formatDate(selectedPedido.fecha_llegada)}</dd></div>
            <div><dt className="text-xs uppercase text-slate-500">Registrado por almacén</dt><dd className="mt-1 text-slate-900">{selectedPedido.registrado_por_almacen_nombre || '—'}</dd></div>
            <div><dt className="text-xs uppercase text-slate-500">Observaciones de almacén</dt><dd className="mt-1 text-slate-900">{selectedPedido.observaciones_almacen || '—'}</dd></div>
            <div><dt className="text-xs uppercase text-slate-500">Derivado a</dt><dd className="mt-1 text-slate-900">{selectedPedido.derivado_a_usuario_nombre || '—'}</dd></div>
            <div><dt className="text-xs uppercase text-slate-500">Derivado por</dt><dd className="mt-1 text-slate-900">{selectedPedido.derivado_por_nombre || '—'}</dd></div>
            <div><dt className="text-xs uppercase text-slate-500">Fecha de derivación</dt><dd className="mt-1 text-slate-900">{formatDate(selectedPedido.fecha_derivacion)}</dd></div>
            <div><dt className="text-xs uppercase text-slate-500">Observaciones de derivación</dt><dd className="mt-1 text-slate-900">{selectedPedido.observaciones_derivacion || '—'}</dd></div>
            <div><dt className="text-xs uppercase text-slate-500">Recepcionado por</dt><dd className="mt-1 text-slate-900">{selectedPedido.recepcionado_por_nombre || '—'}</dd></div>
            <div><dt className="text-xs uppercase text-slate-500">Fecha de recepción</dt><dd className="mt-1 text-slate-900">{formatDate(selectedPedido.fecha_recepcion)}</dd></div>
            <div><dt className="text-xs uppercase text-slate-500">Conformidad</dt><dd className="mt-1 text-slate-900">{selectedPedido.conformidad || '—'}</dd></div>
            <div className="sm:col-span-2 lg:col-span-3"><dt className="text-xs uppercase text-slate-500">Observaciones de recepción</dt><dd className="mt-1 text-slate-900">{selectedPedido.observaciones_recepcion || '—'}</dd></div>
          </dl>

          {canArrive && selectedPedido.estado === 'solicitado' && (
            <form onSubmit={submitArrival} className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
              <h4 className="font-semibold text-slate-950">Registrar llegada a almacén</h4>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">Fecha y hora de llegada
                  <input className={inputClass} type="datetime-local" value={arrivalForm.fecha_llegada} onChange={(event) => setArrivalForm({ ...arrivalForm, fecha_llegada: event.target.value })} required />
                </label>
                <label className="text-sm font-medium text-slate-700">Observaciones
                  <textarea className={inputClass} value={arrivalForm.observaciones_almacen} onChange={(event) => setArrivalForm({ ...arrivalForm, observaciones_almacen: event.target.value })} rows={2} />
                </label>
              </div>
              <button disabled={saving} className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Guardando…' : 'Confirmar llegada'}</button>
            </form>
          )}

          {currentUser?.rol === 'jefatura' && canDerive && selectedPedido.estado === 'en_almacen'
            && !selectedPedido.derivado_a_usuario_id && !selectedPedido.fecha_derivacion && (
            <form onSubmit={submitDerivation} className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
              <h4 className="font-semibold text-slate-950">Derivar recepción a TI</h4>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">Usuario responsable
                  <select className={inputClass} value={deriveForm.derivado_a_usuario_id} onChange={(event) => setDeriveForm({ ...deriveForm, derivado_a_usuario_id: event.target.value })} required>
                    <option value="">Selecciona un usuario activo</option>
                    {activeTechnicians.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.nombre} (Técnico / {user.departamento || 'Tecnología de la Información'})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">Observaciones
                  <textarea className={inputClass} value={deriveForm.observaciones_derivacion} onChange={(event) => setDeriveForm({ ...deriveForm, observaciones_derivacion: event.target.value })} rows={2} />
                </label>
              </div>
              <button disabled={saving || activeTechnicians.length === 0} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{saving ? 'Guardando…' : 'Derivar pedido'}</button>
            </form>
          )}

          {currentUser?.rol === 'tecnico' && canReceive && selectedPedido.estado === 'en_almacen' && (
            <form onSubmit={submitReception} className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
              <h4 className="font-semibold text-slate-950">Registrar recepción técnica</h4>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">Conformidad
                  <select className={inputClass} value={receiveForm.conformidad} onChange={(event) => setReceiveForm({ ...receiveForm, conformidad: event.target.value })}>
                    <option value="conforme">Conforme</option>
                    <option value="observado">Observado</option>
                    <option value="no_conforme">No conforme</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">Observaciones
                  <textarea className={inputClass} value={receiveForm.observaciones_recepcion} onChange={(event) => setReceiveForm({ ...receiveForm, observaciones_recepcion: event.target.value })} rows={2} />
                </label>
              </div>
              <button disabled={saving} className="mt-4 rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{saving ? 'Guardando…' : 'Confirmar recepción'}</button>
            </form>
          )}
            </section>
          </div>,
          document.body,
        )
      )}

      {pedidoToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4" role="presentation">
          <div role="alertdialog" aria-modal="true" aria-labelledby="cancel-pedido-title" className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-600">Confirmar cancelación</p>
            <h3 id="cancel-pedido-title" className="mt-2 text-xl font-semibold text-slate-950">
              ¿Estás seguro de cancelar el pedido {pedidoToCancel.numero_pedido}?
            </h3>
            <p className="mt-3 text-sm text-slate-600">Esta acción eliminará el pedido de la lista. No podrás deshacerla.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPedidoToCancel(null)}
                disabled={saving}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                No, mantener
              </button>
              <button
                type="button"
                onClick={confirmCancelPedido}
                disabled={saving}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {saving ? 'Cancelando…' : 'Sí, cancelar pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
