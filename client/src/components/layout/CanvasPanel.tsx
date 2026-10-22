import { useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { CanvasViewer } from '../canvas/CanvasViewer';

export function CanvasPanel() {
  const slides = useStore(s => s.slides);
  const activeSlideIndex = useStore(s => s.activeSlideIndex);
  const setActiveSlide = useStore(s => s.setActiveSlide);
  const isDrawMode = useStore(s => s.isDrawMode);
  const selectElement = useStore(s => s.selectElement);

  const prev = useCallback(() => {
    if (activeSlideIndex > 0) {
      setActiveSlide(activeSlideIndex - 1);
      selectElement(null);
    }
  }, [activeSlideIndex, setActiveSlide, selectElement]);

  const next = useCallback(() => {
    if (activeSlideIndex < slides.length - 1) {
      setActiveSlide(activeSlideIndex + 1);
      selectElement(null);
    }
  }, [activeSlideIndex, slides.length, setActiveSlide, selectElement]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.closest('.monaco-editor') || t?.closest('input, textarea, [contenteditable]')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prev, next]);

  const slide = slides[activeSlideIndex];

  return (
    <main className="canvas-panel">
      <div className="canvas-header">
        <span className="canvas-slide-label">
          {slides.length > 0 ? `${activeSlideIndex + 1} / ${slides.length}` : ''}
        </span>
      </div>
      <div className={`canvas-viewport ${isDrawMode ? 'draw-mode' : ''}`} onContextMenu={e => e.preventDefault()}>
        {slide ? (
          <CanvasViewer slide={slide} />
        ) : (
          <div className="canvas-empty">
            <p>No slides yet. Start writing code or click "New Slide".</p>
          </div>
        )}
      </div>
      {slides.length > 1 && (
        <div className="canvas-nav">
          <button
            className="nav-btn"
            onClick={prev}
            disabled={activeSlideIndex === 0}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="nav-btn"
            onClick={next}
            disabled={activeSlideIndex >= slides.length - 1}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </main>
  );
}
