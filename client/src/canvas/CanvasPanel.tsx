import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minus, Plus } from 'lucide-react';
import { canvasSize } from '../model/types';
import { useDocStore, useUiStore } from '../model/store';
import { useCanvasSize } from './useCanvasSize';
import { useInteraction } from './useInteraction';
import { ElementView } from './ElementView';
import { SelectionOverlay } from './SelectionOverlay';
import { DrawingOverlay } from './DrawingOverlay';
import { HtmlEmbedLayer } from './HtmlEmbedLayer';
import { InlineTextEditor } from './InlineTextEditor';

const TOOL_HINTS: Record<string, string> = {
  rect: 'Click to place a rectangle',
  ellipse: 'Click to place an ellipse',
  triangle: 'Click to place a triangle',
  line: 'Click to place a line',
  polygon: 'Click to place a polygon',
  star: 'Click to place a star',
  arrow: 'Click to place an arrow',
  chevron: 'Click to place a chevron',
  parallelogram: 'Click to place a parallelogram',
  trapezoid: 'Click to place a trapezoid',
  speech: 'Click to place a speech bubble',
  text: 'Click to place text',
  latex: 'Click to place a math block',
  code: 'Click to place a code block',
  html: 'Click to place an HTML embed',
  pen: 'Drag to draw',
  highlighter: 'Drag to highlight',
  connector: 'Drag from one shape to another',
};

export function CanvasPanel() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const doc = useDocStore((state) => state.doc);
  const activeSlideIndex = useUiStore((state) => state.activeSlideIndex);
  const setActiveSlide = useUiStore((state) => state.setActiveSlide);
  const zoom = useUiStore((state) => state.zoom);
  const pan = useUiStore((state) => state.pan);
  const setZoom = useUiStore((state) => state.setZoom);
  const fit = useUiStore((state) => state.fit);
  const tool = useUiStore((state) => state.tool);
  const guides = useUiStore((state) => state.guides);
  const gridEnabled = useUiStore((state) => state.gridEnabled);
  const snapEnabled = useUiStore((state) => state.snapEnabled);
  const setGridEnabled = useUiStore((state) => state.setGridEnabled);
  const setSnapEnabled = useUiStore((state) => state.setSnapEnabled);

  const slide = doc.slides[activeSlideIndex];
  const board = canvasSize(slide ?? { width: undefined, height: undefined });
  const metrics = useCanvasSize(containerRef, board.width, board.height);
  const interaction = useInteraction(svgRef, metrics.scale);
  const showGrid = gridEnabled;

  /* ─── drag-to-resize the canvas ─── */

  // Live preview size while dragging the corner handle; committed on pointer
  // up as one undo step through updateSlide.
  const [resizePreview, setResizePreview] = useState<{ width: number; height: number } | null>(null);
  const updateSlideAction = useDocStore((state) => state.updateSlide);

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    const originX = event.clientX;
    const originY = event.clientY;
    const startW = board.width;
    const startH = board.height;
    const scale = Math.max(metrics.scale, 0.0001);
    // Capture keeps the drag alive outside the handle, but it can throw when
    // the pointer is already gone (or synthetic, as in tests).
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      /* no active pointer id to capture */
    }
    let last = { width: startW, height: startH };

    const onMove = (move: PointerEvent) => {
      // Snap to a 20-unit grid, clamped to a readable projector-friendly range.
      const clampW = (v: number) => Math.min(7680, Math.max(320, v));
      const next = {
        width: clampW(Math.round((startW + (move.clientX - originX) / scale) / 20) * 20),
        height: clampW(Math.round((startH + (move.clientY - originY) / scale) / 20) * 20),
      };
      last = next;
      setResizePreview(next);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setResizePreview(null);
      const sizeChanged = last.width !== startW || last.height !== startH;
      if (sizeChanged && activeSlideIndex >= 0 && slide) {
        updateSlideAction(activeSlideIndex, { width: last.width, height: last.height });
      }
    };

    // Window listeners see the move even when the cursor leaves the handle.
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const stageWidth = (resizePreview?.width ?? board.width) * metrics.scale;
  const stageHeight = (resizePreview?.height ?? board.height) * metrics.scale;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const ui = useUiStore.getState();
      if (event.ctrlKey || event.metaKey) {
        const factor = Math.exp(-event.deltaY * 0.0015);
        ui.setZoom(ui.zoom * factor);
      } else {
        ui.setPan({ x: ui.pan.x - event.deltaX, y: ui.pan.y - event.deltaY });
      }
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  const goTo = (index: number) => {
    if (index < 0 || index >= doc.slides.length) return;
    setActiveSlide(index);
  };

  return (
    <main className="canvas-panel">
      <div className="canvas-topline">
        <span className="canvas-slide-label">
          {doc.slides.length > 0 ? `${activeSlideIndex + 1} / ${doc.slides.length}` : 'No slides'}
        </span>
        {TOOL_HINTS[tool] && <span className="canvas-tool-hint">{TOOL_HINTS[tool]}</span>}
        <div className="canvas-zoom">
          <label className="canvas-check" title="Snap to guides and grid">
            <input
              type="checkbox"
              checked={snapEnabled}
              onChange={(event) => setSnapEnabled(event.target.checked)}
            />
            Snap
          </label>
          <label className="canvas-check" title="Show grid">
            <input
              type="checkbox"
              checked={gridEnabled}
              onChange={(event) => setGridEnabled(event.target.checked)}
            />
            Grid
          </label>
          <button className="icon-btn" onClick={() => setZoom(zoom - 0.1)} title="Zoom out" aria-label="Zoom out">
            <Minus size={15} />
          </button>
          <span className="canvas-zoom-value">{Math.round(zoom * 100)}%</span>
          <button className="icon-btn" onClick={() => setZoom(zoom + 0.1)} title="Zoom in" aria-label="Zoom in">
            <Plus size={15} />
          </button>
          <button className="icon-btn" onClick={fit} title="Fit to window (Ctrl+0)" aria-label="Fit to window">
            <Maximize2 size={15} />
          </button>
        </div>
      </div>

      <div className="canvas-viewport" ref={containerRef}>
        {slide ? (
          <>
            <div
              className="canvas-stage"
              style={{
                transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,
              }}
            >
              <svg
                ref={svgRef}
                className={`canvas-svg tool-${tool}`}
                role="application"
                aria-label={slide ? `${slide.name} slide canvas` : 'Empty slide canvas'}
                tabIndex={0}
                width={Math.max(1, stageWidth)}
                height={Math.max(1, stageHeight)}
                viewBox={`0 0 ${board.width} ${board.height}`}
                preserveAspectRatio="none"
                onPointerDown={interaction.onPointerDown}
                onPointerMove={interaction.onPointerMove}
                onPointerUp={interaction.onPointerUp}
                onPointerCancel={interaction.onPointerCancel}
                onDoubleClick={interaction.onDoubleClick}
                onContextMenu={(event) => {
                  event.preventDefault();
                  const target = event.target as globalThis.Element;
                  const hit = target.closest?.('[data-element-id]') as HTMLElement | null;
                  if (!hit) {
                    useUiStore.getState().setContextMenu(null);
                    return;
                  }
                  const id = hit.dataset.elementId ?? '';
                  useUiStore.getState().setSelection([id]);
                  useUiStore.getState().setContextMenu({
                    elementId: id,
                    x: event.clientX,
                    y: event.clientY,
                  });
                }}
              >
                <title>{slide ? `${slide.name} slide` : 'Empty slide canvas'}</title>
                <defs>
                  <pattern id="canvas-grid" width={40} height={40} patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,0,0,0.09)" strokeWidth={1} />
                  </pattern>
                </defs>
                <rect x={0} y={0} width={board.width} height={board.height} fill={slide.background} />
                {slide.backgroundImage && (
                  <image
                    href={slide.backgroundImage}
                    x={0}
                    y={0}
                    width={board.width}
                    height={board.height}
                    preserveAspectRatio="xMidYMid meet"
                    pointerEvents="none"
                  />
                )}
                {showGrid && (
                  <rect x={0} y={0} width={board.width} height={board.height} fill="url(#canvas-grid)" pointerEvents="none" />
                )}
                {slide.elements.map((element) => (
                  <ElementView key={element.id} element={element} elements={slide.elements} />
                ))}

                {guides.v.map((x, index) => (
                  <line
                    key={`v-${index}`}
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={board.height}
                    stroke="#ff3b30"
                    strokeWidth={1 / Math.max(metrics.scale, 0.01)}
                    strokeDasharray="6 4"
                    pointerEvents="none"
                  />
                ))}
                {guides.h.map((y, index) => (
                  <line
                    key={`h-${index}`}
                    x1={0}
                    y1={y}
                    x2={board.width}
                    y2={y}
                    stroke="#ff3b30"
                    strokeWidth={1 / Math.max(metrics.scale, 0.01)}
                    strokeDasharray="6 4"
                    pointerEvents="none"
                  />
                ))}

                <SelectionOverlay
                  scale={metrics.scale}
                  marquee={interaction.marquee}
                  pending={interaction.pending}
                />
                <DrawingOverlay svgRef={svgRef} scale={metrics.scale} />
              </svg>
              <HtmlEmbedLayer svgRef={svgRef} scale={metrics.scale} />

              {/* Drag the canvas corner to resize this slide. */}
              <div
                className="canvas-resize-handle"
                onPointerDown={startResize}
                title="Drag to resize the canvas"
                aria-label="Resize canvas"
                role="button"
              />
              {resizePreview && (
                <div className="canvas-resize-badge">
                  {resizePreview.width} × {resizePreview.height}
                </div>
              )}
            </div>

            <InlineTextEditor containerRef={containerRef} svgRef={svgRef} scale={metrics.scale} />

            {doc.slides.length > 1 && (
              <div className="canvas-nav">
                <button
                  className="nav-btn"
                  onClick={() => goTo(activeSlideIndex - 1)}
                  disabled={activeSlideIndex === 0}
                  title="Previous slide"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="nav-btn"
                  onClick={() => goTo(activeSlideIndex + 1)}
                  disabled={activeSlideIndex >= doc.slides.length - 1}
                  title="Next slide"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="canvas-empty">
            <p>This deck has no slides. Add one from the toolbar.</p>
          </div>
        )}
      </div>
    </main>
  );
}
