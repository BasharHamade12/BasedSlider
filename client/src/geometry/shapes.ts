import { AnchorPort, ConnectorElement, Element, ShapeElement } from '../model/types';

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point2 {
  x: number;
  y: number;
}

export type GeometryElement = Exclude<Element, ConnectorElement>;

export function elementBounds(el: GeometryElement): Bounds {
  return { x: el.x, y: el.y, width: el.width, height: el.height };
}

export function centerOf(bounds: Bounds): Point2 {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

export function rotationTransform(el: GeometryElement): string {
  if (!el.rotation) return '';
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  return `rotate(${el.rotation} ${cx} ${cy})`;
}

/** Rotate a vector by `degrees`, matching the SVG `rotate()` transform. */
export function rotateVector(vector: Point2, degrees: number): Point2 {
  if (!degrees) return { ...vector };
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos,
  };
}

/**
 * Anchor point for a port, in slide coordinates. The port sits on the visual
 * edge, so the element's rotation is applied around its centre.
 */
export function portPoint(el: GeometryElement, port: Exclude<AnchorPort, 'auto'>): Point2 {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const local = (() => {
    switch (port) {
      case 'top':
        return { x: 0, y: -el.height / 2 };
      case 'bottom':
        return { x: 0, y: el.height / 2 };
      case 'left':
        return { x: -el.width / 2, y: 0 };
      case 'right':
        return { x: el.width / 2, y: 0 };
    }
  })();
  const offset = rotateVector(local, el.rotation);
  return { x: cx + offset.x, y: cy + offset.y };
}

export function portNormal(
  port: Exclude<AnchorPort, 'auto'>,
  rotation = 0,
): Point2 {
  const base = (() => {
    switch (port) {
      case 'top':
        return { x: 0, y: -1 };
      case 'bottom':
        return { x: 0, y: 1 };
      case 'left':
        return { x: -1, y: 0 };
      case 'right':
        return { x: 1, y: 0 };
    }
  })();
  return rotateVector(base, rotation);
}

/** Pick the port whose visual side faces the target, honouring rotation. */
export function choosePort(
  from: Bounds,
  toward: Point2,
  rotation = 0,
): Exclude<AnchorPort, 'auto'> {
  const center = centerOf(from);
  const local = rotateVector(
    { x: toward.x - center.x, y: toward.y - center.y },
    -rotation,
  );
  if (Math.abs(local.x) >= Math.abs(local.y)) return local.x >= 0 ? 'right' : 'left';
  return local.y >= 0 ? 'bottom' : 'top';
}

function polygonPoints(cx: number, cy: number, rx: number, ry: number, sides: number, rotation = -Math.PI / 2): Point2[] {
  const points: Point2[] = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = rotation + (i * Math.PI * 2) / sides;
    points.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry });
  }
  return points;
}

export function starPoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  spikes = 5,
  innerRatio = 0.42,
): Point2[] {
  const points: Point2[] = [];
  for (let i = 0; i < spikes * 2; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / spikes;
    const ratio = i % 2 === 0 ? 1 : innerRatio;
    points.push({ x: cx + Math.cos(angle) * rx * ratio, y: cy + Math.sin(angle) * ry * ratio });
  }
  return points;
}

/** Box arrow pointing right: rectangular shaft with a triangular head. */
function arrowPoints(x: number, y: number, w: number, h: number): Point2[] {
  const cy = y + h / 2;
  const shaft = h * 0.2;
  const notch = w * 0.62;
  return [
    { x, y: cy - shaft },
    { x: x + notch, y: cy - shaft },
    { x: x + notch, y },
    { x: x + w, y: cy },
    { x: x + notch, y: y + h },
    { x: x + notch, y: cy + shaft },
    { x, y: cy + shaft },
  ];
}

/** Chevron banner clipped to an arrow silhouette. */
function chevronPoints(x: number, y: number, w: number, h: number): Point2[] {
  const cy = y + h / 2;
  const notch = w * 0.7;
  const indent = w * 0.28;
  return [
    { x, y },
    { x: x + notch, y },
    { x: x + w, y: cy },
    { x: x + notch, y: y + h },
    { x, y: y + h },
    { x: x + indent, y: cy },
  ];
}

function parallelogramPoints(x: number, y: number, w: number, h: number): Point2[] {
  const skew = w * 0.24;
  return [
    { x: x + skew, y },
    { x: x + w, y },
    { x: x + w - skew, y: y + h },
    { x, y: y + h },
  ];
}

function trapezoidPoints(x: number, y: number, w: number, h: number): Point2[] {
  const inset = w * 0.2;
  return [
    { x: x + inset, y },
    { x: x + w - inset, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

/** Speech bubble: rounded body with a small triangular tail bottom-left. */
function speechPath(x: number, y: number, w: number, h: number): string {
  const body = h * 0.74;
  const r = Math.min(w, body) * 0.14;
  const tailStart = x + w * 0.16;
  const tailTip = x + w * 0.1;
  const tailEnd = x + w * 0.34;
  return [
    `M${x + r},${y}`,
    `L${x + w - r},${y}`,
    `Q${x + w},${y} ${x + w},${y + r}`,
    `L${x + w},${y + body - r}`,
    `Q${x + w},${y + body} ${x + w - r},${y + body}`,
    `L${tailEnd},${y + body}`,
    `L${tailTip},${y + h}`,
    `L${tailStart},${y + body}`,
    `L${x + r},${y + body}`,
    `Q${x},${y + body} ${x},${y + body - r}`,
    `L${x},${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    'Z',
  ].join(' ');
}

function toPath(points: Point2[], close: boolean): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M${first.x},${first.y} ${rest.map((p) => `L${p.x},${p.y}`).join(' ')}${close ? ' Z' : ''}`;
}

/** Path for shapes that are not a plain rect/ellipse. */
export function shapePath(el: ShapeElement): string {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  switch (el.type) {
    case 'triangle':
      return toPath(
        [
          { x: cx, y: el.y },
          { x: el.x + el.width, y: el.y + el.height },
          { x: el.x, y: el.y + el.height },
        ],
        true,
      );
    case 'line':
      return toPath(
        [
          { x: el.x, y: el.y },
          { x: el.x + el.width, y: el.y + el.height },
        ],
        false,
      );
    case 'polygon':
      return toPath(polygonPoints(cx, cy, el.width / 2, el.height / 2, 5), true);
    case 'star':
      return toPath(starPoints(cx, cy, el.width / 2, el.height / 2), true);
    case 'arrow':
      return toPath(arrowPoints(el.x, el.y, el.width, el.height), true);
    case 'chevron':
      return toPath(chevronPoints(el.x, el.y, el.width, el.height), true);
    case 'parallelogram':
      return toPath(parallelogramPoints(el.x, el.y, el.width, el.height), true);
    case 'trapezoid':
      return toPath(trapezoidPoints(el.x, el.y, el.width, el.height), true);
    case 'speech':
      return speechPath(el.x, el.y, el.width, el.height);
    default:
      return '';
  }
}

export function shapeKindLabel(kind: ShapeElement['type']): string {
  switch (kind) {
    case 'rect':
      return 'Rectangle';
    case 'ellipse':
      return 'Ellipse';
    case 'triangle':
      return 'Triangle';
    case 'line':
      return 'Line';
    case 'polygon':
      return 'Polygon';
    case 'star':
      return 'Star';
    case 'arrow':
      return 'Arrow';
    case 'chevron':
      return 'Chevron';
    case 'parallelogram':
      return 'Parallelogram';
    case 'trapezoid':
      return 'Trapezoid';
    case 'speech':
      return 'Speech bubble';
  }
}
