import { Fragment, RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { HtmlEmbedElement, SLIDE_H, SLIDE_W } from '../model/types';
import { useDocStore, useUiStore } from '../model/store';

/**
 * Live HTML embeds cannot live inside the SVG (iframe-in-foreignObject has
 * cross-browser hit-testing and layout bugs), so each embed is mirrored by a
 * positioned <iframe> in an HTML layer that shares the stage transform. The
 * layer root ignores pointer events; the frames and selection chrome opt in:
 *
 * - frames are interactive whenever no canvas gesture and no placement tool is
 *   active (every parent-document pointerdown briefly suppresses them — events
 *   from inside a frame never reach this document, so any pointerdown we see
 *   belongs to the canvas),
 * - locked/hidden embeds are never interactive.
 *
 * Because the SVG selection overlay sits *below* this layer, a selected embed
 * draws its border + handles here and owns its own move/resize/rotate logic
 * (a scoped copy of canvas/useInteraction.ts's single-element gestures).
 */

interface HtmlEmbedLayerProps {
  svgRef: RefObject<SVGSVGElement | null>;
  scale: number;
}

type EmbedGesture =
  | { kind: 'move'; id: string; start: { x: number; y: number }; applied: { x: number; y: number } }
  | { kind: 'resize'; id: string; handle: string; start: { x: number; y: number }; initial: { x: number; y: number; width: number; height: number } }
  | { kind: 'rotate'; id: string; center: { x: number; y: number }; startAngle: number; initialRotation: number };

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;

const HANDLE_CURSOR: Record<string, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  nw: 'nwse-resize',
  ne: 'nesw-resize',
  se: 'nwse-resize',
  sw: 'nesw-resize',
};

/** Sandbox design per plan: inline content is opaque-origin; remote URLs keep
 * their own origin but still get no navigation/top-level powers. */
function sandboxFor(element: HtmlEmbedElement): string {
  if (element.content.trim() !== '') return 'allow-scripts';
  return 'allow-scripts allow-same-origin allow-forms allow-popups';
}

export function HtmlEmbedLayer({ svgRef, scale }: HtmlEmbedLayerProps) {
  const doc = useDocStore((state) => state.doc);
  const activeSlideIndex = useUiStore((state) => state.activeSlideIndex);
  const selectedIds = useUiStore((state) => state.selectedIds);
  const tool = useUiStore((state) => state.tool);
  const [gestureActive, setGestureActive] = useState(false);
  const gestureRef = useRef<EmbedGesture | null>(null);

  const slide = doc.slides[activeSlideIndex];
  const embeds = (slide?.elements ?? []).filter(
    (el): el is HtmlEmbedElement => el.type === 'html' && !el.hidden,
  );

  // Any parent-document pointerdown means a canvas gesture may be starting
  // (pressing a marquee, panning, moving another element): the frames stand
  // down until its pointerup so the gesture is never eaten by a frame.
  useEffect(() => {
    const down = () => setGestureActive(true);
    const up = () => setGestureActive(false);
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
    };
  }, []);

  const slidePoint = useCallback(
    (event: { clientX: number; clientY: number }) => {
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

  // ─── chrome gestures (scoped, single-embed equivalents of canvas gestures) ───

  const beginGesture = useCallback(
    (event: React.PointerEvent, element: HtmlEmbedElement, kind: EmbedGesture['kind'], handle: string) => {
      event.preventDefault();
      event.stopPropagation();
      const point = slidePoint(event);
      useDocStore.getState().beginTransaction();
      if (kind === 'move') {
        gestureRef.current = { kind, id: element.id, start: point, applied: { x: 0, y: 0 } };
      } else if (kind === 'resize') {
        gestureRef.current = {
          kind,
          id: element.id,
          handle,
          start: point,
          initial: { x: element.x, y: element.y, width: element.width, height: element.height },
        };
      } else {
        const center = { x: element.x + element.width / 2, y: element.y + element.height / 2 };
        gestureRef.current = {
          kind,
          id: element.id,
          center,
          startAngle: Math.atan2(point.y - center.y, point.x - center.x),
          initialRotation: element.rotation,
        };
      }
      setGestureActive(true);
    },
    [slidePoint],
  );

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture) return;
      const point = slidePoint(event);

      if (gesture.kind === 'move') {
        const dx = point.x - gesture.start.x - gesture.applied.x;
        const dy = point.y - gesture.start.y - gesture.applied.y;
        if (dx !== 0 || dy !== 0) {
          useDocStore.getState().moveElements([gesture.id], dx, dy);
          gesture.applied = { x: point.x - gesture.start.x, y: point.y - gesture.start.y };
        }
        return;
      }

      if (gesture.kind === 'resize') {
        const initial = gesture.initial;
        let { x, y, width, height } = initial;
        const dx = point.x - gesture.start.x;
        const dy = point.y - gesture.start.y;
        const handle = gesture.handle;

        if (handle.includes('e')) width = initial.width + dx;
        if (handle.includes('w')) {
          x = initial.x + dx;
          width = initial.width - dx;
        }
        if (handle.includes('s')) height = initial.height + dy;
        if (handle.includes('n')) {
          y = initial.y + dy;
          height = initial.height - dy;
        }
        if (width < 8) {
          if (handle.includes('w')) x = initial.x + initial.width - 8;
          width = 8;
        }
        if (height < 8) {
          if (handle.includes('n')) y = initial.y + initial.height - 8;
          height = 8;
        }
        if (event.shiftKey && handle.length === 2) {
          const ratio = initial.width / Math.max(1, initial.height);
          height = width / ratio;
          if (handle.includes('n')) y = initial.y + initial.height - height;
        }
        useDocStore.getState().updateElement(gesture.id, { x, y, width, height });
        return;
      }

      const angle = Math.atan2(point.y - gesture.center.y, point.x - gesture.center.x);
      let rotation = gesture.initialRotation + ((angle - gesture.startAngle) * 180) / Math.PI;
      if (event.shiftKey) rotation = Math.round(rotation / 15) * 15;
      useDocStore.getState().updateElement(gesture.id, { rotation });
    };

    const up = () => {
      const gesture = gestureRef.current;
      if (!gesture) return;
      gestureRef.current = null;
      useDocStore.getState().commitTransaction('Edit');
    };

    const cancel = () => {
      if (!gestureRef.current) return;
      gestureRef.current = null;
      useDocStore.getState().cancelTransaction();
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [slidePoint]);

  useEffect(
    () => () => {
      if (gestureRef.current) {
        gestureRef.current = null;
        useDocStore.getState().cancelTransaction();
      }
    },
    [],
  );

  if (embeds.length === 0) return null;
  const framesSuppressed = gestureActive || tool !== 'select';
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;

  return (
    <div className="html-embed-layer" style={{ width: SLIDE_W * scale, height: SLIDE_H * scale }}>
      {embeds.map((element) => {
        const wrapperStyle = {
          left: element.x * scale,
          top: element.y * scale,
          width: Math.max(0, element.width * scale),
          height: Math.max(0, element.height * scale),
          borderRadius: element.radius > 0 ? element.radius * scale : undefined,
          pointerEvents: element.locked || framesSuppressed ? undefined : ('auto' as const),
        };
        const selected = element.id === selectedId && !element.locked;
        return (
          <Fragment key={`${element.id}:${element.reloadToken}`}>
            <div className="html-embed-frame" style={wrapperStyle}>
              <iframe
                className="html-embed-frame-inner"
                title={`HTML embed ${element.id}`}
                srcDoc={element.content.trim() !== '' ? element.content : undefined}
                src={element.content.trim() !== '' || element.src.trim() === '' ? undefined : element.src}
                sandbox={sandboxFor(element)}
                referrerPolicy="no-referrer"
                style={{
                  width: Math.max(1, element.width),
                  height: Math.max(1, element.height),
                  transform: `scale(${scale})`,
                  pointerEvents: element.locked || framesSuppressed ? ('none' as const) : undefined,
                }}
              />
            </div>
            {selected && (
              <div className="html-embed-chrome">
                {/* Visible border (below the rim, no pointer events). */}
                <div
                  className="html-embed-selection-border"
                  style={{ borderRadius: element.radius > 0 ? element.radius * scale : undefined }}
                />
                {/* Border rim: four thin bands around the live frame so the
                    body stays interactive while the rim drags to move. */}
                {(['top', 'bottom', 'left', 'right'] as const).map((edge) => (
                  <div
                    key={edge}
                    className={`html-embed-rim-band html-embed-rim-${edge}`}
                    style={rimBandStyle(element, scale, edge)}
                    title={`Move ${element.id}`}
                    onPointerDown={(event) => beginGesture(event, element, 'move', '')}
                  />
                ))}
                {HANDLES.map((handle) => {
                  const position = handlePositions(element, handle);
                  return (
                    <div
                      key={handle}
                      data-html-handle={handle}
                      className="html-embed-handle"
                      style={{
                        left: (position.x - HANDLE / (2 * scale)) * scale,
                        top: (position.y - HANDLE / (2 * scale)) * scale,
                        width: HANDLE / scale,
                        height: HANDLE / scale,
                        cursor: HANDLE_CURSOR[handle],
                      }}
                      onPointerDown={(event) => beginGesture(event, element, 'resize', handle)}
                    />
                  );
                })}
                <div
                  className="html-embed-handle html-embed-rotate"
                  style={{
                    left: (element.x + element.width / 2 - HANDLE / (2 * scale) * 0.7) * scale,
                    top: (element.y - 26 / scale - HANDLE / (2 * scale) * 0.7) * scale,
                    width: (HANDLE / scale) * 0.7,
                    height: (HANDLE / scale) * 0.7,
                    cursor: 'grab',
                  }}
                  onPointerDown={(event) => beginGesture(event, element, 'rotate', '')}
                />
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

const RIM_BAND = 6; // screen px grip on the selection border
/** Handle size in slide units, matching the SVG selection overlay. */
const HANDLE = 10;

/** Absolute-position style for one rim band (in screen px, unscaled container). */
function rimBandStyle(element: HtmlEmbedElement, scale: number, edge: 'top' | 'bottom' | 'left' | 'right') {
  const width = Math.max(0, element.width * scale);
  const height = Math.max(0, element.height * scale);
  switch (edge) {
    case 'top':
      return { left: 0, top: 0, width, height: RIM_BAND };
    case 'bottom':
      return { left: 0, top: height - RIM_BAND, width, height: RIM_BAND };
    case 'left':
      return { left: 0, top: 0, width: RIM_BAND, height };
    case 'right':
      return { left: width - RIM_BAND, top: 0, width: RIM_BAND, height };
  }
}

function handlePositions(element: HtmlEmbedElement, handle: (typeof HANDLES)[number]) {
  const x = element.x;
  const y = element.y;
  const cx = x + element.width / 2;
  const cy = y + element.height / 2;
  switch (handle) {
    case 'nw': return { x, y };
    case 'n': return { x: cx, y };
    case 'ne': return { x: x + element.width, y };
    case 'e': return { x: x + element.width, y: cy };
    case 'se': return { x: x + element.width, y: y + element.height };
    case 's': return { x: cx, y: y + element.height };
    case 'sw': return { x, y: y + element.height };
    case 'w': return { x, y: cy };
  }
}
