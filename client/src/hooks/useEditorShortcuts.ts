import { useEffect } from 'react';
import { useDocStore, useUiStore } from '../model/store';

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return !!element?.closest?.(
    'input, textarea, select, button, [contenteditable="true"], .monaco-editor',
  );
}

export function useEditorShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = isTypingTarget(target) && !event.key.startsWith('F');
      const mod = event.metaKey || event.ctrlKey;
      const docStore = useDocStore.getState();
      const ui = useUiStore.getState();

      if (event.key === 'F5') {
        event.preventDefault();
        ui.startPresenting(event.shiftKey ? ui.activeSlideIndex : 0);
        return;
      }
      if (typing) return;

      if (mod) {
        const key = event.key.toLowerCase();
        if (key === 'z') {
          event.preventDefault();
          if (event.shiftKey) docStore.redo();
          else docStore.undo();
          return;
        }
        if (key === 'y') {
          event.preventDefault();
          docStore.redo();
          return;
        }
        if (key === 'c') {
          docStore.copySelection(ui.selectedIds);
          return;
        }
        if (key === 'v') {
          docStore.pasteClipboard();
          return;
        }
        if (key === 'd') {
          event.preventDefault();
          docStore.duplicateSelection(ui.selectedIds);
          return;
        }
        if (key === 'a') {
          event.preventDefault();
          const slide = docStore.doc.slides[ui.activeSlideIndex];
          ui.setSelection((slide?.elements ?? []).map((element) => element.id));
          return;
        }
        if (key === '0') {
          event.preventDefault();
          ui.fit();
          return;
        }
        if (key === 'g') {
          event.preventDefault();
          if (ui.selectedIds.length > 0) {
            if (event.shiftKey) docStore.ungroupSelection(ui.selectedIds);
            else docStore.groupSelection(ui.selectedIds);
          }
          return;
        }
      }

      if (event.key === 'Escape') {
        ui.setContextMenu(null);
        ui.setEditing(null);
        ui.clearSelection();
        ui.setTool('select');
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (ui.selectedIds.length > 0) {
          event.preventDefault();
          docStore.deleteElements(ui.selectedIds);
        }
        return;
      }

      if (event.key.startsWith('Arrow') && ui.selectedIds.length > 0) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const delta =
          event.key === 'ArrowLeft'
            ? { x: -step, y: 0 }
            : event.key === 'ArrowRight'
              ? { x: step, y: 0 }
              : event.key === 'ArrowUp'
                ? { x: 0, y: -step }
                : { x: 0, y: step };
        docStore.nudge(ui.selectedIds, delta.x, delta.y);
        return;
      }

      if (mod || event.altKey) return;
      switch (event.key.toLowerCase()) {
        case 'v':
          ui.setTool('select');
          break;
        case 'r':
          ui.setTool('rect');
          break;
        case 'e':
          ui.setTool('ellipse');
          break;
        case 't':
          ui.setTool('text');
          break;
        case 'l':
          ui.setTool('latex');
          break;
        case 'c':
          ui.setTool('code');
          break;
        case 'p':
          ui.setTool('pen');
          break;
        case 's':
          ui.setTool('select');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
