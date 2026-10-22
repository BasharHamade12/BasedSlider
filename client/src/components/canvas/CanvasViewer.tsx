import { Slide } from '../../store/presentation.types';
import { SlideRenderer } from './SlideRenderer';
import { DrawingOverlay } from './DrawingOverlay';

interface CanvasViewerProps {
  slide: Slide;
}

const SLIDE_W = 1920;
const SLIDE_H = 1080;

export function CanvasViewer({ slide }: CanvasViewerProps) {
  return (
    <svg
      className="canvas-svg"
      viewBox={`0 0 ${SLIDE_W} ${SLIDE_H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ backgroundColor: slide.background, overflow: 'hidden' }}
      onContextMenu={e => e.preventDefault()}
    >
      <SlideRenderer slide={slide} slideW={SLIDE_W} slideH={SLIDE_H} />
      <DrawingOverlay slideW={SLIDE_W} slideH={SLIDE_H} />
    </svg>
  );
}
