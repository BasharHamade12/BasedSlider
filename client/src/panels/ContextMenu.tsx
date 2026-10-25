import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Copy, Film, Trash2, Type } from 'lucide-react';
import { useDocStore, useUiStore } from '../model/store';
import { isShape } from '../model/types';

export function ContextMenu() {
  const menu = useUiStore((state) => state.contextMenu);
  const setMenu = useUiStore((state) => state.setContextMenu);
  const setEditing = useUiStore((state) => state.setEditing);
  const doc = useDocStore((state) => state.doc);
  const activeSlideIndex = useUiStore((state) => state.activeSlideIndex);
  const duplicateSelection = useDocStore((state) => state.duplicateSelection);
  const deleteElements = useDocStore((state) => state.deleteElements);
  const reorder = useDocStore((state) => state.reorder);
  const addAnimation = useDocStore((state) => state.addAnimation);
  const menuRef = useRef<HTMLDivElement>(null);

  const element = doc.slides[activeSlideIndex]?.elements.find(
    (candidate) => candidate.id === menu?.elementId,
  );

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenu(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menu, setMenu]);

  if (!menu || !element) return null;

  const close = () => setMenu(null);
  const canEditText = element.type === 'text' || isShape(element);
  const left = Math.max(8, Math.min(menu.x, window.innerWidth - 230));
  const top = Math.max(8, Math.min(menu.y, window.innerHeight - 280));

  return createPortal(
    <div ref={menuRef} className="context-menu" style={{ left, top }} role="menu">
      <div className="context-menu-head">
        {element.type} <code>{element.id}</code>
      </div>
      {canEditText && (
        <button
          role="menuitem"
          onClick={() => {
            if (isShape(element) && !element.text) {
              useDocStore.getState().updateText(element.id, { content: '' }, 'label');
            }
            setEditing({
              elementId: element.id,
              target: element.type === 'text' ? 'text' : 'label',
            });
            close();
          }}
        >
          <Type size={13} /> Edit text
        </button>
      )}
      <button
        role="menuitem"
        onClick={() => {
          duplicateSelection([element.id]);
          close();
        }}
      >
        <Copy size={13} /> Duplicate
      </button>
      <button
        role="menuitem"
        onClick={() => {
          reorder([element.id], 'front');
          close();
        }}
      >
        <ArrowUp size={13} /> Bring to front
      </button>
      <button
        role="menuitem"
        onClick={() => {
          reorder([element.id], 'back');
          close();
        }}
      >
        <ArrowDown size={13} /> Send to back
      </button>
      <button
        role="menuitem"
        onClick={() => {
          addAnimation(element.id, 'fadeIn');
          close();
        }}
      >
        <Film size={13} /> Add fade-in
      </button>
      <div className="context-menu-sep" />
      <button
        className="danger"
        role="menuitem"
        onClick={() => {
          deleteElements([element.id]);
          close();
        }}
      >
        <Trash2 size={13} /> Delete
      </button>
    </div>,
    document.body,
  );
}
