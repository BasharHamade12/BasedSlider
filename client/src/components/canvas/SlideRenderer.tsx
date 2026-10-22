import { useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../../store/useStore';
import {
  Slide,
  SlideElement,
  RectElement,
  TextElement,
  LatexElement,
  PenElement,
  CodeElement,
} from '../../store/presentation.types';
import { serialize } from '../../utils/serialize';
import { ContextMenu } from './ContextMenu';

interface SlideRendererProps {
  slide: Slide;
  slideW: number;
  slideH: number;
}

export function SlideRenderer({ slide, slideW, slideH }: SlideRendererProps) {
  const selectedElementId = useStore(s => s.selectedElementId);
  const selectElement = useStore(s => s.selectElement);
  const isDragging = useStore(s => s.isDragging);
  const setDragging = useStore(s => s.setDragging);
  const updateElementPosition = useStore(s => s.updateElementPosition);
  const setSourceCode = useStore(s => s.setSourceCode);
  const isDrawMode = useStore(s => s.isDrawMode);

  const [contextMenu, setContextMenu] = useState<{ element: SlideElement; x: number; y: number } | null>(null);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const dragElemIdRef = useRef<string | null>(null);
  const dragDistanceRef = useRef(0);
  const svgRef = useRef<SVGGElement>(null);

  const clientToViewBox = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current?.closest('svg');
      if (!svg) return { x: 0, y: 0 };
      const r = svg.getBoundingClientRect();
      return {
        x: ((clientX - r.left) / r.width) * slideW,
        y: ((clientY - r.top) / r.height) * slideH,
      };
    },
    [slideW, slideH],
  );

  const handlePointerDown = (e: React.PointerEvent, elemId: string) => {
    console.log('[SlideRenderer] pointerDown on', elemId, 'isDrawMode:', isDrawMode, 'button:', e.button);
    if (isDrawMode) return;

    if (e.button === 2) {
      e.preventDefault();
      e.stopPropagation();
      const el = slide.elements.find(el => el.id === elemId);
      if (!el) return;
      selectElement(el.id);
      setContextMenu({ element: el, x: e.clientX, y: e.clientY });
      return;
    }

    if (selectedElementId !== elemId) {
      selectElement(elemId);
    }

    console.log('[SlideRenderer] starting drag on', elemId);
    const pt = clientToViewBox(e.clientX, e.clientY);
    lastPosRef.current = pt;
    dragElemIdRef.current = elemId;
    dragDistanceRef.current = 0;
    setDragging(true);

    const target = e.currentTarget as SVGElement;
    target.setPointerCapture(e.pointerId);
    e.stopPropagation();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragElemIdRef.current) return;

    const pt = clientToViewBox(e.clientX, e.clientY);
    const dx = pt.x - lastPosRef.current.x;
    const dy = pt.y - lastPosRef.current.y;
    lastPosRef.current = pt;

    const slides = useStore.getState().slides;
    const idx = useStore.getState().activeSlideIndex;
    const el = slides[idx]?.elements.find(el => el.id === dragElemIdRef.current);
    if (!el) return;

    const newX = el.x + dx;
    const newY = el.y + dy;
    console.log('[SlideRenderer] dragging', dragElemIdRef.current, 'to', newX, newY);
    updateElementPosition(dragElemIdRef.current, newX, newY);
    dragDistanceRef.current += Math.abs(dx) + Math.abs(dy);
  };

  const handlePointerUp = () => {
    if (!isDragging || !dragElemIdRef.current) return;
    console.log('[SlideRenderer] drag end on', dragElemIdRef.current, 'distance:', dragDistanceRef.current);

    const hadRealDrag = dragDistanceRef.current > 5;
    setDragging(false);
    dragElemIdRef.current = null;

    if (hadRealDrag) {
      const slides = useStore.getState().slides;
      setSourceCode(serialize(slides));
    }
  };

  console.log('[SlideRenderer] render, elements:', slide.elements.length, 'selected:', selectedElementId, 'drawing:', isDragging);

  return (
    <>
      <g ref={svgRef} className="slide-renderer">
        {slide.elements.map(el => {
          const selected = el.id === selectedElementId;
          return (
            <g
              key={el.id}
              data-elem-id={el.id}
              data-selected={selected ? 'true' : undefined}
            onPointerDown={(e) => handlePointerDown(e, el.id)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
              style={{
                cursor: isDrawMode ? 'default' : selected ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
              }}
              pointerEvents="all"
            >
              <ElementRenderer element={el} />
              {selected && <SelectionOutline element={el} />}
            </g>
          );
        })}
      </g>
      {contextMenu && createPortal(
        <ContextMenu
          element={contextMenu.element}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />,
        document.body
      )}
    </>
  );
}

function ElementRenderer({ element }: { element: SlideElement }) {
  switch (element.type) {
    case 'rect':
      return <RectShape element={element} />;
    case 'text':
      return <TextShape element={element} />;
    case 'latex':
      return <LatexShape element={element} />;
    case 'pen':
      return <PenShape element={element} />;
    case 'code':
      return <CodeShape element={element} />;
  }
}

function RectShape({ element }: { element: RectElement }) {
  return (
    <rect
      x={element.x}
      y={element.y}
      width={element.width ?? 0}
      height={element.height ?? 0}
      fill={element.fill}
      stroke={element.stroke ?? 'none'}
      strokeWidth={element.strokeWidth ?? 0}
      rx={element.rx ?? 0}
    />
  );
}

function TextShape({ element }: { element: TextElement }) {
  const fontSize = element.fontSize ?? 32;
  const lineHeight = fontSize * 1.25;
  const lines = element.content.split('\n');
  return (
    <text
      x={element.x}
      y={element.y}
      fill={element.color ?? '#000000'}
      fontSize={fontSize}
      fontFamily={element.fontFamily ?? 'sans-serif'}
      fontWeight={element.bold ? 'bold' : undefined}
      fontStyle={element.italic ? 'italic' : undefined}
      dominantBaseline="hanging"
    >
      {lines.map((line, i) => (
        <tspan key={i} x={element.x} dy={i === 0 ? 0 : lineHeight}>
          {preserveIndent(line)}
        </tspan>
      ))}
    </text>
  );
}

/** Keep indentation/blank lines visible inside SVG <text>. */
function preserveIndent(line: string): string {
  if (line === '') return ' ';
  const expanded = line.replace(/\t/g, '    ');
  const match = expanded.match(/^ +/);
  if (!match) return expanded;
  return '\u00a0'.repeat(match[0].length) + expanded.slice(match[0].length);
}

function getCodeMetrics(element: CodeElement) {
  const fontSize = element.fontSize ?? 16;
  const lineHeight = fontSize * 1.5;
  const padX = 14;
  const padTop = element.language ? 32 : 14;
  const padBottom = 14;
  const lines = element.content.split('\n');
  const maxLen = Math.max(1, ...lines.map(l => l.replace(/\t/g, '    ').length));
  const w = Math.max(220, maxLen * fontSize * 0.6 + padX * 2);
  const h = padTop + lines.length * lineHeight + padBottom;
  return { fontSize, lineHeight, padX, padTop, padBottom, lines, w, h };
}

function CodeShape({ element }: { element: CodeElement }) {
  const bg = element.background ?? '#1e1e1e';
  const fg = element.color ?? '#e6e6e6';
  const { fontSize, lineHeight, padX, padTop, lines, w, h } = getCodeMetrics(element);
  return (
    <g>
      <rect
        x={element.x}
        y={element.y}
        width={w}
        height={h}
        rx={8}
        fill={bg}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={1}
      />
      {element.language && (
        <text
          x={element.x + padX}
          y={element.y + 20}
          fill="#9a9a9a"
          fontSize={12}
          fontFamily="sans-serif"
          dominantBaseline="hanging"
        >
          {element.language}
        </text>
      )}
      <text
        x={element.x + padX}
        y={element.y + padTop}
        fill={fg}
        fontSize={fontSize}
        fontFamily="ui-monospace, Menlo, Consolas, monospace"
        dominantBaseline="hanging"
      >
        {lines.map((line, i) => (
          <tspan key={i} x={element.x + padX} dy={i === 0 ? 0 : lineHeight}>
            {preserveIndent(line === '' ? ' ' : line)}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function LatexShape({ element }: { element: LatexElement }) {
  return (
    <foreignObject x={element.x} y={element.y} width={600} height={80} pointerEvents="all">
      <div
        style={{ fontFamily: 'serif', fontStyle: 'italic', fontSize: '28px', color: '#000' }}
      >
        {element.content}
      </div>
    </foreignObject>
  );
}

function PenShape({ element }: { element: PenElement }) {
  if (element.points.length < 2) return null;
  const d = buildPath(element.points, element.smoothing);
  return (
    <path
      d={d}
      fill="none"
      stroke={element.color}
      strokeWidth={element.width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function buildPath(points: PenElement['points'], smooth: boolean): string {
  let d = `M${points[0].x},${points[0].y}`;
  if (smooth && points.length > 2) {
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      d += ` Q${points[i].x},${points[i].y} ${xc},${yc}`;
    }
    d += ` L${points[points.length - 1].x},${points[points.length - 1].y}`;
  } else {
    for (let i = 1; i < points.length; i++) {
      d += ` L${points[i].x},${points[i].y}`;
    }
  }
  return d;
}

function SelectionOutline({ element }: { element: SlideElement }) {
  const x = element.x;
  const y = element.y;
  let w = element.width ?? 200;
  let h = element.height ?? 60;

  if (element.type === 'text' || element.type === 'latex') {
    if (element.type === 'text') {
      const lines = element.content.split('\n').length;
      const fs = element.fontSize ?? 32;
      h = lines * fs * 1.25;
      w = 400;
    } else {
      h = 60;
      w = 400;
    }
  }

  if (element.type === 'code') {
    const m = getCodeMetrics(element);
    w = m.w;
    h = m.h;
  }

  if (element.type === 'pen') {
    const xs = element.points.map(p => p.x);
    const ys = element.points.map(p => p.y);
    w = Math.max(...xs) - Math.min(...xs);
    h = Math.max(...ys) - Math.min(...ys);
  }

  return (
    <rect
      x={x - 4}
      y={y - 4}
      width={w + 8}
      height={h + 8}
      fill="none"
      stroke="#0a7"
      strokeWidth={2}
      strokeDasharray="6 3"
      rx={4}
      pointerEvents="none"
    />
  );
}
