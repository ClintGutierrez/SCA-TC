import { useEffect, useRef, useState } from 'react';
import { getSolicitudesTI, getNotificacionesTI } from '../services/api';
import './Sidebar.css';

const ALL_ROLES = ['administrador', 'jefatura', 'tecnico', 'auditor', 'almacen'];
const GROUPS = [
  { id: 'inicio', label: 'Inicio', items: [
    { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', roles: ['administrador', 'jefatura', 'tecnico'] },
    { id: 'notificaciones_ti', icon: 'bell', label: 'Notificaciones', roles: ALL_ROLES, counter: 'unread' },
  ] },
  { id: 'operaciones', label: 'Operaciones', items: [
    { id: 'solicitudes_ti', icon: 'file', label: 'Solicitudes TI', roles: ['administrador', 'jefatura', 'tecnico', 'auditor'], counter: 'pending' },
    { id: 'almacen_ti', icon: 'box', label: 'Pedidos y Almacén', roles: ALL_ROLES },
    { id: 'movimientos', icon: 'arrows', label: 'Movimientos', roles: ['administrador', 'jefatura', 'tecnico', 'auditor'] },
  ] },
  { id: 'patrimonio', label: 'Patrimonio', items: [
    { id: 'inventario', icon: 'computer', label: 'Inventario', roles: ['administrador', 'jefatura', 'tecnico'] },
    { id: 'mantenimiento', icon: 'tool', label: 'Mantenimiento', roles: ['administrador', 'jefatura', 'tecnico'] },
    { id: 'bajas', icon: 'archive', label: 'Bajas', roles: ['administrador', 'jefatura', 'auditor'] },
    { id: 'reportes', icon: 'chart', label: 'Reportes', roles: ['administrador', 'jefatura', 'tecnico', 'auditor'] },
  ] },
  { id: 'administracion', label: 'Administración', items: [
    { id: 'personal', icon: 'person', label: 'Personal', roles: ALL_ROLES },
    { id: 'usuarios', icon: 'users', label: 'Usuarios', roles: ['administrador'] },
    { id: 'auditoria', icon: 'shield', label: 'Auditoría', roles: ['administrador', 'auditor'] },
    { id: 'configuracion', icon: 'settings', label: 'Configuración', roles: ['administrador'] },
  ] },
];
const ROLE_LABELS = { administrador: 'Administrador', jefatura: 'Jefatura', tecnico: 'Técnico', auditor: 'Auditor', almacen: 'Almacén' };

function Icon({ name, size = 20, className = '' }) {
  const paths = {
    dashboard: 'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
    file: 'M14 2H5v20h14V7l-5-5ZM14 2v5h5M8 12h8M8 16h6',
    box: 'm12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5',
    arrows: 'M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4',
    computer: 'M3 3h18v13H3ZM8 21h8M12 16v5',
    tool: 'M14 6a5 5 0 0 0-6 6l-6 6 4 4 6-6a5 5 0 0 0 6-6l-4 4-4-4 4-4Z',
    archive: 'M3 3h18v5H3ZM5 8v13h14V8M10 12h4',
    chart: 'M4 3v18h17M8 16v-4M13 16V8M18 16V5',
    person: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    shield: 'm12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3Zm-4 9 3 3 5-6',
    settings: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    collapse: 'm14 6-6 6 6 6', expand: 'm10 6 6 6-6 6', close: 'm6 6 12 12M6 18 18 6',
  };
  return <svg width={size} height={size} style={{ width: size, height: size, minWidth: size, flexShrink: 0 }} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.dashboard} /></svg>;
}

export default function Sidebar({ isOpen, onViewChange, currentView, onCloseSidebar, currentUser }) {
  const [counts, setCounts] = useState({ unread: 0, pending: 0 });
  const [collapsed, setCollapsed] = useState(() => {
    try { return window.localStorage.getItem('sca-sidebar-collapsed') === 'true'; } catch { return false; }
  });
  const sidebarRef = useRef(null);
  const closeRef = useRef(onCloseSidebar);
  closeRef.current = onCloseSidebar;
  const role = currentUser?.rol || 'tecnico';
  const roleLabel = ROLE_LABELS[role] || role;

  useEffect(() => {
    try { window.localStorage.setItem('sca-sidebar-collapsed', String(collapsed)); } catch { /* La navegación funciona aunque el almacenamiento esté bloqueado. */ }
  }, [collapsed]);

  useEffect(() => {
    let active = true; let syncing = false;
    setCounts({ unread: 0, pending: 0 });
    const syncCount = async () => {
      if (syncing) return;
      syncing = true;
      try {
        const requests = [getNotificacionesTI()];
        if (role !== 'almacen' || currentUser?.es_ti) requests.push(getSolicitudesTI());
        const results = await Promise.allSettled(requests);
        if (!active) return;
        setCounts((previous) => ({
          unread: results[0].status === 'fulfilled' && Array.isArray(results[0].value.data)
            ? results[0].value.data.filter((row) => !row.leida_at).length : previous.unread,
          pending: results[1]?.status === 'fulfilled' && Array.isArray(results[1].value.data)
            ? results[1].value.data.filter((row) => ['recibida', 'asignada', 'en_atencion'].includes(row.estado)).length : previous.pending,
        }));
      } finally { syncing = false; }
    };
    void syncCount();
    const timer = setInterval(syncCount, 30000);
    window.addEventListener('sca-ti-updated', syncCount);
    return () => { active = false; clearInterval(timer); window.removeEventListener('sca-ti-updated', syncCount); };
  }, [currentUser?.id, currentUser?.es_ti, role]);

  useEffect(() => {
    if (!isOpen) return;
    const desktop = window.matchMedia('(min-width: 1024px)');
    const overflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    const update = () => { document.body.style.overflow = desktop.matches ? overflow : 'hidden'; };
    const keydown = (event) => {
      if (desktop.matches || event.defaultPrevented) return;
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current?.(); }
      if (event.key === 'Tab') {
        const buttons = [...sidebarRef.current.querySelectorAll('button')].filter((button) => button.getClientRects().length);
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus(); }
      }
    };
    update();
    if (!desktop.matches) sidebarRef.current?.querySelector('[aria-label="Cerrar menú"]')?.focus();
    desktop.addEventListener('change', update);
    document.addEventListener('keydown', keydown);
    return () => {
      desktop.removeEventListener('change', update); document.removeEventListener('keydown', keydown);
      document.body.style.overflow = overflow;
      if (!desktop.matches && previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen]);

  const groups = GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => item.roles.includes(role)
    || (item.id === 'solicitudes_ti' && currentUser?.es_ti)) })).filter((group) => group.items.length);
  const initials = (currentUser?.nombre || 'Usuario').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('');
  const navigate = (id) => { onViewChange(id); onCloseSidebar?.(); };

  return <>
    {isOpen && <div className="sca-sidebar-backdrop" aria-hidden="true" onClick={onCloseSidebar} />}
    <aside ref={sidebarRef} id="main-sidebar" aria-label="Menú principal" className={`sca-sidebar${collapsed ? ' is-collapsed' : ''}${isOpen ? ' is-open' : ''}`}>
      <header className="sidebar-header">
        <span className="sidebar-brand-icon" title={collapsed ? 'SCA-TC' : undefined}><Icon name="shield" /></span>
        <div className="sidebar-brand-copy"><h2 className="sidebar-brand-name">SCA-TC</h2><p className="sidebar-brand-description">Gestión de inventario</p></div>
        <button type="button" onClick={onCloseSidebar} aria-label="Cerrar menú" className="sidebar-toggle sidebar-close"><Icon name="close" size={18} /></button>
        <button type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'} aria-expanded={!collapsed} aria-controls="sidebar-navigation" title={collapsed ? 'Expandir menú' : 'Contraer menú'} className="sidebar-toggle"><Icon name={collapsed ? 'expand' : 'collapse'} size={16} /></button>
      </header>

      <nav id="sidebar-navigation" aria-label="Módulos del sistema" className="sidebar-nav">
        {groups.map((group) => <section key={group.id} aria-labelledby={'sidebar-group-' + group.id} className="sidebar-group">
          <h3 id={'sidebar-group-' + group.id} className={group.id === 'inicio' ? 'sr-only' : 'sidebar-group-title'}>{group.label}</h3>
          <div className="sidebar-group-items">{group.items.map((item) => {
            const selected = currentView === item.id;
            const count = counts[item.counter] || 0;
            const name = item.label + (count ? `, ${count} ${item.counter === 'unread' ? 'sin leer' : 'pendientes'}` : '');
            return <button key={item.id} type="button" onClick={() => navigate(item.id)} aria-label={name} aria-current={selected ? 'page' : undefined} title={name} className={'sidebar-item' + (selected ? ' is-active' : '')}>
              <span className="sidebar-item-icon"><Icon name={item.icon} size={18} /></span>
              <span className="sidebar-item-label">{item.label}</span>
              {count > 0 && <span aria-hidden="true" className={'sidebar-counter' + (item.counter === 'pending' ? ' is-pending' : '')}>{count > 99 ? '99+' : count}</span>}
            </button>;
          })}</div>
        </section>)}
      </nav>

      <footer className="sidebar-footer" title={currentUser?.nombre + ' · ' + roleLabel}>
        <span className="sidebar-avatar" aria-hidden="true">{initials}</span>
        <div className="sidebar-user-copy"><p className="sidebar-user-name">{currentUser?.nombre}</p><p className="sidebar-user-role">{roleLabel}</p></div>
      </footer>
    </aside>
  </>;
}
