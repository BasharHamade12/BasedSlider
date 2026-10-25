import { useEffect, useRef } from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { TopToolbar } from './panels/TopToolbar';
import { SlideRail } from './panels/SlideRail';
import { LeftPanel } from './panels/LeftPanel';
import { CanvasPanel } from './canvas/CanvasPanel';
import { RightPanel } from './panels/RightPanel';
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
  const toggleLeftPanel = useUiStore((state) => state.toggleLeftPanel);
  const toggleRightPanel = useUiStore((state) => state.toggleRightPanel);
  const theme = useUiStore((state) => state.theme);
  const hydrated = useRef(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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
        <div className="app-body">
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
          <CanvasPanel />
          <RightPanel />
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
