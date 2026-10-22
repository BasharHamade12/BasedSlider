import { TopToolbar } from './components/layout/TopToolbar';
import { LeftPanel } from './components/layout/LeftPanel';
import { CanvasPanel } from './components/layout/CanvasPanel';
import { RightPanel } from './components/layout/RightPanel';
import { BottomPanel } from './components/layout/BottomPanel';
import { SlideNavigator } from './components/layout/SlideNavigator';
import { useCompiler } from './hooks/useCompiler';

export default function App() {
  useCompiler();

  return (
    <div className="app">
      <TopToolbar />
      <SlideNavigator />
      <div className="app-body">
        <LeftPanel />
        <CanvasPanel />
        <RightPanel />
      </div>
      <BottomPanel />
    </div>
  );
}
