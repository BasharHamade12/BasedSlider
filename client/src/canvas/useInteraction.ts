import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import {
  Element as SlideElement,
  ElementType,
  SLIDE_H,
  SLIDE_W,
  isShape,
} from '../model/types';
import { createConnector, createElementOfType } from '../model/factories';
import { nextConnectorId } from '../model/ids';
import { resolveConnector } from '../geometry/connectors';
import { elementBounds } from '../geometry/shapes';
import { useDocStore, useUiStore } from '../model/store';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PendingConnector {
  fromId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Point2 {
  x: number;
  y: number;
}

type Gesture =
  | { mode: 'idle' }
  | {
      mode: 'move';
      ids: string[];
      start: Point2;
      bounds: Rect;
      applied: Point2;
      snapX: number[];
      snapY: number[];
    }
  | {
      mode: 'resize';
      id: string;
      handle: string;
      start: Point2;
      initial: Rect;
    }
  | {
      mode: 'rotate';
      id: string;
      center: Point2;
      startAngle: number;
      initialRotation: number;
    }
  | { mode: 'marquee'; start: Point2; additive: boolean; base: string[] }
  | { mode: 'connect'; fromId: string; start: Point2 }
  | { mode: 'reattach'; connectorId: string; which: 'from' | 'to' }
  | { mode: 'pan'; startClient: Point2; startPan: Point2 }
  | {
      mode: 'pinch';
      startDist: number;
      startMid: Point2;
      startZoom: number;
      startPan: Point2;
      center: Point2;
    };

function boundsOf(el: SlideElement): Rect | null {
  if (el.type === 'connector') return null;
  return elementBounds(el);
}

function unionBounds(ids: string[], elements: SlideElement[]): Rect | null {
  const rects = elements
    .filter((el) => ids.includes(el.id))
    .map(boundsOf)
    .filter((rect): rect is Rect => rect !== null);
  if (rects.length === 0) return null;
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function bestSnap(
  edges: number[],
  targets: number[],
  threshold: number,
): { delta: number; target?: number } {
  let best = { delta: 0, target: undefined as number | undefined };
  let bestAbs = threshold;
  for (const edge of edges) {
    for (const target of targets) {
      const delta = target - edge;
      if (Math.abs(delta) <= bestAbs) {
        bestAbs = Math.abs(delta);
        best = { delta, target };
      }
    }
  }
  return best;
}

function selectionTargets(elements: SlideElement[], selected: string[]): { x: number[]; y: number[] } {
  const x: number[] = [0, SLIDE_W / 2, SLIDE_W];
  const y: number[] = [0, SLIDE_H / 2, SLIDE_H];
  for (const el of elements) {
    if (selected.includes(el.id)) continue;
    const rect = boundsOf(el);
    if (!rect) continue;
    x.push(rect.x, rect.x + rect.width / 2, rect.x + rect.width);
    y.push(rect.y, rect.y + rect.height / 2, rect.y + rect.height);
  }
  return { x, y };
}

function intersects(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

/**
 * setPointerCapture throws NotFoundError when the pointer is already gone
 * (a released touch) or synthetic. An exception there would abort the whole
 * pointerdown handler mid-gesture, so swallow it — same as startResize does.
 */
function capturePointer(svg: SVGSVGElement, pointerId: number): void {
  try {
    svg.setPointerCapture(pointerId);
  } catch {
    /* no active pointer id to capture */
  }
}

export function useInteraction(svgRef: RefObject<SVGSVGElement | null>, scale: number) {
  const gestureRef = useRef<Gesture>({ mode: 'idle' });
  /** Active touch pointers on the canvas, for two-finger pinch zoom/pan. */
  const pointersRef = useRef(new Map<number, Point2>());
  const spaceRef = useRef(false);
  const lastClickRef = useRef({ id: '', x: 0, y: 0, time: 0 });
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [pending, setPending] = useState<PendingConnector | null>(null);

  const slidePoint = useCallback(
    (event: { clientX: number; clientY: number }): Point2 => {
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

  const startTextEditing = useCallback((id: string) => {
    const doc = useDocStore.getState().doc;
    const slide = doc.slides[useUiStore.getState().activeSlideIndex];
    const el = slide?.elements.find((candidate) => candidate.id === id);
    if (!el) return;

    if (el.type === 'code') {
      useUiStore.getState().setEditing({ elementId: id, target: 'code' });
      return;
    }
    if (el.type === 'text') {
      useUiStore.getState().setEditing({ elementId: id, target: 'text' });
      return;
    }
    if (isShape(el) && !el.locked) {
      if (!el.text) {
        useDocStore.getState().updateText(id, { content: '' }, 'label');
      }
      useUiStore.getState().setEditing({ elementId: id, target: 'label' });
    }
  }, []);

  useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return !!el?.closest?.('input, textarea, [contenteditable], .monaco-editor');
    };

    const keydown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isTyping(event.target)) {
        spaceRef.current = true;
        if (event.target === document.body) event.preventDefault();
      }
      if (event.key === 'Escape' && gestureRef.current.mode !== 'idle') {
        useDocStore.getState().cancelTransaction();
        gestureRef.current = { mode: 'idle' };
        pointersRef.current.clear();
        setMarquee(null);
        setPending(null);
        useUiStore.getState().setGuides({ v: [], h: [] });
      }
    };
    const keyup = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceRef.current = false;
    };

    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
    };
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      // A press anywhere on the canvas dismisses the inline text editor and
      // commits its pending content: the preventDefault calls in the gesture
      // branches below suppress the native blur that would normally do this.
      useUiStore.getState().commitEditing?.();
      const ui = useUiStore.getState();
      const doc = useDocStore.getState().doc;
      const slide = doc.slides[ui.activeSlideIndex];
      const point = slidePoint(event);

      // Multi-touch: the second finger turns any in-progress drag into a
      // pinch gesture (zoom + two-finger pan around the fingers). Touches are
      // ignored while the pen/highlighter is armed so a stray finger never
      // breaks a stroke. Mice and single touches fall through unchanged.
      if (
        event.pointerType === 'touch' &&
        ui.tool !== 'pen' &&
        ui.tool !== 'highlighter'
      ) {
        pointersRef.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
        if (pointersRef.current.size === 2) {
          const active = gestureRef.current;
          if (
            active.mode === 'move' ||
            active.mode === 'resize' ||
            active.mode === 'rotate'
          ) {
            // Keep whatever partial edit the first finger already applied.
            useDocStore.getState().commitTransaction('Edit');
            useUiStore.getState().setGuides({ v: [], h: [] });
          }
          setMarquee(null);
          setPending(null);
          const pts = [...pointersRef.current.values()];
          const rect = svg.getBoundingClientRect();
          gestureRef.current = {
            mode: 'pinch',
            startDist: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
            startMid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
            startZoom: ui.zoom,
            startPan: { ...ui.pan },
            // Content scales about the stage centre, which sits at the svg's
            // centre minus the current pan.
            center: {
              x: rect.left + rect.width / 2 - ui.pan.x,
              y: rect.top + rect.height / 2 - ui.pan.y,
            },
          };
          capturePointer(svg, event.pointerId);
          event.preventDefault();
          return;
        }
      }

      if (event.button === 1 || spaceRef.current) {
        useUiStore.getState().setContextMenu(null);
        gestureRef.current = {
          mode: 'pan',
          startClient: { x: event.clientX, y: event.clientY },
          startPan: { ...ui.pan },
        };
        capturePointer(svg, event.pointerId);
        event.preventDefault();
        return;
      }

      if (event.button !== 0) return;
      if (ui.tool === 'pen' || ui.tool === 'highlighter') return;
      if (!slide) return;

      const target = event.target as globalThis.Element;
      const handleEl = target.closest?.('[data-handle]') as HTMLElement | null;

      if (handleEl) {
        const handle = handleEl.dataset.handle ?? '';
        const id = handleEl.dataset.elementId ?? ui.selectedIds[0];
        const el = slide.elements.find((candidate) => candidate.id === id);
        if (handle === 'connector-from' || handle === 'connector-to') {
          if (!el || el.type !== 'connector') return;
          const resolved = resolveConnector(el, slide.elements);
          const other = handle === 'connector-from' ? resolved.end : resolved.start;
          useDocStore.getState().beginTransaction();
          gestureRef.current = {
            mode: 'reattach',
            connectorId: el.id,
            which: handle === 'connector-from' ? 'from' : 'to',
          };
          setPending({ fromId: el.id, x1: other.x, y1: other.y, x2: point.x, y2: point.y });
          capturePointer(svg, event.pointerId);
          event.preventDefault();
          return;
        }
        if (!el || el.type === 'connector') return;

        useDocStore.getState().beginTransaction();
        if (handle === 'rotate') {
          const center = { x: el.x + el.width / 2, y: el.y + el.height / 2 };
          gestureRef.current = {
            mode: 'rotate',
            id,
            center,
            startAngle: Math.atan2(point.y - center.y, point.x - center.x),
            initialRotation: el.rotation,
          };
        } else {
          gestureRef.current = {
            mode: 'resize',
            id,
            handle,
            start: point,
            initial: { x: el.x, y: el.y, width: el.width, height: el.height },
          };
        }
        capturePointer(svg, event.pointerId);
        event.preventDefault();
        return;
      }

      const hitEl = target.closest?.('[data-element-id]') as HTMLElement | null;

      if (ui.tool === 'connector') {
        if (!hitEl) return;
        const id = hitEl.dataset.elementId ?? '';
        const el = slide.elements.find((candidate) => candidate.id === id);
        if (!el || el.type === 'connector') return;
        gestureRef.current = { mode: 'connect', fromId: id, start: point };
        setPending({ fromId: id, x1: point.x, y1: point.y, x2: point.x, y2: point.y });
        capturePointer(svg, event.pointerId);
        event.preventDefault();
        return;
      }

      if (ui.tool !== 'select') {
        const created = createElementOfType(ui.tool as ElementType, doc, point.x, point.y);
        useDocStore.getState().addElement(created);
        if (created.type === 'text') {
          useUiStore.getState().setEditing({ elementId: created.id, target: 'text' });
        }
        return;
      }

      if (hitEl) {
        const id = hitEl.dataset.elementId ?? '';
        const el = slide.elements.find((candidate) => candidate.id === id);
        if (!el || el.locked) return;

        // Pointerdown calls preventDefault for drag gestures, which suppresses
        // the native dblclick event. Detect a double press here instead.
        const now = performance.now();
        const last = lastClickRef.current;
        // Fingers land sloppier than a mouse pointer: widen the double-press
        // radius (in slide units) so double-tap-to-edit works on touch.
        const slop = event.pointerType === 'touch' ? 24 / Math.max(scale, 0.01) : 8;
        const isDouble =
          last.id === id &&
          now - last.time < 400 &&
          Math.hypot(point.x - last.x, point.y - last.y) < slop;
        lastClickRef.current = { id, x: point.x, y: point.y, time: now };
        if (isDouble) {
          startTextEditing(id);
          event.preventDefault();
          return;
        }

        let ids: string[];
        if (event.shiftKey) {
          useUiStore.getState().toggleSelection(id);
          ids = useUiStore.getState().selectedIds;
        } else if (useUiStore.getState().selectedIds.includes(id)) {
          ids = useUiStore.getState().selectedIds;
        } else {
          useUiStore.getState().setSelection([id]);
          ids = [id];
        }

        const expanded = new Set(ids);
        for (const selectedId of ids) {
          const selected = slide.elements.find((candidate) => candidate.id === selectedId);
          if (selected?.group) {
            for (const member of slide.elements) {
              if (member.group === selected.group) expanded.add(member.id);
            }
          }
        }
        const allIds = [...expanded];
        const bounds = unionBounds(allIds, slide.elements);
        if (!bounds) return;

        const targets = selectionTargets(slide.elements, allIds);
        useDocStore.getState().beginTransaction();
        gestureRef.current = {
          mode: 'move',
          ids: allIds,
          start: point,
          bounds,
          applied: { x: 0, y: 0 },
          snapX: targets.x,
          snapY: targets.y,
        };
        capturePointer(svg, event.pointerId);
        event.preventDefault();
        return;
      }

      if (!event.shiftKey) useUiStore.getState().clearSelection();
      gestureRef.current = {
        mode: 'marquee',
        start: point,
        additive: event.shiftKey,
        base: useUiStore.getState().selectedIds,
      };
      setMarquee({ x: point.x, y: point.y, width: 0, height: 0 });          capturePointer(svg, event.pointerId);
    },
    [slidePoint, startTextEditing, svgRef],
  );

  /** Zoom + pan two fingers apart/together, keeping content under them. */
  const updatePinch = useCallback((gesture: Extract<Gesture, { mode: 'pinch' }>) => {
    const pts = [...pointersRef.current.values()];
    if (pts.length < 2 || gesture.startDist < 1) return;
    const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    const zoom = Math.max(
      0.1,
      Math.min(4, (gesture.startZoom * dist) / gesture.startDist),
    );
    const ratio = zoom / gesture.startZoom;
    const ui = useUiStore.getState();
    ui.setZoom(zoom);
    ui.setPan({
      x:
        mid.x -
        gesture.center.x -
        (gesture.startMid.x - gesture.center.x - gesture.startPan.x) * ratio,
      y:
        mid.y -
        gesture.center.y -
        (gesture.startMid.y - gesture.center.y - gesture.startPan.y) * ratio,
    });
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const gesture = gestureRef.current;
      if (pointersRef.current.has(event.pointerId)) {
        pointersRef.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
      }
      if (gesture.mode === 'pinch') {
        updatePinch(gesture);
        return;
      }
      if (gesture.mode === 'idle') return;
      const point = slidePoint(event);

      if (gesture.mode === 'pan') {
        useUiStore.getState().setPan({
          x: gesture.startPan.x + (event.clientX - gesture.startClient.x),
          y: gesture.startPan.y + (event.clientY - gesture.startClient.y),
        });
        return;
      }

      if (gesture.mode === 'move') {
        let dx = point.x - gesture.start.x;
        let dy = point.y - gesture.start.y;
        const guides: { v: number[]; h: number[] } = { v: [], h: [] };
        const ui = useUiStore.getState();

        if (ui.snapEnabled) {
          const threshold = 6 / Math.max(scale, 0.01);
          const snapX = bestSnap(
            [gesture.bounds.x + dx, gesture.bounds.x + gesture.bounds.width / 2 + dx, gesture.bounds.x + gesture.bounds.width + dx],
            gesture.snapX,
            threshold,
          );
          if (snapX.target !== undefined) {
            dx += snapX.delta;
            guides.v.push(snapX.target);
          }
          const snapY = bestSnap(
            [gesture.bounds.y + dy, gesture.bounds.y + gesture.bounds.height / 2 + dy, gesture.bounds.y + gesture.bounds.height + dy],
            gesture.snapY,
            threshold,
          );
          if (snapY.target !== undefined) {
            dy += snapY.delta;
            guides.h.push(snapY.target);
          }
        }

        if (ui.gridEnabled) {
          const gridX = Math.round((gesture.bounds.x + dx) / 8) * 8;
          const gridY = Math.round((gesture.bounds.y + dy) / 8) * 8;
          dx += gridX - (gesture.bounds.x + dx);
          dy += gridY - (gesture.bounds.y + dy);
        }

        useUiStore.getState().setGuides(guides);
        const deltaX = dx - gesture.applied.x;
        const deltaY = dy - gesture.applied.y;
        if (deltaX !== 0 || deltaY !== 0) {
          useDocStore.getState().moveElements(gesture.ids, deltaX, deltaY);
          gesture.applied = { x: dx, y: dy };
        }
        return;
      }

      if (gesture.mode === 'resize') {
        let { x, y, width, height } = gesture.initial;
        const dx = point.x - gesture.start.x;
        const dy = point.y - gesture.start.y;
        const handle = gesture.handle;

        if (handle.includes('e')) width = gesture.initial.width + dx;
        if (handle.includes('w')) {
          x = gesture.initial.x + dx;
          width = gesture.initial.width - dx;
        }
        if (handle.includes('s')) height = gesture.initial.height + dy;
        if (handle.includes('n')) {
          y = gesture.initial.y + dy;
          height = gesture.initial.height - dy;
        }

        const min = 8;
        if (width < min) {
          if (handle.includes('w')) x = gesture.initial.x + gesture.initial.width - min;
          width = min;
        }
        if (height < min) {
          if (handle.includes('n')) y = gesture.initial.y + gesture.initial.height - min;
          height = min;
        }

        if (event.shiftKey && handle.length === 2) {
          const ratio = gesture.initial.width / Math.max(1, gesture.initial.height);
          height = width / ratio;
          if (handle.includes('n')) y = gesture.initial.y + gesture.initial.height - height;
        }

        useDocStore.getState().updateElement(gesture.id, { x, y, width, height });
        return;
      }

      if (gesture.mode === 'rotate') {
        const angle = Math.atan2(point.y - gesture.center.y, point.x - gesture.center.x);
        let rotation =
          gesture.initialRotation + ((angle - gesture.startAngle) * 180) / Math.PI;
        if (event.shiftKey) rotation = Math.round(rotation / 15) * 15;
        useDocStore.getState().updateElement(gesture.id, { rotation });
        return;
      }

      if (gesture.mode === 'marquee') {
        setMarquee({
          x: Math.min(gesture.start.x, point.x),
          y: Math.min(gesture.start.y, point.y),
          width: Math.abs(point.x - gesture.start.x),
          height: Math.abs(point.y - gesture.start.y),
        });
        return;
      }

      if (gesture.mode === 'connect') {
        setPending({
          fromId: gesture.fromId,
          x1: gesture.start.x,
          y1: gesture.start.y,
          x2: point.x,
          y2: point.y,
        });
        return;
      }

      if (gesture.mode === 'reattach') {
        const doc = useDocStore.getState().doc;
        const slide = doc.slides[useUiStore.getState().activeSlideIndex];
        const connector = slide?.elements.find((el) => el.id === gesture.connectorId);
        if (connector && connector.type === 'connector') {
          const resolved = resolveConnector(connector, slide.elements);
          const other = gesture.which === 'from' ? resolved.end : resolved.start;
          setPending({
            fromId: gesture.connectorId,
            x1: other.x,
            y1: other.y,
            x2: point.x,
            y2: point.y,
          });
        }
      }
    },
    [scale, slidePoint, updatePinch],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const gesture = gestureRef.current;
      const svg = svgRef.current;
      const ui = useUiStore.getState();

      pointersRef.current.delete(event.pointerId);
      if (gesture.mode === 'pinch') {
        // A finger lifted: stop zooming so the remaining finger does not
        // suddenly start dragging whatever is under it.
        if (pointersRef.current.size < 2) gestureRef.current = { mode: 'idle' };
        if (svg?.hasPointerCapture(event.pointerId)) {
          svg.releasePointerCapture(event.pointerId);
        }
        return;
      }

      if (gesture.mode === 'move' || gesture.mode === 'resize' || gesture.mode === 'rotate') {
        useDocStore.getState().commitTransaction('Edit');
        useUiStore.getState().setGuides({ v: [], h: [] });
      }

      if (gesture.mode === 'marquee') {
        const rect = marquee;
        if (rect) {
          const doc = useDocStore.getState().doc;
          const slide = doc.slides[ui.activeSlideIndex];
          const elements = slide?.elements ?? [];
          const hit: string[] = [];
          for (const el of elements) {
            if (el.locked) continue;
            if (el.type === 'connector') {
              const bounds = resolveConnector(el, elements).bounds;
              if (intersects(rect, bounds)) hit.push(el.id);
            } else {
              if (intersects(rect, elementBounds(el))) hit.push(el.id);
            }
          }
          let next = gesture.additive ? [...new Set([...gesture.base, ...hit])] : hit;
          // Groups behave as one object: a marquee that touches any member
          // selects the whole group, matching click behaviour.
          const expanded = new Set<string>();
          for (const id of next) {
            expanded.add(id);
            const el = elements.find((candidate) => candidate.id === id);
            if (el?.group) {
              for (const member of elements) {
                if (member.group === el.group) expanded.add(member.id);
              }
            }
          }
          next = [...expanded];
          useUiStore.getState().setSelection(next);
        }
        setMarquee(null);
      }

      if (gesture.mode === 'connect' || gesture.mode === 'reattach') {
        const point = slidePoint(event);
        let targetId: string | null = null;
        if (typeof document.elementsFromPoint === 'function') {
          const nodes = document.elementsFromPoint(event.clientX, event.clientY);
          for (const node of nodes) {
            const candidate = (node as globalThis.Element).closest?.('[data-element-id]');
            const id = candidate?.getAttribute('data-element-id');
            if (id) {
              targetId = id;
              break;
            }
          }
        }

        const doc = useDocStore.getState().doc;
        const slide = doc.slides[ui.activeSlideIndex];
        const selfId = gesture.mode === 'connect' ? gesture.fromId : gesture.connectorId;
        if (targetId === selfId) targetId = null;
        if (targetId) {
          const target = slide?.elements.find((el) => el.id === targetId);
          if (!target || target.type === 'connector') targetId = null;
        }

        const anchor = targetId
          ? { kind: 'element' as const, elementId: targetId, port: 'auto' as const }
          : { kind: 'point' as const, x: point.x, y: point.y };

        if (gesture.mode === 'connect') {
          const connector = createConnector(nextConnectorId(doc), {
            from: { kind: 'element', elementId: gesture.fromId, port: 'auto' },
            to: anchor,
          });
          useDocStore.getState().addElement(connector);
          useUiStore.getState().setSelection([connector.id]);
        } else {
          useDocStore.getState().updateConnectorEndpoint(
            gesture.connectorId,
            gesture.which,
            anchor,
          );
          useDocStore.getState().commitTransaction('Reconnect');
        }
        setPending(null);
      }

      gestureRef.current = { mode: 'idle' };
      if (svg?.hasPointerCapture(event.pointerId)) {
        svg.releasePointerCapture(event.pointerId);
      }
    },
    [marquee, slidePoint, svgRef],
  );

  const onPointerCancel = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      pointersRef.current.delete(event.pointerId);
      if (gestureRef.current.mode === 'pinch') {
        if (pointersRef.current.size < 2) gestureRef.current = { mode: 'idle' };
        return;
      }
      if (gestureRef.current.mode !== 'idle') {
        useDocStore.getState().cancelTransaction();
        gestureRef.current = { mode: 'idle' };
        setMarquee(null);
        setPending(null);
        useUiStore.getState().setGuides({ v: [], h: [] });
      }
    },
    [],
  );

  const onDoubleClick = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      const target = event.target as globalThis.Element;
      const hit = target.closest?.('[data-element-id]') as HTMLElement | null;
      // Pointer capture can retarget dblclick to the svg itself; fall back to
      // the element selected by the first click of the double click.
      const id = hit?.dataset.elementId ?? useUiStore.getState().selectedIds[0] ?? '';
      if (id) startTextEditing(id);
    },
    [startTextEditing],
  );

  return {
    marquee,
    pending,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onDoubleClick,
  };
}
