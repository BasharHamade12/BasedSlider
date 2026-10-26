import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { Point, SLIDE_H, SLIDE_W } from '../model/types';
import { createPen } from '../model/factories';
import { nextElementId } from '../model/ids';
import { useDocStore, useUiStore } from '../model/store';

interface DrawingOverlayProps {
  svgRef: RefObject<SVGSVGElement | null>;
  scale: number;
}

function livePath(points: Point[]): string {
  if (points.length < 2) return '';
  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) path += ` L${points[i].x},${points[i].y}`;
  return path;
}

export function DrawingOverlay({ svgRef, scale }: DrawingOverlayProps) {
  const tool = useUiStore((state) => state.tool);
  const penColor = useUiStore((state) => state.penColor);
  const penWidth = useUiStore((state) => state.penWidth);
  const highlighterColor = useUiStore((state) => state.highlighterColor);
  const penTip = useUiStore((state) => state.penTip);
  const penOpacity = useUiStore((state) => state.penOpacity);
  const [points, setPoints] = useState<Point[]>([]);
  const drawingRef = useRef(false);

  const active = tool === 'pen' || tool === 'highlighter';
  const isHighlighter = tool === 'highlighter' || penTip === 'highlighter';
  const color = isHighlighter ? highlighterColor : penColor;
  const width = isHighlighter ? penWidth * 5 : penWidth;
  const opacity = isHighlighter ? 0.35 * penOpacity : penOpacity;

  const toSlide = useCallback(
    (event: React.PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) / (scale || 1),
        y: (event.clientY - rect.top) / (scale || 1),
      };
    },
    [scale, svgRef],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        drawingRef.current = false;
        setPoints([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onPointerDown = (event: React.PointerEvent<SVGRectElement>) => {
    if (!active || event.button !== 0) return;
    const point = toSlide(event);
    drawingRef.current = true;
    setPoints([{ x: point.x, y: point.y, pressure: event.pressure || 0.5 }]);
    // Capture keeps the stroke alive when the finger leaves the slide's
    // draw area; it throws if the pointer already went away, which would
    // otherwise abort this handler before the stroke even starts.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* no active pointer id to capture */
    }
    event.preventDefault();
  };

  const onPointerMove = (event: React.PointerEvent<SVGRectElement>) => {
    if (!drawingRef.current) return;
    const point = toSlide(event);
    setPoints((current) => {
      const last = current[current.length - 1];
      if (last && Math.hypot(last.x - point.x, last.y - point.y) < 1.5) return current;
      return [...current, { x: point.x, y: point.y, pressure: event.pressure || 0.5 }];
    });
  };

  const finish = (event: React.PointerEvent<SVGRectElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const rect = event.currentTarget;
    if (rect.hasPointerCapture(event.pointerId)) rect.releasePointerCapture(event.pointerId);

    if (points.length >= 2) {
      const doc = useDocStore.getState().doc;
      const element = createPen(nextElementId(doc), points, {
        color,
        strokeWidth: width,
        smoothing: penTip !== 'pencil',
        mode: isHighlighter ? 'highlighter' : 'pen',
        opacity,
      });
      // Keep the pen/highlighter tool armed after a stroke: no selection,
      // no tool reset, so the next drag starts a new doodle immediately.
      useDocStore.getState().addElement(element, { select: false });
    }
    setPoints([]);
  };

  if (!active) return null;

  return (
    <g className="drawing-overlay">
      <rect
        x={0}
        y={0}
        width={SLIDE_W}
        height={SLIDE_H}
        fill="transparent"
        style={{ touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={() => {
          drawingRef.current = false;
          setPoints([]);
        }}
      />
      {points.length > 1 && (
        <path
          d={livePath(points)}
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={opacity}
          pointerEvents="none"
        />
      )}
    </g>
  );
}
