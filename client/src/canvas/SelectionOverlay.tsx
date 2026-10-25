import { useDocStore, useUiStore } from '../model/store';
import { resolveConnector } from '../geometry/connectors';
import { rotationTransform } from '../geometry/shapes';
import { PendingConnector, Rect } from './useInteraction';

interface SelectionOverlayProps {
  scale: number;
  marquee: Rect | null;
  pending: PendingConnector | null;
}

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;

function handlePositions(x: number, y: number, width: number, height: number) {
  const cx = x + width / 2;
  const cy = y + height / 2;
  return {
    nw: { x, y },
    n: { x: cx, y },
    ne: { x: x + width, y },
    e: { x: x + width, y: cy },
    se: { x: x + width, y: y + height },
    s: { x: cx, y: y + height },
    sw: { x, y: y + height },
    w: { x, y: cy },
  };
}

export function SelectionOverlay({ scale, marquee, pending }: SelectionOverlayProps) {
  const doc = useDocStore((state) => state.doc);
  const selectedIds = useUiStore((state) => state.selectedIds);
  const activeSlideIndex = useUiStore((state) => state.activeSlideIndex);
  const slide = doc.slides[activeSlideIndex];
  const elements = slide?.elements ?? [];
  const selected = elements.filter((el) => selectedIds.includes(el.id));
  const handleSize = 8 / Math.max(scale, 0.01);
  const line = 1.5 / Math.max(scale, 0.01);

  return (
    <g className="selection-overlay" pointerEvents="none">
      {selected.map((el) => {
        if (el.type === 'connector') {
          const resolved = resolveConnector(el, elements);
          return (
            <g key={el.id}>
              <rect
                x={resolved.bounds.x}
                y={resolved.bounds.y}
                width={Math.max(4, resolved.bounds.width)}
                height={Math.max(4, resolved.bounds.height)}
                fill="none"
                stroke="#0a7"
                strokeWidth={line}
                strokeDasharray={`${6 / scale} ${3 / scale}`}
                rx={4}
              />
              <circle
                data-handle="connector-from"
                data-element-id={el.id}
                cx={resolved.start.x}
                cy={resolved.start.y}
                r={6 / scale}
                fill="#ffffff"
                stroke="#0a7"
                strokeWidth={line}
                pointerEvents="all"
                style={{ cursor: 'crosshair' }}
              />
              <circle
                data-handle="connector-to"
                data-element-id={el.id}
                cx={resolved.end.x}
                cy={resolved.end.y}
                r={6 / scale}
                fill="#ffffff"
                stroke="#0a7"
                strokeWidth={line}
                pointerEvents="all"
                style={{ cursor: 'crosshair' }}
              />
            </g>
          );
        }

        const transform = rotationTransform(el) || undefined;
        return (
          <g key={el.id} transform={transform}>
            <rect
              x={el.x}
              y={el.y}
              width={Math.max(1, el.width)}
              height={Math.max(1, el.height)}
              fill="none"
              stroke="#0a7"
              strokeWidth={line}
              strokeDasharray={`${6 / scale} ${3 / scale}`}
              rx={2}
            />
            {selectedIds.length === 1 && !el.locked && (
              <>
                {HANDLES.map((handle) => {
                  const point = handlePositions(el.x, el.y, el.width, el.height)[handle];
                  return (
                    <rect
                      key={handle}
                      data-handle={handle}
                      data-element-id={el.id}
                      x={point.x - handleSize / 2}
                      y={point.y - handleSize / 2}
                      width={handleSize}
                      height={handleSize}
                      fill="#ffffff"
                      stroke="#0a7"
                      strokeWidth={line}
                      pointerEvents="all"
                      style={{ cursor: handle === 'n' || handle === 's' ? 'ns-resize' : handle === 'e' || handle === 'w' ? 'ew-resize' : 'nwse-resize' }}
                    />
                  );
                })}
                <line
                  x1={el.x + el.width / 2}
                  y1={el.y}
                  x2={el.x + el.width / 2}
                  y2={el.y - 26 / scale}
                  stroke="#0a7"
                  strokeWidth={line}
                />
                <circle
                  data-handle="rotate"
                  data-element-id={el.id}
                  cx={el.x + el.width / 2}
                  cy={el.y - 26 / scale}
                  r={handleSize * 0.7}
                  fill="#ffffff"
                  stroke="#0a7"
                  strokeWidth={line}
                  pointerEvents="all"
                  style={{ cursor: 'grab' }}
                />
              </>
            )}
          </g>
        );
      })}

      {marquee && (
        <rect
          x={marquee.x}
          y={marquee.y}
          width={marquee.width}
          height={marquee.height}
          fill="rgba(76,154,255,0.12)"
          stroke="#4c9aff"
          strokeWidth={line}
          strokeDasharray={`${5 / scale} ${3 / scale}`}
        />
      )}

      {pending && (
        <line
          x1={pending.x1}
          y1={pending.y1}
          x2={pending.x2}
          y2={pending.y2}
          stroke="#4c9aff"
          strokeWidth={2 / Math.max(scale, 0.01)}
          strokeDasharray={`${6 / scale} ${4 / scale}`}
        />
      )}
    </g>
  );
}
