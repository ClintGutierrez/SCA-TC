import { useCallback, useEffect, useRef, useState } from 'react';

export default function useDetalleBandejaTI(focusId) {
  const [selection, setSelection] = useState(() => focusId ? { id: focusId } : null);
  const detailSectionRef = useRef(null);
  const detailTitleRef = useRef(null);
  const openButtonRef = useRef(null);
  const searchRef = useRef(null);

  const focusDetail = useCallback(() => {
    detailTitleRef.current?.focus({ preventScroll: true });
    detailSectionRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, []);

  useEffect(() => {
    if (focusId) {
      openButtonRef.current = null;
      setSelection((current) => current?.id === focusId ? current : { id: focusId });
    }
  }, [focusId]);

  useEffect(() => {
    if (selection) focusDetail();
  }, [selection, focusDetail]);

  const openDetail = (id, code, opener = null) => {
    openButtonRef.current = opener;
    if (selection?.id === id) focusDetail();
    else setSelection({ id, code });
  };

  const closeDetail = () => {
    setSelection(null);
    const opener = openButtonRef.current;
    openButtonRef.current = null;
    requestAnimationFrame(() => (opener?.isConnected ? opener : searchRef.current)?.focus());
  };

  const retryDetail = () => setSelection((current) => current && { ...current });

  return { selection, openDetail, closeDetail, retryDetail, detailSectionRef, detailTitleRef, searchRef };
}
