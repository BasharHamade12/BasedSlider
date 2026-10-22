import { useRef, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { Point } from '../../store/presentation.types';

interface DrawingOverlayProps {
  slideW: number;
  slideH: number;
}

function findSlideCloser(source: string, slideIndex: number): number {
  const re = /slide\s+"[^"]*"\s*\{/g;
  let match: RegExpExecArray | null;
  let current = 0;
  while ((match = re.exec(source)) !== null) {
    if (current === slideIndex) {
      const bracePos = source.indexOf('{', match.index);
      let depth = 1;
      let pos = bracePos + 1;
      while (depth > 0 && pos < source.length) {
        if (source[pos] === '{') depth++;
        else if (source[pos] === '}') depth--;
        pos++;
      }
      return pos - 1;
    }
    current++;
  }
  return -1;
}

function buildPenSnippet(color: string, width: number, points: Point[]): string {
  const ptStr = points
    .map(p => `{x: ${+p.x.toFixed(1)}; y: ${+p.y.toFixed(1)}; pressure: ${p.pressure};}`)
    .join(',\n            ');
  return `\n    pen {\n        color: "${color}";\n        width: ${width};\n        smoothing: false;\n        points: [\n            ${ptStr}\n        ];\n    }`;
}

export function DrawingOverlay({ slideW, slideH }: DrawingOverlayProps) {
  const isDrawMode = useStore(s => s.isDrawMode);
  const activeStroke = useStore(s => s.activeStroke);
  const startStroke = useStore(s => s.startStroke);
  const addPointToStroke = useStore(s => s.addPointToStroke);
  const clearStroke = useStore(s => s.clearStroke);
  const penColor = useStore(s => s.penColor);
  const penWidth = useStore(s => s.penWidth);
  const sourceCode = useStore(s => s.sourceCode);
  const setSourceCode = useStore(s => s.setSourceCode);
  const activeSlideIndex = useStore(s => s.activeSlideIndex);
  const rectRef = useRef<SVGRectElement>(null);

  const clientToViewBox = useCallback(
    (clientX: number, clientY: number) => {
      const rect = rectRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: ((clientX - rect.left) / rect.width) * slideW,
        y: ((clientY - rect.top) / rect.height) * slideH,
      };
    },
    [slideW, slideH],
  );

  if (!isDrawMode) return null;

  const handlePointerDown = (e: React.PointerEvent) => {
    const pt = clientToViewBox(e.clientX, e.clientY);
    startStroke({ x: pt.x, y: pt.y, pressure: e.pressure || 0.5, tiltX: e.tiltX, tiltY: e.tiltY });
    (e.target as SVGElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeStroke) return;
    const pt = clientToViewBox(e.clientX, e.clientY);
    addPointToStroke({ x: pt.x, y: pt.y, pressure: e.pressure || 0.5 });
  };

  const handlePointerUp = () => {
    if (!activeStroke || activeStroke.points.length < 2) {
      clearStroke();
      return;
    }

    const snippet = buildPenSnippet(penColor, penWidth, activeStroke.points);
    clearStroke();

    const closer = findSlideCloser(sourceCode, activeSlideIndex);
    if (closer === -1) {
      setSourceCode(sourceCode + snippet);
      return;
    }
    setSourceCode(sourceCode.slice(0, closer) + snippet + sourceCode.slice(closer));
  };

  const activePathD = activeStroke ? buildLivePath(activeStroke.points) : '';

  return (
    <g className="drawing-overlay">
      <rect
        ref={rectRef}
        width={slideW}
        height={slideH}
        fill="transparent"
        style={{ touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      {activeStroke && activeStroke.points.length > 1 && (
        <path
          d={activePathD}
          fill="none"
          stroke={penColor}
          strokeWidth={penWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </g>
  );
}

function buildLivePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) d += ` L${points[i].x},${points[i].y}`;
  return d;
}
