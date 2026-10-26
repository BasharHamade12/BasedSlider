import { CSSProperties, useEffect, useRef } from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { TopToolbar } from './panels/TopToolbar';
import { SlideRail } from './panels/SlideRail';
import { LeftPanel } from './panels/LeftPanel';
import { CanvasPanel } from './canvas/CanvasPanel';
import { RightPanel } from './panels/RightPanel';
import { PanelResizer } from './panels/PanelResizer';
import { BottomPanel } from './panels/BottomPanel';
import { ContextMenu } from './panels/ContextMenu';
import { PresentMode } from './presentation/PresentMode';
import { PdfExportLayer } from './presentation/PdfExportLayer';
import { useCodeSync } from './hooks/useCodeSync';
import { useEditorShortcuts } from './hooks/useEditorShortcuts';
import { loadInitialDeck, useAutosave } from './persistence/storage';
import { useDocStore, useUiStore } from './model/store';

export default function App() {
  const presenting = useUiStore((state) => state.presenting);
  const leftCollapsed = useUiStore((state) => state.leftCollapsed);
  const rightCollapsed = useUiStore((state) => state.rightCollapsed);
  const leftWidth = useUiStore((state) => state.leftWidth);
  const rightWidth = useUiStore((state) => state.rightWidth);
  const toggleLeftPanel = useUiStore((state) => state.toggleLeftPanel);
  const toggleRightPanel = useUiStore((state) => state.toggleRightPanel);
  const setLeftWidth = useUiStore((state) => state.setLeftWidth);
  const setRightWidth = useUiStore((state) => state.setRightWidth);
  const theme = useUiStore((state) => state.theme);
  const hydrated = useRef(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Rotating a phone or narrowing the window must never leave the side
  // panels covering the canvas: collapse them the moment we go narrow.
  // (They never auto-expand — the user reopens them with the edge handles.)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(max-width: 720px)');
    const onChange = () => {
      if (!query.matches) return;
      const ui = useUiStore.getState();
      if (!ui.leftCollapsed) ui.toggleLeftPanel();
      if (!ui.rightCollapsed) ui.toggleRightPanel();
    };
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  // A narrower window must shrink the panels too, or they'd squeeze the
  // canvas away. Re-applying the current widths runs them through the clamp.
  useEffect(() => {
    const onResize = () => {
      const ui = useUiStore.getState();
      ui.setLeftWidth(ui.leftWidth);
      ui.setRightWidth(ui.rightWidth);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useCodeSync();
  useEditorShortcuts();
  useAutosave();

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const deck = loadInitialDeck();
    useDocStore.getState().setDoc(deck, 'Load deck', { history: false });
  }, []);

  return (
    <>
      <div className="app">
        <TopToolbar />
        <SlideRail />
        <div
          className="app-body"
          style={
            {
              '--left-panel-width': `${leftWidth}px`,
              '--right-panel-width': `${rightWidth}px`,
            } as CSSProperties
          }
        >
          <LeftPanel />
          {leftCollapsed && (
            <button
              className="panel-restore panel-restore-left"
              onClick={toggleLeftPanel}
              title="Show code panel"
              aria-label="Show code panel"
            >
              <ChevronsRight size={14} />
            </button>
          )}
          {!leftCollapsed && (
            <PanelResizer side="left" width={leftWidth} onResize={setLeftWidth} />
          )}
          <CanvasPanel />
          <RightPanel />
          {!rightCollapsed && (
            <PanelResizer side="right" width={rightWidth} onResize={setRightWidth} />
          )}
          {rightCollapsed && (
            <button
              className="panel-restore panel-restore-right"
              onClick={toggleRightPanel}
              title="Show properties panel"
              aria-label="Show properties panel"
            >
              <ChevronsLeft size={14} />
            </button>
          )}
        </div>
        <BottomPanel />
        <ContextMenu />
      </div>
      {presenting && <PresentMode />}
      <PdfExportLayer />
    </>
  );
}
