import {
  AnimationSpec,
  ArrowType,
  CodeElement,
  ConnectorElement,
  Doc,
  Element,
  ElementType,
  FigureElement,
  HtmlEmbedElement,
  ImageElement,
  LatexElement,
  PenElement,
  Point,
  Routing,
  Shadow,
  ShapeElement,
  ShapeKind,
  Slide,
  TextBlock,
  TextElement,
  DOC_VERSION,
  SLIDE_H,
  SLIDE_W,
} from './types';
import { maxId, nextConnectorId, nextElementId, nextAnimationId, nextSlideId } from './ids';

export const DEFAULT_TEXT_FAMILY = 'Inter, system-ui, sans-serif';
export const DEFAULT_MONO_FAMILY = 'ui-monospace, Menlo, Consolas, monospace';
export const DEFAULT_LATEX_COLOR = '#1a1b1e';

export function createTextBlock(overrides: Partial<TextBlock> = {}): TextBlock {
  return {
    content: '',
    fontFamily: DEFAULT_TEXT_FAMILY,
    fontSize: 32,
    fontWeight: 400,
    italic: false,
    underline: false,
    align: 'left',
    lineHeight: 1.25,
    letterSpacing: 0,
    color: '#1a1b1e',
    autofit: false,
    math: false,
    ...overrides,
  };
}

export function createAnimation(
  id: string,
  overrides: Partial<Omit<AnimationSpec, 'id'>> = {},
): AnimationSpec {
  return {
    id,
    effect: 'fadeIn',
    trigger: 'afterPrevious',
    duration: 500,
    delay: 0,
    easing: 'easeOut',
    direction: 'up',
    repeat: 1,
    ...overrides,
  };
}

export function createShadow(overrides: Partial<Shadow> = {}): Shadow {
  return { x: 0, y: 6, blur: 16, color: '#00000055', ...overrides };
}

export interface GeometryInit {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

function base(id: string, init: GeometryInit) {
  return {
    id,
    x: init.x,
    y: init.y,
    width: init.width ?? 320,
    height: init.height ?? 180,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    animations: [] as AnimationSpec[],
  };
}

export function createShape(
  kind: ShapeKind,
  id: string,
  init: GeometryInit,
  overrides: Partial<Omit<ShapeElement, 'id' | 'type'>> = {},
): ShapeElement {
  return {
    ...base(id, init),
    type: kind,
    fill: '#4c9aff',
    stroke: 'none',
    strokeWidth: 0,
    dash: 0,
    radius: kind === 'rect' ? 8 : 0,
    shadow: null,
    text: null,
    ...overrides,
  };
}

export function createText(
  id: string,
  init: GeometryInit,
  overrides: Partial<Omit<TextElement, 'id' | 'type' | 'text'>> = {},
  text: Partial<TextBlock> = {},
): TextElement {
  return {
    ...base(id, { width: 700, height: 120, ...init }),
    type: 'text',
    text: createTextBlock(text),
    ...overrides,
  };
}

export function createLatex(
  id: string,
  init: GeometryInit,
  overrides: Partial<Omit<LatexElement, 'id' | 'type'>> = {},
): LatexElement {
  return {
    ...base(id, { width: 640, height: 140, ...init }),
    type: 'latex',
    content: '\\sum_{i=1}^n i = \\frac{n(n+1)}{2}',
    displayMode: true,
    fontSize: 32,
    color: DEFAULT_LATEX_COLOR,
    ...overrides,
  };
}

export function createCode(
  id: string,
  init: GeometryInit,
  overrides: Partial<Omit<CodeElement, 'id' | 'type'>> = {},
): CodeElement {
  return {
    ...base(id, { width: 720, height: 260, ...init }),
    type: 'code',
    content: 'const hello = (name: string) => `Hello, ${name}`;',
    language: 'typescript',
    showLanguage: true,
    theme: 'dark',
    fontSize: 18,
    lineNumbers: true,
    color: '#e6e6e6',
    background: '#1e1e1e',
    ...overrides,
  };
}

export function createFigure(
  id: string,
  init: GeometryInit,
  overrides: Partial<Omit<FigureElement, 'id' | 'type'>> = {},
): FigureElement {
  return {
    ...base(id, { width: 560, height: 380, ...init }),
    type: 'figure',
    kind: 'graph',
    title: '',
    axisColor: '#1a1b1e',
    gridColor: '#d9dde3',
    accentColor: '#4c9aff',
    titleColor: '#1a1b1e',
    fn: 'quadratic',
    a: 1,
    b: 0,
    c: 0,
    domain: 5,
    values: [120, 200, 90, 260, 170, 230],
    ...overrides,
  };
}

export function createImage(
  id: string,
  init: GeometryInit,
  overrides: Partial<Omit<ImageElement, 'id' | 'type'>> = {},
): ImageElement {
  return {
    ...base(id, { width: 640, height: 360, ...init }),
    type: 'image',
    src: '',
    fit: 'contain',
    radius: 0,
    ...overrides,
  };
}

export function createHtmlEmbed(
  id: string,
  init: GeometryInit,
  overrides: Partial<Omit<HtmlEmbedElement, 'id' | 'type'>> = {},
): HtmlEmbedElement {
  return {
    ...base(id, { width: 720, height: 480, ...init }),
    type: 'html',
    src: '',
    content: '',
    radius: 8,
    reloadToken: 0,
    ...overrides,
  };
}

/**
 * Box for a newly added image: centred on the slide, scaled down (never up) so
 * it covers at most 70% of the slide while keeping its aspect ratio.
 */
export function imagePlacement(naturalWidth: number, naturalHeight: number): GeometryInit {
  const safeWidth = Number.isFinite(naturalWidth) && naturalWidth > 0 ? naturalWidth : 640;
  const safeHeight = Number.isFinite(naturalHeight) && naturalHeight > 0 ? naturalHeight : 360;
  const scale = Math.min((SLIDE_W * 0.7) / safeWidth, (SLIDE_H * 0.7) / safeHeight, 1);
  const width = Math.max(16, Math.round(safeWidth * scale));
  const height = Math.max(16, Math.round(safeHeight * scale));
  return {
    x: Math.round((SLIDE_W - width) / 2),
    y: Math.round((SLIDE_H - height) / 2),
    width,
    height,
  };
}

export function createPen(
  id: string,
  points: Point[],
  overrides: Partial<Omit<PenElement, 'id' | 'type' | 'points'>> = {},
): PenElement {
  const baseEl = base(id, { x: 0, y: 0, width: 0, height: 0 });
  const el: PenElement = {
    ...baseEl,
    type: 'pen',
    color: '#1a1b1e',
    strokeWidth: 3,
    smoothing: true,
    mode: 'pen',
    points,
    ...overrides,
  };
  return normalizePen(el);
}

/**
 * Resize a pen stroke by mapping its derived bounds onto a new box. The points
 * are scaled; `strokeWidth` is an independent property and is left alone.
 */
export function resizePen(
  el: PenElement,
  box: { x: number; y: number; width: number; height: number },
): PenElement {
  const scaleX = el.width > 0 ? box.width / el.width : 1;
  const scaleY = el.height > 0 ? box.height / el.height : 1;
  const points = el.points.map((point) => ({
    ...point,
    x: box.x + (point.x - el.x) * scaleX,
    y: box.y + (point.y - el.y) * scaleY,
  }));
  return normalizePen({ ...el, points });
}

/** Pen geometry is always derived from its points. */
export function normalizePen(el: PenElement): PenElement {
  // Decks saved before strokeWidth existed stored bounds in `width`; fall back
  // to a sane stroke instead of rendering an undefined or enormous line.
  const raw = (el as { strokeWidth?: unknown }).strokeWidth;
  const strokeWidth =
    typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 3;
  if (el.points.length === 0) {
    return { ...el, strokeWidth, x: 0, y: 0, width: 0, height: 0 };
  }
  const xs = el.points.map((p) => p.x);
  const ys = el.points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { ...el, strokeWidth, x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export interface ConnectorInit {
  from: ConnectorElement['from'];
  to: ConnectorElement['to'];
  routing?: Routing;
  startArrow?: ArrowType;
  endArrow?: ArrowType;
}

export function createConnector(
  id: string,
  init: ConnectorInit,
  overrides: Partial<Omit<ConnectorElement, 'id' | 'type' | 'from' | 'to'>> = {},
): ConnectorElement {
  return {
    id,
    type: 'connector',
    locked: false,
    hidden: false,
    animations: [],
    from: init.from,
    to: init.to,
    routing: init.routing ?? 'elbow',
    startArrow: init.startArrow ?? 'none',
    endArrow: init.endArrow ?? 'triangle',
    arrowSize: 14,
    width: 3,
    dash: 0,
    color: '#4c9aff',
    label: '',
    ...overrides,
  };
}

export function createElementOfType(
  type: ElementType,
  doc: Doc,
  x: number,
  y: number,
): Element {
  switch (type) {
    case 'rect':
    case 'ellipse':
    case 'triangle':
    case 'line':
    case 'polygon':
    case 'star':
    case 'arrow':
    case 'chevron':
    case 'parallelogram':
    case 'trapezoid':
    case 'speech':
      return createShape(type, nextElementId(doc), { x, y });
    case 'text':
      return createText(nextElementId(doc), { x, y }, {}, { content: 'Double-click to edit' });
    case 'latex':
      return createLatex(nextElementId(doc), { x, y });
    case 'code':
      return createCode(nextElementId(doc), { x, y });
    case 'image':
      return createImage(nextElementId(doc), { ...imagePlacement(640, 360), x, y });
    case 'html':
      return createHtmlEmbed(nextElementId(doc), { x, y });
    case 'figure':
      return createFigure(nextElementId(doc), { x, y });
    case 'pen':
      return createPen(nextElementId(doc), [
        { x, y, pressure: 0.5 },
        { x: x + 120, y: y + 40, pressure: 0.5 },
      ]);
    case 'connector':
      return createConnector(nextConnectorId(doc), {
        from: { kind: 'point', x, y },
        to: { kind: 'point', x: x + 240, y: y + 120 },
      });
  }
}

export function createTransition(overrides: Partial<Slide['transition']> = {}): Slide['transition'] {
  return { type: 'none', direction: 'right', duration: 400, easing: 'easeOut', ...overrides };
}

export function createSlide(
  id: string,
  name: string,
  overrides: Partial<Omit<Slide, 'id' | 'name'>> = {},
): Slide {
  return {
    id,
    name,
    background: '#ffffff',
    notes: '',
    transition: createTransition(),
    elements: [],
    ...overrides,
  };
}

export function createEmptyDoc(): Doc {
  const doc: Doc = {
    version: DOC_VERSION,
    title: 'Untitled deck',
    width: SLIDE_W,
    height: SLIDE_H,
    slides: [],
  };
  doc.slides.push(createSlide(nextSlideId(doc), 'Slide 1'));
  return doc;
}

export function createDocWithSlides(slides: Slide[], title = 'Untitled deck'): Doc {
  return {
    version: DOC_VERSION,
    title,
    width: SLIDE_W,
    height: SLIDE_H,
    slides,
  };
}

export interface DuplicateResult {
  elements: Element[];
  idMap: Map<string, string>;
}

/**
 * Clone elements with fresh ids. Animations get fresh ids too. Connector
 * endpoints are remapped to fresh ids when both ends are duplicated, and
 * otherwise keep pointing at the original element.
 */
export function duplicateElements(
  source: Element[],
  doc: Doc,
  offset = { x: 24, y: 24 },
): DuplicateResult {
  const idMap = new Map<string, string>();
  let elementCounter = maxId(doc, 'e');
  let connectorCounter = maxId(doc, 'c');
  let animationCounter = maxId(doc, 'a');

  for (const el of source) {
    if (el.type === 'connector') {
      connectorCounter += 1;
      idMap.set(el.id, `c${connectorCounter}`);
    } else {
      elementCounter += 1;
      idMap.set(el.id, `e${elementCounter}`);
    }
  }

  const elements: Element[] = [];
  for (const el of source) {
    const freshId = idMap.get(el.id);
    if (!freshId) continue;

    if (el.type === 'connector') {
      const copy = structuredClone(el);
      copy.id = freshId;
      copy.from =
        copy.from.kind === 'element'
          ? { ...copy.from, elementId: idMap.get(copy.from.elementId) ?? copy.from.elementId }
          : { ...copy.from, x: copy.from.x + offset.x, y: copy.from.y + offset.y };
      copy.to =
        copy.to.kind === 'element'
          ? { ...copy.to, elementId: idMap.get(copy.to.elementId) ?? copy.to.elementId }
          : { ...copy.to, x: copy.to.x + offset.x, y: copy.to.y + offset.y };
      copy.animations = copy.animations.map((a) => {
        animationCounter += 1;
        return { ...a, id: `a${animationCounter}` };
      });
      elements.push(copy);
      continue;
    }

    const copy = structuredClone(el) as Exclude<Element, ConnectorElement>;
    copy.id = freshId;
    copy.animations = copy.animations.map((a) => {
      animationCounter += 1;
      return { ...a, id: `a${animationCounter}` };
    });
    // A duplicated group keeps its internal wiring: member references on the
    // lead are remapped to the duplicated ids so the copy never points at the
    // original elements.
    if (copy.members) {
      copy.members = copy.members
        .map((memberId) => idMap.get(memberId) ?? memberId)
        .filter((memberId) => copy.id !== memberId && idMap.has(memberId));
      if (copy.members.length === 0) delete copy.members;
    }
    if (offset.x !== 0 || offset.y !== 0) {
      copy.x += offset.x;
      copy.y += offset.y;
    }
    if (copy.type === 'pen') {
      copy.points = copy.points.map((p) => ({ ...p, x: p.x + offset.x, y: p.y + offset.y }));
      elements.push(normalizePen(copy));
    } else {
      elements.push(copy);
    }
  }

  return { elements, idMap };
}

export function newAnimationFor(doc: Doc, effect: AnimationSpec['effect'] = 'fadeIn'): AnimationSpec {
  return createAnimation(nextAnimationId(doc), { effect });
}
