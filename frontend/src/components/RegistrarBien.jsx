import { useState } from 'react';
import * as api from '../services/api';
import { TIPOS, getTipo, GUIA_ESCANER, sugerirClasificacionEscaner } from '../utils/camposPorTipo';
import { calcularGarantia } from '../utils/garantia';

const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;

const fechaLocalISO = () => {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
};

const FORM_VACIO = {
  codigoPatrimonial: '',
  numeroSerie: '',
  tipo: '',
  marca: '',
  modelo: '',
  direccionMac: '',
  ubicacion: '',
  ordenCompra: '',
  valor: '',
  fechaCompra: '',
  garantiaAnios: '',
  especificaciones: '',
  detalles: {},
};

const OBLIGATORIOS = {
  codigoPatrimonial: 'El código patrimonial es obligatorio',
  numeroSerie: 'El número de serie es obligatorio',
  tipo: 'El tipo de bien es obligatorio',
  marca: 'La marca es obligatoria',
  modelo: 'El modelo es obligatorio',
  ubicacion: 'La ubicación / sede inicial es obligatoria',
  fechaCompra: 'La fecha de compra es obligatoria',
  garantiaAnios: 'Los años de garantía son obligatorios (0 si no tiene)',
};

const ESTILO_GARANTIA = {
  vigente: 'border-green-200 bg-green-50 text-green-700',
  vencida: 'border-red-200 bg-red-50 text-red-700',
  sin_garantia: 'border-slate-200 bg-slate-50 text-slate-600',
};

const validar = (datos) => {
  const errores = {};
  Object.entries(OBLIGATORIOS).forEach(([campo, mensaje]) => {
    if (!String(datos[campo]).trim()) errores[campo] = mensaje;
  });

  const tipo = getTipo(datos.tipo);
  tipo?.campos.forEach((campo) => {
    const valor = String(datos.detalles[campo.name] || '').trim();
    if (campo.required && !valor) {
      errores[`detalles.${campo.name}`] = 'Este campo es obligatorio';
    } else if (campo.type === 'number' && valor && Number(valor) < 0) {
      errores[`detalles.${campo.name}`] = 'Debe ser un número mayor o igual a 0';
    }
  });

  const mac = datos.direccionMac.trim();
  if (tipo?.usaMac && mac && !MAC_REGEX.test(mac)) {
    errores.direccionMac = 'Formato de MAC inválido (ej. A1:B2:C3:D4:E5:F6)';
  }
  if (datos.valor !== '' && Number(datos.valor) < 0) {
    errores.valor = 'El valor debe ser mayor o igual a 0';
  }
  if (datos.fechaCompra && datos.fechaCompra > fechaLocalISO()) {
    errores.fechaCompra = 'La fecha de compra no puede ser futura';
  }

  const anios = String(datos.garantiaAnios).trim();
  if (anios !== '' && (!Number.isInteger(Number(anios)) || Number(anios) < 0 || Number(anios) > 10)) {
    errores.garantiaAnios = 'Debe ser un número entero entre 0 y 10';
  }
  return errores;
};

function Campo({ label, obligatorio, error, ancho, children }) {
  return (
    <div className={ancho}>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}{obligatorio && ' *'}
      </label>
      {children}
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
}

export default function RegistrarBien({ onSaved, onCancel }) {
  const [formData, setFormData] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState(null);
  const [loading, setLoading] = useState(false);

  const tipoActual = getTipo(formData.tipo);
  const garantia = calcularGarantia(formData.fechaCompra, formData.garantiaAnios);
  const esEscaner = formData.tipo === 'escaner';
  const clasificacion = formData.detalles.clasificacion;
  const sugerencia = esEscaner ? sugerirClasificacionEscaner(formData.detalles) : null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    const cambioTipo = name === 'tipo';
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(cambioTipo ? { detalles: {}, direccionMac: '' } : {}),
    }));
    setErrores((prev) => {
      const siguiente = { ...prev, [name]: undefined };
      if (cambioTipo) {
        Object.keys(siguiente).forEach((clave) => {
          if (clave.startsWith('detalles.') || clave === 'direccionMac') delete siguiente[clave];
        });
      }
      return siguiente;
    });
  };

  const handleDetalle = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, detalles: { ...prev.detalles, [name]: value } }));
    setErrores((prev) => ({ ...prev, [`detalles.${name}`]: undefined }));
  };

  const seleccionarDetalle = (name, value) => handleDetalle({ target: { name, value } });

  const handleBlur = (e) => {
    const { name, dataset } = e.target;
    const clave = dataset.detalle ? `detalles.${name}` : name;
    setErrores((prev) => ({ ...prev, [clave]: validar(formData)[clave] }));
  };

  const clase = (clave) =>
    `w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition ${
      errores[clave]
        ? 'border-red-500 bg-red-50 focus:ring-red-400'
        : 'border-slate-300 focus:ring-blue-500'
    }`;

  const campoProps = (name) => ({
    name,
    value: formData[name],
    onChange: handleChange,
    onBlur: handleBlur,
    className: clase(name),
  });

  const detalleProps = (campo) => ({
    name: campo.name,
    value: formData.detalles[campo.name] || '',
    onChange: handleDetalle,
    onBlur: handleBlur,
    className: clase(`detalles.${campo.name}`),
    'data-detalle': '1',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje(null);

    const erroresLocales = validar(formData);
    setErrores(erroresLocales);
    if (Object.keys(erroresLocales).length > 0) {
      setMensaje({ tipo: 'error', texto: 'Complete correctamente los campos marcados en rojo' });
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.createBien({
        ...formData,
        direccionMac: tipoActual?.usaMac ? formData.direccionMac : '',
        valor: formData.valor === '' ? null : Number(formData.valor),
        garantiaAnios: Number(formData.garantiaAnios),
      });
      setFormData(FORM_VACIO);
      setErrores({});
      setMensaje({
        tipo: 'exito',
        texto: `Bien registrado correctamente (${data.codigo_patrimonial})`,
      });
      onSaved();
    } catch (error) {
      const respuesta = error.response?.data;
      if (respuesta?.campos) setErrores(respuesta.campos);
      else if (respuesta?.campo) setErrores({ [respuesta.campo]: respuesta.error });
      setMensaje({
        tipo: 'error',
        texto: respuesta?.error || 'No se pudo registrar el bien. Intente nuevamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 overflow-hidden">
      <h3 className="text-xl font-bold text-slate-900 mb-6">Registrar Bien Informático</h3>

      {mensaje && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm font-medium ${
            mensaje.tipo === 'exito'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {mensaje.tipo === 'exito' ? '✓ ' : '✕ '}{mensaje.texto}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
          1. Información principal del bien informático
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Campo label="Código Patrimonial" obligatorio error={errores.codigoPatrimonial}>
            <input type="text" placeholder="PAT-2026-00123" {...campoProps('codigoPatrimonial')} />
          </Campo>
          <Campo label="Número de Serie" obligatorio error={errores.numeroSerie}>
            <input type="text" placeholder="SN-987654321-TC" {...campoProps('numeroSerie')} />
          </Campo>
          <Campo label="Tipo de Bien" obligatorio error={errores.tipo}>
            <select {...campoProps('tipo')}>
              <option value="">Selecciona tipo</option>
              {TIPOS.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
              ))}
            </select>
          </Campo>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Campo label="Marca" obligatorio error={errores.marca}>
            <input type="text" placeholder="Dell" {...campoProps('marca')} />
          </Campo>
          <Campo label="Modelo" obligatorio error={errores.modelo}>
            <input type="text" placeholder="Latitude 5540" {...campoProps('modelo')} />
          </Campo>
          {tipoActual?.usaMac && (
            <Campo label="Dirección MAC" error={errores.direccionMac}>
              <input type="text" placeholder="A1:B2:C3:D4:E5:F6" {...campoProps('direccionMac')} />
            </Campo>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Campo label="Estado Inicial">
            <input
              type="text"
              value="Disponible / En Almacén"
              readOnly
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-100 text-slate-600"
            />
          </Campo>
          <Campo label="Ubicación / Sede Inicial" obligatorio error={errores.ubicacion}>
            <input type="text" placeholder="Sede Principal - Almacén TI" {...campoProps('ubicacion')} />
          </Campo>
          <Campo label="Orden de Compra" error={errores.ordenCompra}>
            <input type="text" placeholder="OC-2026-089" {...campoProps('ordenCompra')} />
          </Campo>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Campo label="Valor (S/)" error={errores.valor}>
            <input type="number" placeholder="0.00" step="0.01" min="0" {...campoProps('valor')} />
          </Campo>
          <Campo label="Fecha de Compra" obligatorio error={errores.fechaCompra}>
            <input type="date" max={fechaLocalISO()} {...campoProps('fechaCompra')} />
          </Campo>
          <Campo label="Años de Garantía" obligatorio error={errores.garantiaAnios}>
            <input type="number" placeholder="0 si no tiene" min="0" max="10" step="1" {...campoProps('garantiaAnios')} />
          </Campo>
        </div>

        {garantia && (
          <div className={`rounded-lg border px-4 py-3 text-sm ${ESTILO_GARANTIA[garantia.estado]}`}>
            <span className="font-semibold">Garantía: {garantia.etiqueta}</span>
            {garantia.detalle && <span> · {garantia.detalle}</span>}
          </div>
        )}

        <p className="text-xs font-bold uppercase tracking-wide text-blue-700 pt-2">
          2. Especificaciones técnicas y detalles del equipo
        </p>

        {!tipoActual && (
          <p className="text-sm text-slate-500">
            Selecciona un tipo de bien para ver sus especificaciones.
          </p>
        )}

        {tipoActual && tipoActual.campos.length === 0 && (
          <p className="text-sm text-slate-500">
            Este tipo no tiene especificaciones propias. Usa las observaciones para detallar el equipo.
          </p>
        )}

        {tipoActual && tipoActual.campos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tipoActual.campos.map((campo) => (
              <Campo
                key={campo.name}
                ancho={campo.completo ? 'md:col-span-3' : undefined}
                label={campo.label}
                obligatorio={campo.required}
                error={errores[`detalles.${campo.name}`]}
              >
                {campo.botones ? (
                  <div className="flex gap-3">
                    {campo.options.map((opcion) => (
                      <button
                        type="button"
                        key={opcion}
                        onClick={() => seleccionarDetalle(campo.name, opcion)}
                        className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-semibold transition ${
                          formData.detalles[campo.name] === opcion
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : errores[`detalles.${campo.name}`]
                              ? 'border-red-500 bg-red-50 text-slate-700'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {opcion}
                      </button>
                    ))}
                  </div>
                ) : campo.options ? (
                  <select {...detalleProps(campo)}>
                    <option value="">Selecciona</option>
                    {campo.options.map((opcion) => (
                      <option key={opcion} value={opcion}>{opcion}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={campo.type || 'text'}
                    min={campo.type === 'number' ? '0' : undefined}
                    placeholder={campo.placeholder}
                    {...detalleProps(campo)}
                  />
                )}
              </Campo>
            ))}
          </div>
        )}

        {esEscaner && sugerencia && !clasificacion && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            <span>Según los datos ingresados, parece un escáner de <strong>{sugerencia}</strong>.</span>
            <button
              type="button"
              onClick={() => seleccionarDetalle('clasificacion', sugerencia)}
              className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Usar {sugerencia}
            </button>
          </div>
        )}

        {esEscaner && sugerencia && clasificacion && sugerencia !== clasificacion && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Los datos ingresados corresponden a un escáner de <strong>{sugerencia}</strong>, pero elegiste{' '}
            <strong>{clasificacion}</strong>. Revisa si es correcto.
          </div>
        )}

        {esEscaner && (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Guía para clasificar</th>
                  <th className="px-3 py-2 text-left font-semibold">Regular (plano / ADF básico)</th>
                  <th className="px-3 py-2 text-left font-semibold">Alto consumo (producción)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-600">
                {GUIA_ESCANER.map(([caracteristica, regular, alto]) => (
                  <tr key={caracteristica}>
                    <td className="px-3 py-2 font-medium text-slate-800">{caracteristica}</td>
                    <td className="px-3 py-2">{regular}</td>
                    <td className="px-3 py-2">{alto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Campo label="Observaciones" error={errores.especificaciones}>
          <textarea
            placeholder="Detalles adicionales del equipo..."
            rows="3"
            {...campoProps('especificaciones')}
          />
        </Campo>

        <div className="flex gap-3 pt-4 border-t border-slate-200">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? '⏳ Guardando...' : '💾 Guardar Bien Informático'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="bg-slate-300 hover:bg-slate-400 text-slate-800 px-6 py-2.5 rounded-lg font-semibold transition-all duration-200"
            disabled={loading}
          >
            ✕ Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
