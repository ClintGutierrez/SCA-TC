import { Children, Fragment, forwardRef, isValidElement, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const textOf = (children) => Children.toArray(children).map((child) => typeof child === 'string' || typeof child === 'number'
  ? String(child) : isValidElement(child) ? textOf(child.props.children) : '').join('');
const normalize = (text) => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
const readable = (text) => {
  const value = String(text).replaceAll('_', ' ').replace(/\s+/g, ' ').trim();
  return normalize(value) === 'all in one' ? 'All in One' : value;
};
function readOptions(children, group = '', groupDisabled = false) {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    if (child.type === Fragment) return readOptions(child.props.children, group, groupDisabled);
    if (child.type === 'optgroup') return readOptions(child.props.children, child.props.label, groupDisabled || child.props.disabled);
    if (child.type !== 'option') return [];
    const text = textOf(child.props.children);
    const label = readable(child.props.label ?? text);
    return [{ value: String(child.props.value ?? text), label, group,
      search: normalize(label + ' ' + (child.props['data-search'] || '')),
      disabled: Boolean(groupDisabled || child.props.disabled), hidden: Boolean(child.props.hidden) }];
  });
}

// Conserva un select nativo para eventos, FormData y validación; el menú visible es común a toda la aplicación.
const Select = forwardRef(function Select({ children, value, defaultValue, onChange, onBlur, onFocus, onInvalid, onKeyDown, onClick,
  id, name, required, disabled, className = '', style, searchable, searchPlaceholder = 'Buscar opción…', multiple, size, ...props }, forwardedRef) {
  const generatedId = useId();
  const triggerId = id || 'sca-select-' + generatedId.replaceAll(':', '');
  const listId = triggerId + '-list';
  const nativeRef = useRef(null); const triggerRef = useRef(null); const panelRef = useRef(null); const listRef = useRef(null); const searchRef = useRef(null);
  const typeAhead = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false); const [query, setQuery] = useState(''); const [active, setActive] = useState(0);
  const [position, setPosition] = useState(null); const [invalid, setInvalid] = useState(false);
  const options = useMemo(() => readOptions(children), [children]);
  const [localValue, setLocalValue] = useState(() => String(defaultValue ?? options[0]?.value ?? ''));
  const selectedValue = String(value ?? localValue);
  const selected = options.find((option) => option.value === selectedValue);
  const hasSearch = searchable ?? options.filter((option) => !option.hidden).length >= 8;
  const visible = useMemo(() => options.filter((option) => !option.hidden && (!query || option.search.includes(normalize(query)))), [options, query]);
  const fallback = multiple || Number(size) > 1;
  const ariaProps = Object.fromEntries(Object.entries(props).filter(([key]) => key.startsWith('aria-') || key.startsWith('data-')));
  const isInvalid = invalid || props['aria-invalid'] === true || props['aria-invalid'] === 'true';
  useImperativeHandle(forwardedRef, () => nativeRef.current);

  const unavailable = () => disabled || nativeRef.current?.matches(':disabled');
  const focusTrigger = () => requestAnimationFrame(() => triggerRef.current?.isConnected && triggerRef.current.focus({ preventScroll: true }));
  const close = (restoreFocus = false) => { setOpen(false); setQuery(''); if (restoreFocus) focusTrigger(); };
  const forwardEvent = (event, handler) => handler?.({ ...event, target: nativeRef.current, currentTarget: nativeRef.current,
    preventDefault: () => event.preventDefault(), stopPropagation: () => event.stopPropagation() });
  const openMenu = () => {
    if (unavailable()) return;
    setQuery(''); setPosition(null);
    const index = options.filter((option) => !option.hidden).findIndex((option) => option.value === selectedValue && !option.disabled);
    setActive(index >= 0 ? index : Math.max(0, options.filter((option) => !option.hidden).findIndex((option) => !option.disabled)));
    setOpen(true);
  };
  const choose = (option) => {
    if (!option || option.disabled || unavailable() || !nativeRef.current) return;
    nativeRef.current.value = option.value;
    nativeRef.current.dispatchEvent(new Event('change', { bubbles: true }));
    close(true);
  };
  const blur = (event) => {
    if (triggerRef.current?.contains(event.relatedTarget) || panelRef.current?.contains(event.relatedTarget)) return;
    close(); forwardEvent(event, onBlur);
  };
  const handleKey = (event, fromSearch = false) => {
    if (!fromSearch) forwardEvent(event, onKeyDown);
    if (event.defaultPrevented || unavailable()) return;
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (event.key === 'Tab' && open) {
      close();
      if (fromSearch) {
        const elements = [...document.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')]
          .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length && !panelRef.current?.contains(element));
        const index = elements.indexOf(triggerRef.current);
        const next = elements[index + (event.shiftKey ? -1 : 1)];
        if (next) { event.preventDefault(); next.focus(); }
        else triggerRef.current?.focus();
      }
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!open) { openMenu(); return; }
      const enabled = visible.map((option, index) => !option.disabled ? index : -1).filter((index) => index >= 0);
      if (!enabled.length) return;
      if (event.key === 'Home') setActive(enabled[0]);
      else if (event.key === 'End') setActive(enabled.at(-1));
      else {
        const index = enabled.indexOf(active); const direction = event.key === 'ArrowDown' ? 1 : -1;
        setActive(enabled[(index + direction + enabled.length) % enabled.length]);
      }
      return;
    }
    if (event.key === 'Enter' || (event.key === ' ' && !fromSearch)) {
      event.preventDefault();
      if (open) choose(visible[active]); else openMenu();
      return;
    }
    if (!fromSearch && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const text = now - typeAhead.current.time < 700 ? typeAhead.current.text + event.key : event.key;
      typeAhead.current = { text, time: now };
      if (!open) openMenu();
      const index = options.filter((option) => !option.hidden).findIndex((option) => !option.disabled && option.search.startsWith(normalize(text)));
      if (index >= 0) setActive(index);
    }
  };

  useLayoutEffect(() => {
    if (!open) return;
    if (unavailable()) { setOpen(false); return; }
    let frame;
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const height = Math.min(window.innerHeight, (window.visualViewport?.height || window.innerHeight) + (window.visualViewport?.offsetTop || 0));
      const width = Math.min(Math.max(rect.width, 240), window.innerWidth - 16);
      if (rect.bottom < 0 || rect.top > height) { setOpen(false); return; }
      const below = height - rect.bottom - 14; const above = rect.top - 14;
      const up = below < 240 && above > below;
      setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), width,
        maxHeight: Math.max(64, Math.min(360, up ? above : below)), ...(up ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }) });
    };
    const move = (event) => {
      if (panelRef.current?.contains(event?.target)) return;
      cancelAnimationFrame(frame); frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('resize', move); window.addEventListener('scroll', move, true);
    window.visualViewport?.addEventListener('resize', move);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', move); window.removeEventListener('scroll', move, true); window.visualViewport?.removeEventListener('resize', move); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event) => { if (!triggerRef.current?.contains(event.target) && !panelRef.current?.contains(event.target)) close(); };
    document.addEventListener('pointerdown', outside);
    const frame = requestAnimationFrame(() => { if (hasSearch) searchRef.current?.focus({ preventScroll: true }); });
    return () => { document.removeEventListener('pointerdown', outside); cancelAnimationFrame(frame); };
  }, [open, hasSearch]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const element = listRef.current.querySelector('[data-index="' + active + '"]');
    if (!element) return;
    const listRect = listRef.current.getBoundingClientRect(); const optionRect = element.getBoundingClientRect();
    if (optionRect.top < listRect.top) listRef.current.scrollTop -= listRect.top - optionRect.top;
    else if (optionRect.bottom > listRect.bottom) listRef.current.scrollTop += optionRect.bottom - listRect.bottom;
  }, [open, active, query]);
  useEffect(() => { if (open && unavailable()) close(); });
  useEffect(() => { if (nativeRef.current?.validity.valid) setInvalid(false); }, [value, options]);
  useEffect(() => {
    const form = nativeRef.current?.form;
    const reset = () => requestAnimationFrame(() => { setLocalValue(nativeRef.current?.value || ''); setInvalid(false); close(); });
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, []);

  const handleChange = (event) => { setLocalValue(event.target.value); setInvalid(false); onChange?.(event); };
  if (fallback) return <select {...props} ref={nativeRef} id={id} name={name} className={className} style={style} value={value}
    defaultValue={value === undefined ? defaultValue : undefined} disabled={disabled} required={required} multiple={multiple} size={size}
    onChange={handleChange} onBlur={onBlur} onFocus={onFocus} onInvalid={onInvalid} onKeyDown={onKeyDown} onClick={onClick}>{children}</select>;

  return <>
    <button {...ariaProps} ref={triggerRef} id={triggerId} type="button" role="combobox" disabled={disabled} tabIndex={props.tabIndex}
      aria-expanded={open} aria-controls={listId} aria-haspopup="listbox" aria-required={required || undefined} aria-invalid={isInvalid}
      aria-activedescendant={open && !hasSearch && visible[active] ? listId + '-' + active : undefined}
      className={'sca-select-trigger ' + className} style={style} title={props.title || selected?.label}
      onClick={(event) => { forwardEvent(event, onClick); if (!event.defaultPrevented) { if (open) close(); else openMenu(); } }}
      onKeyDown={(event) => handleKey(event)} onFocus={(event) => forwardEvent(event, onFocus)} onBlur={blur}>
      <span className="sca-select-value">{selected?.label || 'Selecciona una opción'}</span>
      <svg className="sca-select-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
    </button>
    <select {...props} ref={nativeRef} data-sca-native="true" id={triggerId + '-native'} name={name} required={required} disabled={disabled}
      value={value} defaultValue={value === undefined ? defaultValue : undefined} tabIndex={-1} aria-hidden="true" className="sca-select-native"
      onFocus={() => triggerRef.current?.focus()} onChange={handleChange} onInvalid={(event) => {
        event.preventDefault(); setInvalid(true); onInvalid?.(event);
        if (!event.target.form || event.target.form.querySelector('input:invalid, select:invalid, textarea:invalid') === event.target) triggerRef.current?.focus();
      }}>{children}</select>
    {open && position && createPortal(<div ref={panelRef} className="sca-select-panel" style={position} onPointerDown={(event) => event.stopPropagation()}>
      {hasSearch && <div className="sca-select-search"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
        <input ref={searchRef} type="search" aria-label="Buscar opciones" aria-controls={listId} aria-activedescendant={visible[active] ? listId + '-' + active : undefined}
          placeholder={searchPlaceholder} autoComplete="off" value={query} onBlur={blur} onKeyDown={(event) => handleKey(event, true)}
          onChange={(event) => { const text = event.target.value; setQuery(text); setActive(Math.max(0, options.filter((option) => !option.hidden && (!text || option.search.includes(normalize(text)))).findIndex((option) => !option.disabled))); }} />
      </div>}
      <div ref={listRef} id={listId} role="listbox" aria-label={props['aria-label'] || 'Opciones disponibles'} className="sca-select-list">
        {visible.map((option, index) => <Fragment key={option.value + '-' + index}>
          {option.group && (index === 0 || visible[index - 1].group !== option.group) && <div className="sca-select-group">{option.group}</div>}
          <button id={listId + '-' + index} data-index={index} type="button" role="option" tabIndex={-1} aria-selected={option.value === selectedValue}
            aria-disabled={option.disabled} disabled={option.disabled} data-active={index === active} className="sca-select-option"
            onPointerDown={(event) => event.preventDefault()} onPointerMove={() => { if (!option.disabled) setActive(index); }} onClick={(event) => { event.stopPropagation(); choose(option); }}>
            <span>{option.label}</span>{option.value === selectedValue && <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m4 10 4 4 8-8" /></svg>}
          </button>
        </Fragment>)}
        {!visible.length && <p className="sca-select-empty" role="status">{options.some((option) => !option.hidden) ? 'No se encontraron opciones.' : 'No hay opciones disponibles.'}</p>}
      </div>
    </div>, document.body)}
  </>;
});

export default Select;
