import Select from './Select';
import { cloneElement, useId, useRef, useState } from 'react';
import * as api from '../services/api';
import { TIPOS, getTipo, GUIA_ESCANER, sugerirClasificacionEscaner } from '../utils/camposPorTipo';
import { calcularGarantia } from '../utils/garantia';
import './InventarioList.css';

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
  const generatedId = useId();
  const id = `register-${generatedId.replaceAll(':', '')}`;
  const group = children.type === 'div';
  const Label = group ? 'span' : 'label';
  return (
    <div className={ancho}>
      <Label id={`${id}-label`} htmlFor={group ? undefined : id} className="inventory-register-label">
        {label}{obligatorio && ' *'}
      </Label>
      {cloneElement(children, {
        id,
        role: group ? 'group' : children.props.role,
        tabIndex: group ? -1 : children.props.tabIndex,
        required: !group && obligatorio ? true : undefined,
        'aria-invalid': Boolean(error),
        'aria-describedby': error ? `${id}-error` : undefined,
        'aria-labelledby': group ? `${id}-label` : undefined,
      })}
      {error && <p id={`${id}-error`} role="alert" className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
}

function RegisterIcon({ name }) {
  const paths = {
    box: 'm12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9',
    save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2ZM7 3v6h10V3M7 21v-8h10v8',
    loader: 'M12 3a9 9 0 1 1-9 9',
    close: 'm6 6 12 12M6 18 18 6',
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.box} /></svg>;
}

export default function RegistrarBien({ onSaved, onCancel }) {
  const formRef = useRef(null);
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
    if (loading) return;
    setMensaje(null);

    const erroresLocales = validar(formData);
    setErrores(erroresLocales);
    if (Object.keys(erroresLocales).length > 0) {
      setMensaje({ tipo: 'error', texto: 'Complete correctamente los campos marcados en rojo' });
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
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
    <div className="inventory-editor-inline inventory-register">
    <section className="inventory-editor" aria-labelledby="register-asset-title">
      <header className="inventory-editor-header">
        <span className="inventory-editor-emblem"><RegisterIcon name="box" /></span>
        <div className="inventory-editor-title">
          <span className="inventory-editor-eyebrow">INVENTARIO / NUEVO BIEN</span>
          <h3 id="register-asset-title">Registrar bien informático</h3>
          <p>Completa los datos del equipo para incorporarlo al inventario.</p>
        </div>
        <button type="button" className="inventory-editor-close" onClick={onCancel} disabled={loading} aria-label="Cerrar registro"><RegisterIcon name="close" /></button>
      </header>

      <form ref={formRef} onSubmit={handleSubmit} className="inventory-editor-form" noValidate aria-busy={loading}>
        <div className="inventory-editor-body">

      {mensaje && (
        <div
          role={mensaje.tipo === 'exito' ? 'status' : 'alert'}
          className={`mb-4 rounded-lg border px-4 py-3 text-sm font-medium ${
            mensaje.tipo === 'exito'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {mensaje.tipo === 'exito' ? '✓ ' : '✕ '}{mensaje.texto}
        </div>
      )}

        <fieldset className="inventory-editor-fields" disabled={loading}>
          <legend className="sr-only">Datos del nuevo bien informático</legend>
        <section className="inventory-editor-section" aria-labelledby="register-identification-title">
          <div className="inventory-editor-section-heading">
            <span>01</span>
            <div><h4 id="register-identification-title">Identificación del equipo</h4><p>Código, serie y características generales del bien.</p></div>
          </div>

        <div className="inventory-editor-grid inventory-editor-grid--three">
          <Campo label="Código patrimonial" obligatorio error={errores.codigoPatrimonial}>
            <input type="text" placeholder="PAT-2026-00123" {...campoProps('codigoPatrimonial')} />
          </Campo>
          <Campo label="Número de serie" obligatorio error={errores.numeroSerie}>
            <input type="text" placeholder="SN-987654321-TC" {...campoProps('numeroSerie')} />
          </Campo>
          <Campo label="Tipo de bien" obligatorio error={errores.tipo}>
            <Select {...campoProps('tipo')}>
              <option value="">Selecciona tipo</option>
              {TIPOS.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
              ))}
            </Select>
          </Campo>
        </div>

        <div className="inventory-editor-grid inventory-editor-grid--three">
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

        </section>

        <section className="inventory-editor-section" aria-labelledby="register-purchase-title">
          <div className="inventory-editor-section-heading">
            <span>02</span>
            <div><h4 id="register-purchase-title">Ubicación y compra</h4><p>El bien se registrará disponible en almacén, sin asignación.</p></div>
          </div>
        <div className="inventory-editor-grid inventory-editor-grid--three">
          <Campo label="Estado inicial">
            <input
              type="text"
              value="Disponible / En Almacén"
              readOnly
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-100 text-slate-600"
            />
          </Campo>
          <Campo label="Ubicación / sede inicial" obligatorio error={errores.ubicacion}>
            <input type="text" placeholder="Sede Principal - Almacén TI" {...campoProps('ubicacion')} />
          </Campo>
          <Campo label="Orden de compra" error={errores.ordenCompra}>
            <input type="text" placeholder="OC-2026-089" {...campoProps('ordenCompra')} />
          </Campo>
        </div>

        <div className="inventory-editor-grid inventory-editor-grid--three">
          <Campo label="Valor (S/)" error={errores.valor}>
            <input type="number" placeholder="0.00" step="0.01" min="0" {...campoProps('valor')} />
          </Campo>
          <Campo label="Fecha de compra" obligatorio error={errores.fechaCompra}>
            <input type="date" max={fechaLocalISO()} {...campoProps('fechaCompra')} />
          </Campo>
          <Campo label="Años de garantía" obligatorio error={errores.garantiaAnios}>
            <input type="number" placeholder="0 si no tiene" min="0" max="10" step="1" {...campoProps('garantiaAnios')} />
          </Campo>
        </div>

        {garantia && (
          <div className={`rounded-lg border px-4 py-3 text-sm ${ESTILO_GARANTIA[garantia.estado]}`}>
            <span className="font-semibold">Garantía: {garantia.etiqueta}</span>
            {garantia.detalle && <span> · {garantia.detalle}</span>}
          </div>
        )}

        </section>

        <section className="inventory-editor-section" aria-labelledby="register-specifications-title">
          <div className="inventory-editor-section-heading">
            <span>03</span>
            <div><h4 id="register-specifications-title">Especificaciones técnicas {tipoActual && <small>{tipoActual.label}</small>}</h4><p>Características y observaciones del equipo.</p></div>
          </div>

        {!tipoActual && (
          <div className="inventory-register-placeholder">
            <RegisterIcon name="box" />
            <div><strong>Selecciona el tipo de bien</strong><p>Los campos técnicos aparecerán según el equipo que elijas.</p></div>
          </div>
        )}

        {tipoActual && tipoActual.campos.length === 0 && (
          <p className="text-sm text-slate-500">
            Este tipo no tiene especificaciones propias. Usa las observaciones para detallar el equipo.
          </p>
        )}

        {tipoActual && tipoActual.campos.length > 0 && (
          <div className="inventory-editor-grid inventory-editor-grid--three">
            {tipoActual.campos.map((campo) => (
              <Campo
                key={campo.name}
                ancho={campo.completo ? 'inventory-register-wide' : undefined}
                label={campo.label}
                obligatorio={campo.required}
                error={errores[`detalles.${campo.name}`]}
              >
                {campo.botones ? (
                  <div className="inventory-register-options">
                    {campo.options.map((opcion) => (
                      <button
                        type="button"
                        key={opcion}
                        aria-pressed={formData.detalles[campo.name] === opcion}
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
                  <Select {...detalleProps(campo)}>
                    <option value="">Selecciona</option>
                    {campo.options.map((opcion) => (
                      <option key={opcion} value={opcion}>{opcion}</option>
                    ))}
                  </Select>
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
          <details className="inventory-register-guide">
            <summary>Guía para clasificar el escáner</summary>
          <div className="overflow-x-auto">
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
          </details>
        )}

        <Campo label="Observaciones" error={errores.especificaciones}>
          <textarea
            placeholder="Detalles adicionales del equipo..."
            rows="2"
            {...campoProps('especificaciones')}
          />
        </Campo>

        </section>
        </fieldset>
        </div>

        <footer className="inventory-editor-footer">
          <p><span>*</span> Campos obligatorios</p>
          <div className="inventory-editor-buttons">
          <button type="button" onClick={onCancel} className="inventory-editor-cancel" disabled={loading}>Cancelar</button>
          <button
            type="submit"
            className="inventory-editor-save"
            disabled={loading}
          >
            <RegisterIcon name={loading ? 'loader' : 'save'} />
            {loading ? 'Guardando...' : 'Registrar bien'}
          </button>
          </div>
        </footer>
      </form>
    </section>
    </div>
  );
}
