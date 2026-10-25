import { AnchorRef, ArrowType, ConnectorElement, Element } from '../model/types';
import {
  Bounds,
  GeometryElement,
  Point2,
  centerOf,
  choosePort,
  elementBounds,
  portNormal,
  portPoint,
} from './shapes';

export interface ArrowShape {
  d: string;
  filled: boolean;
}

export interface ResolvedConnector {
  start: Point2;
  end: Point2;
  path: string;
  startAngle: number;
  endAngle: number;
  midpoint: Point2;
  bounds: Bounds;
  startArrow: ArrowShape | null;
  endArrow: ArrowShape | null;
}

export function add(a: Point2, b: Point2): Point2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Point2, b: Point2): Point2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Point2, factor: number): Point2 {
  return { x: a.x * factor, y: a.y * factor };
}

export function length(a: Point2): number {
  return Math.hypot(a.x, a.y);
}

export function unit(a: Point2): Point2 {
  const len = length(a);
  return len === 0 ? { x: 1, y: 0 } : { x: a.x / len, y: a.y / len };
}

export function perpendicular(a: Point2): Point2 {
  return { x: -a.y, y: a.x };
}

function isGeometryElement(el: Element | undefined): el is GeometryElement {
  return !!el && el.type !== 'connector';
}

function rawPoint(anchor: AnchorRef, elements: Element[]): Point2 {
  if (anchor.kind === 'point') return { x: anchor.x, y: anchor.y };
  const el = elements.find((candidate) => candidate.id === anchor.elementId);
  if (!isGeometryElement(el)) return { x: 0, y: 0 };
  return centerOf(elementBounds(el));
}

interface ResolvedAnchor {
  point: Point2;
  normal: Point2;
}

export function resolveAnchor(
  anchor: AnchorRef,
  elements: Element[],
  toward: Point2,
): ResolvedAnchor {
  if (anchor.kind === 'point') {
    const direction = unit(sub(toward, anchor));
    return { point: { x: anchor.x, y: anchor.y }, normal: direction };
  }

  const el = elements.find((candidate) => candidate.id === anchor.elementId);
  if (!isGeometryElement(el)) {
    return { point: { x: 0, y: 0 }, normal: unit(sub(toward, { x: 0, y: 0 })) };
  }

  const bounds = elementBounds(el);
  const port = anchor.port === 'auto' ? choosePort(bounds, toward, el.rotation) : anchor.port;
  return { point: portPoint(el, port), normal: portNormal(port, el.rotation) };
}

function cubicAt(p0: Point2, p1: Point2, p2: Point2, p3: Point2, t: number): Point2 {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
  };
}

export function arrowPath(
  type: ArrowType,
  tip: Point2,
  angle: number,
  size: number,
): ArrowShape | null {
  if (type === 'none') return null;
  const direction = { x: Math.cos(angle), y: Math.sin(angle) };
  const normal = perpendicular(direction);
  const base = sub(tip, scale(direction, size));
  const half = scale(normal, size * 0.45);

  switch (type) {
    case 'triangle':
      return {
        d: `M${tip.x},${tip.y} L${base.x + half.x},${base.y + half.y} L${base.x - half.x},${base.y - half.y} Z`,
        filled: true,
      };
    case 'open':
      return {
        d: `M${base.x + half.x},${base.y + half.y} L${tip.x},${tip.y} L${base.x - half.x},${base.y - half.y}`,
        filled: false,
      };
    case 'diamond': {
      const back = sub(tip, scale(direction, size * 1.7));
      const mid = sub(tip, scale(direction, size * 0.85));
      return {
        d: `M${tip.x},${tip.y} L${mid.x + half.x},${mid.y + half.y} L${back.x},${back.y} L${mid.x - half.x},${mid.y - half.y} Z`,
        filled: true,
      };
    }
    case 'circle': {
      const c = sub(tip, scale(direction, size * 0.7));
      const r = size * 0.55;
      return {
        d: `M${c.x - r},${c.y} A${r},${r} 0 1 0 ${c.x + r},${c.y} A${r},${r} 0 1 0 ${c.x - r},${c.y} Z`,
        filled: true,
      };
    }
    case 'bar': {
      const p = scale(normal, size * 0.6);
      return {
        d: `M${tip.x + p.x},${tip.y + p.y} L${tip.x - p.x},${tip.y - p.y}`,
        filled: false,
      };
    }
    default:
      return null;
  }
}

function shorten(point: Point2, angle: number, amount: number): Point2 {
  return {
    x: point.x + Math.cos(angle) * amount,
    y: point.y + Math.sin(angle) * amount,
  };
}

function boundsOfPoints(points: Point2[], pad: number): Bounds {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const maxX = Math.max(...xs) + pad;
  const maxY = Math.max(...ys) + pad;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function resolveConnector(connector: ConnectorElement, elements: Element[]): ResolvedConnector {
  const fromRaw = rawPoint(connector.from, elements);
  const toRaw = rawPoint(connector.to, elements);
  const from = resolveAnchor(connector.from, elements, toRaw);
  const to = resolveAnchor(connector.to, elements, fromRaw);

  const start = from.point;
  const end = to.point;
  const stub = Math.max(24, connector.arrowSize * 2);
  let path = '';
  let startAngle = Math.atan2(end.y - start.y, end.x - start.x);
  let endAngle = startAngle;
  let midpoint: Point2 = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  if (connector.routing === 'straight') {
    path = `M${start.x},${start.y} L${end.x},${end.y}`;
  } else if (connector.routing === 'elbow') {
    const s1 = add(start, scale(from.normal, stub));
    const e1 = add(end, scale(to.normal, stub));
    const horizontalStart = Math.abs(from.normal.y) < 0.5;
    const corner = horizontalStart ? { x: e1.x, y: s1.y } : { x: s1.x, y: e1.y };
    const points: Point2[] = [start, s1, corner, e1, end].filter((point, index, all) => {
      if (index === 0) return true;
      const previous = all[index - 1];
      return Math.abs(point.x - previous.x) > 0.01 || Math.abs(point.y - previous.y) > 0.01;
    });
    path = `M${points.map((p) => `${p.x},${p.y}`).join(' L')}`;
    startAngle = Math.atan2(s1.y - start.y, s1.x - start.x);
    endAngle = Math.atan2(end.y - e1.y, end.x - e1.x);
    midpoint = { x: (s1.x + e1.x) / 2, y: (s1.y + e1.y) / 2 };
  } else {
    const distance = length(sub(end, start));
    const k = Math.max(40, distance / 3);
    const c1 = add(start, scale(from.normal, k));
    const c2 = add(end, scale(to.normal, k));
    path = `M${start.x},${start.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${end.x},${end.y}`;
    startAngle = Math.atan2(c1.y - start.y, c1.x - start.x);
    endAngle = Math.atan2(end.y - c2.y, end.x - c2.x);
    midpoint = cubicAt(start, c1, c2, end, 0.5);
  }

  const startArrow = arrowPath(connector.startArrow, start, startAngle + Math.PI, connector.arrowSize);
  const endArrow = arrowPath(connector.endArrow, end, endAngle, connector.arrowSize);
  const startTrim = startArrow?.filled ? connector.arrowSize * 0.9 : 0;
  const endTrim = endArrow?.filled ? connector.arrowSize * 0.9 : 0;

  if (startTrim > 0 || endTrim > 0) {
    if (connector.routing === 'straight') {
      const drawStart = shorten(start, startAngle, startTrim);
      const drawEnd = shorten(end, endAngle + Math.PI, endTrim);
      path = `M${drawStart.x},${drawStart.y} L${drawEnd.x},${drawEnd.y}`;
    } else if (connector.routing === 'curved') {
      // Rebuild the curve with trimmed endpoints approximating the tangents.
      const drawStart = shorten(start, startAngle, startTrim);
      const drawEnd = shorten(end, endAngle + Math.PI, endTrim);
      const distance = length(sub(drawEnd, drawStart));
      const k = Math.max(40, distance / 3);
      const c1 = add(drawStart, scale(from.normal, k));
      const c2 = add(drawEnd, scale(to.normal, k));
      path = `M${drawStart.x},${drawStart.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${drawEnd.x},${drawEnd.y}`;
    }
  }

  return {
    start,
    end,
    path,
    startAngle,
    endAngle,
    midpoint,
    bounds: boundsOfPoints([start, end, midpoint], connector.arrowSize),
    startArrow,
    endArrow,
  };
}

export function connectorBounds(connector: ConnectorElement, elements: Element[]): Bounds {
  return resolveConnector(connector, elements).bounds;
}
