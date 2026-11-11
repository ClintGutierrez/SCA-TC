import { memo, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MONEY = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 });
const TYPES = { laptop: 'Laptop', computadora: 'Computadora', all_in_one: 'All in One', servidor: 'Servidor', monitor: 'Monitor', impresora: 'Impresora', escaner: 'Escáner', teclado: 'Teclado', mouse: 'Mouse', router: 'Router', switch: 'Switch', switch_: 'Switch', nas: 'NAS', camara: 'Cámara', otro: 'Otro' };
const STATES = {
  activo: ['Activo', 'is-active'], asignado: ['Asignado', 'is-assigned'], mantenimiento: ['Mantenimiento', 'is-maintenance'],
  baja: ['Baja', ''], dado_de_baja: ['Baja', ''], inactivo: ['Inactivo', ''],
};
const PATHS = {
  box: 'm12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  edit: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2',
  trash: 'M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
};
function Icon({ name, size = 16 }) {
  return <svg width={size} height={size} style={{ width: size, height: size, flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'more' ? <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></> : <path d={PATHS[name] || PATHS.box} />}
  </svg>;
}

function AssetActions({ bien, canEdit, canDelete, loading, historyLoading, onEdit, onHistory, onDelete }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const id = useId();
  const retired = ['baja', 'dado_de_baja'].includes(String(bien.estado).toLowerCase());
  const close = (restoreFocus = false) => { setOpen(false); setPosition(null); if (restoreFocus) trigger.current?.focus({ preventScroll: true }); };

  useEffect(() => {
    if (!open) return;
    const rect = trigger.current.getBoundingClientRect();
    const width = Math.min(224, window.innerWidth - 24);
    const height = menu.current.getBoundingClientRect().height;
    const above = window.innerHeight - rect.bottom < height + 12 && rect.top > height + 12;
    setPosition({ width, left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
      top: Math.max(12, Math.min(above ? rect.top - height - 6 : rect.bottom + 6, window.innerHeight - height - 12)) });
    const frame = requestAnimationFrame(() => menu.current?.querySelector('button:not(:disabled)')?.focus());
    const outside = (event) => { if (!trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) close(); };
    const moved = (event) => { if (!menu.current?.contains(event.target)) close(); };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('scroll', moved, true);
    window.addEventListener('resize', moved);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('pointerdown', outside); window.removeEventListener('scroll', moved, true); window.removeEventListener('resize', moved); };
  }, [open]);

  const keydown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (event.key === 'Tab') { close(true); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...menu.current.querySelectorAll('button:not(:disabled)')];
    const current = buttons.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };
  const run = (callback) => { close(true); callback(); };

  return <>
    <button ref={trigger} type="button" className="inventory-menu-trigger" aria-label={'Más acciones para ' + bien.nombre} title="Más acciones" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => open ? close() : setOpen(true)} onKeyDown={(event) => {
        if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); }
        if (event.key === 'Escape' && open) { event.preventDefault(); close(true); }
      }}><Icon name="more" /></button>
    {open && createPortal(<div ref={menu} id={id} role="menu" aria-label={'Acciones de ' + bien.nombre} onKeyDown={keydown} className="inventory-row-menu" style={position || { width: 224, top: 0, left: 0, visibility: 'hidden' }}>
      {canEdit && <button type="button" role="menuitem" disabled={loading || retired} onClick={() => run(() => onEdit(bien))} title={retired ? 'La ficha de un bien dado de baja está bloqueada' : undefined}><Icon name="edit" />{retired ? 'Ficha bloqueada por baja' : 'Editar ficha técnica'}</button>}
      <button type="button" role="menuitem" disabled={historyLoading} onClick={() => run(() => onHistory(bien))}><Icon name="clock" />Ver historial</button>
      {canDelete && <button type="button" role="menuitem" className="is-danger" disabled={loading} onClick={() => run(() => onDelete(bien.id))}><Icon name="trash" />Eliminar bien</button>}
    </div>, document.body)}
  </>;
}

const InventarioTabla = memo(function InventarioTabla({ bienes, canEdit, canDelete, loading, historyLoading, hasFilters, onSpecs, onEdit, onHistory, onDelete }) {
  return <section className="inventory-table-panel" aria-label="Listado de bienes informáticos"><div className="inventory-table-scroll"><table className="inventory-table">
    <colgroup><col className="inventory-col-code" /><col className="inventory-col-device" /><col className="inventory-col-cost" /><col className="inventory-col-owner" /><col className="inventory-col-status" /><col className="inventory-col-actions" /></colgroup>
    <thead><tr><th scope="col">Código patrimonial</th><th scope="col">Equipo</th><th scope="col" className="inventory-align-right">Costo</th><th scope="col">Responsable</th><th scope="col">Estado</th><th scope="col" className="inventory-align-right">Acciones</th></tr></thead>
    <tbody>{bienes.length ? bienes.map((bien) => {
      const state = STATES[bien.estado] || [String(bien.estado || 'Sin estado').replaceAll('_', ' '), ''];
      const brand = [bien.marca, bien.modelo].filter(Boolean).join(' · ');
      const hasCost = bien.costo !== null && bien.costo !== undefined && bien.costo !== '' && Number.isFinite(Number(bien.costo));
      return <tr key={bien.id}>
        <td><span className={bien.codigo_patrimonial ? 'inventory-code' : 'inventory-missing'} title={bien.codigo_patrimonial || undefined}>{bien.codigo_patrimonial || 'Sin código'}</span>{bien.numero_serie && <span className="inventory-secondary" title={'Serie: ' + bien.numero_serie}>Serie: {bien.numero_serie}</span>}</td>
        <td><div className="inventory-device"><span className="inventory-device-icon"><Icon name="box" size={18} /></span><div className="inventory-device-copy"><button type="button" className="inventory-device-name" onClick={() => onSpecs(bien)} title={bien.nombre}>{bien.nombre}</button><div className="inventory-device-meta"><span className="inventory-type">{TYPES[bien.tipo] || bien.tipo || 'Sin tipo'}</span>{brand && <span title={brand}>{brand}</span>}</div></div></div></td>
        <td className="inventory-align-right">{hasCost ? <span className="inventory-money">{MONEY.format(Number(bien.costo))}</span> : <span className="inventory-missing">Sin valor</span>}</td>
        <td>{bien.usuario_asignado ? <div className="inventory-owner"><Icon name="user" size={14} /><span title={bien.usuario_asignado}>{bien.usuario_asignado}</span></div> : <span className="inventory-missing">No registrado</span>}</td>
        <td><span className={'inventory-status ' + state[1]}>{state[0]}</span></td>
        <td><div className="inventory-row-actions"><button type="button" onClick={() => onSpecs(bien)} className="inventory-view-button" aria-label={'Ver ficha de ' + bien.nombre}><Icon name="eye" size={14} />Ver ficha</button><AssetActions bien={bien} canEdit={canEdit} canDelete={canDelete} loading={loading} historyLoading={historyLoading} onEdit={onEdit} onHistory={onHistory} onDelete={onDelete} /></div></td>
      </tr>;
    }) : <tr><td colSpan="6" className="inventory-empty"><Icon name="box" size={28} /><p>{hasFilters ? 'No hay bienes que coincidan con los filtros' : 'No hay bienes registrados'}</p></td></tr>}</tbody>
  </table></div></section>;
});

export default InventarioTabla;
