import { useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { canvasSize } from '../model/types';
import { useDocStore, useUiStore } from '../model/store';
import { ElementView } from '../canvas/ElementView';

export function SlideRail() {
  const doc = useDocStore((state) => state.doc);
  const activeSlideIndex = useUiStore((state) => state.activeSlideIndex);
  const setActiveSlide = useUiStore((state) => state.setActiveSlide);
  const addSlide = useDocStore((state) => state.addSlide);
  const moveSlide = useDocStore((state) => state.moveSlide);
  const collapsed = useUiStore((state) => state.railCollapsed);
  const toggleRail = useUiStore((state) => state.toggleRail);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  if (collapsed) {
    return (
      <div className="slide-rail collapsed">
        <button
          className="rail-restore"
          onClick={toggleRail}
          title="Show slide rail"
          aria-label="Show slide rail"
        >
          <ChevronDown size={14} />
          <span>Slides</span>
        </button>
      </div>
    );
  }

  return (
    <div className="slide-rail" role="tablist" aria-label="Slides">
      {doc.slides.map((slide, index) => (
        <div
          key={slide.id}
          ref={(node) => { slideRefs.current[index] = node; }}
          data-board-w={canvasSize(slide).width}
          className={`slide-thumb ${index === activeSlideIndex ? 'active' : ''} ${
            dragIndex === index ? 'dragging' : ''
          }`}
          onClick={() => setActiveSlide(index)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setActiveSlide(index);
              return;
            }
            const nextIndex = event.key === 'ArrowRight'
              ? Math.min(doc.slides.length - 1, index + 1)
              : event.key === 'ArrowLeft'
                ? Math.max(0, index - 1)
                : event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? doc.slides.length - 1
                    : null;
            if (nextIndex !== null) {
              event.preventDefault();
              setActiveSlide(nextIndex);
              slideRefs.current[nextIndex]?.focus();
            }
          }}
          tabIndex={index === activeSlideIndex ? 0 : -1}
          draggable
          onDragStart={() => setDragIndex(index)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (dragIndex !== null && dragIndex !== index) moveSlide(dragIndex, index);
            setDragIndex(null);
          }}
          onDragEnd={() => setDragIndex(null)}
          role="tab"
          aria-selected={index === activeSlideIndex}
          title={slide.name}
        >
          <div className="slide-thumb-canvas">
            {(() => {
              const board = canvasSize(slide);
              return (
                <svg
                  viewBox={`0 0 ${board.width} ${board.height}`}
                  preserveAspectRatio="xMidYMid meet"
                  width="100%"
                  height="100%"
                >
                  <rect x={0} y={0} width={board.width} height={board.height} fill={slide.background} />
                  {slide.backgroundImage && (
                    <image
                      href={slide.backgroundImage}
                      x={0}
                      y={0}
                      width={board.width}
                      height={board.height}
                      preserveAspectRatio="xMidYMid meet"
                    />
                  )}
                  {slide.elements.map((element) => (
                    <ElementView key={element.id} element={element} elements={slide.elements} />
                  ))}
                </svg>
              );
            })()}
          </div>
          <span className="slide-thumb-label">
            {index + 1}. {slide.name}
          </span>
        </div>
      ))}
      <button className="slide-add" onClick={addSlide} title="New slide" aria-label="New slide">
        <Plus size={18} />
      </button>
      <button
        className="panel-collapse rail-collapse"
        onClick={toggleRail}
        title="Collapse slide rail"
        aria-label="Collapse slide rail"
      >
        <ChevronUp size={14} />
      </button>
    </div>
  );
}
