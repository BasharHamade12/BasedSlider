import { normalizePen } from './factories';
import {
  ANCHOR_PORTS,
  ANIMATION_EFFECTS,
  ARROW_TYPES,
  ConnectorElement,
  Diagnostic,
  Doc,
  EASINGS,
  IMAGE_FITS,
  ROUTINGS,
  TRANSITION_TYPES,
  Element,
  DIRECTIONS,
  FigureElement,
  FIGURE_FUNCTIONS,
  FIGURE_KINDS,
} from './types';

const COLOR_RE =
  /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|linear-gradient\([^)]*\)|none|transparent)$/;

const ID_RE = /^[a-z]+\d+$/;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function warn(message: string, elementId?: string, path?: string): Diagnostic {
  return { severity: 'warning', phase: 'validate', message: path ? `${path}: ${message}` : message, elementId };
}

function error(message: string, elementId?: string, path?: string): Diagnostic {
  return { severity: 'error', phase: 'validate', message: path ? `${path}: ${message}` : message, elementId };
}

function checkColor(value: string, diagnostics: Diagnostic[], elementId: string, path: string): void {
  if (typeof value !== 'string' || !COLOR_RE.test(value.trim())) {
    diagnostics.push(warn(`Unrecognized color "${value}"`, elementId, path));
  }
}

function checkElement(el: Element, diagnostics: Diagnostic[], seen: Map<string, string>): void {
  if (seen.has(el.id)) {
    diagnostics.push(error(`Duplicate element id "${el.id}"`, el.id));
  } else {
    seen.set(el.id, el.type);
  }
  if (!ID_RE.test(el.id)) {
    diagnostics.push(warn(`Element id "${el.id}" should look like e1, c2, …`, el.id));
  }
  if (el.type !== 'connector') {
    if (!isFiniteNumber(el.opacity) || el.opacity < 0 || el.opacity > 1) {
      diagnostics.push(warn('opacity should be between 0 and 1', el.id, 'opacity'));
    }
    if (!isFiniteNumber(el.rotation)) {
      diagnostics.push(error('rotation must be a number', el.id));
    }
    if (!isFiniteNumber(el.x) || !isFiniteNumber(el.y)) {
      diagnostics.push(error('x and y must be numbers', el.id));
    }
    if (!isFiniteNumber(el.width) || !isFiniteNumber(el.height)) {
      diagnostics.push(error('width and height must be numbers', el.id));
    } else if (el.width < 0 || el.height < 0) {
      diagnostics.push(error('width and height cannot be negative', el.id));
    }
  }

  const animationIds = new Set<string>();
  for (const anim of el.animations) {
    if (animationIds.has(anim.id)) {
      diagnostics.push(error(`Duplicate animation id "${anim.id}"`, el.id));
    }
    animationIds.add(anim.id);
    if (seen.has(anim.id)) {
      diagnostics.push(warn(`Animation id "${anim.id}" collides with another id`, el.id));
    }
    seen.set(anim.id, 'animation');
    if (!ANIMATION_EFFECTS.includes(anim.effect)) {
      diagnostics.push(warn(`Unknown animation effect "${anim.effect}"`, el.id));
    }
    if (!EASINGS.includes(anim.easing)) {
      diagnostics.push(warn(`Unknown easing "${anim.easing}"`, el.id));
    }
    if (!DIRECTIONS.includes(anim.direction)) {
      diagnostics.push(warn(`Unknown direction "${anim.direction}"`, el.id));
    }
    if (!isFiniteNumber(anim.duration) || anim.duration < 0) {
      diagnostics.push(warn('Animation duration must be a non-negative number', el.id));
    }
    if (!isFiniteNumber(anim.delay) || anim.delay < 0) {
      diagnostics.push(warn('Animation delay must be a non-negative number', el.id));
    }
  }

  if (el.type === 'connector') {
    if (!ROUTINGS.includes(el.routing)) {
      diagnostics.push(warn(`Unknown routing "${el.routing}"`, el.id));
    }
    if (!ARROW_TYPES.includes(el.startArrow)) {
      diagnostics.push(warn(`Unknown arrow "${el.startArrow}"`, el.id));
    }
    if (!ARROW_TYPES.includes(el.endArrow)) {
      diagnostics.push(warn(`Unknown arrow "${el.endArrow}"`, el.id));
    }
    for (const [path, anchor] of [
      ['from', el.from],
      ['to', el.to],
    ] as const) {
      if (anchor.kind === 'element') {
        if (!ANCHOR_PORTS.includes(anchor.port)) {
          diagnostics.push(warn(`Unknown anchor port "${anchor.port}"`, el.id, path));
        }
        if (anchor.elementId === el.id) {
          diagnostics.push(
            warn(`Connector "${el.id}" points at itself`, el.id, path),
          );
        }
      } else if (!isFiniteNumber(anchor.x) || !isFiniteNumber(anchor.y)) {
        diagnostics.push(error('Connector point must have numeric x and y', el.id, path));
      }
    }
    if (!isFiniteNumber(el.width) || el.width <= 0) {
      diagnostics.push(warn('Connector width should be positive', el.id));
    }
    return;
  }

  if (el.type === 'pen') {
    if (!Array.isArray(el.points) || el.points.length < 2) {
      diagnostics.push(warn('Pen stroke needs at least two points', el.id));
    }
    if (!isFiniteNumber(el.strokeWidth) || el.strokeWidth <= 0) {
      diagnostics.push(warn('Pen stroke width should be positive', el.id));
    }
    for (const point of el.points) {
      if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y)) {
        diagnostics.push(error('Pen point coordinates must be numbers', el.id));
        break;
      }
    }
    checkColor(el.color, diagnostics, el.id, 'color');
    return;
  }

  if (el.type === 'image') {
    if (typeof el.src !== 'string') {
      diagnostics.push(error('Image source must be a string', el.id, 'src'));
    } else if (el.src.trim() === '') {
      diagnostics.push(warn('Image has no source yet', el.id, 'src'));
    }
    if (!IMAGE_FITS.includes(el.fit)) {
      diagnostics.push(warn(`Unknown image fit "${el.fit}"`, el.id, 'fit'));
    }
    if (!isFiniteNumber(el.radius) || el.radius < 0) {
      diagnostics.push(warn('Image radius must be a non-negative number', el.id, 'radius'));
    }
    return;
  }

  if (el.type === 'html') {
    if (el.src && el.content) {
      diagnostics.push(warn('HTML embed has both src and content; content is rendered', el.id, 'src'));
    }
    if (!el.src && !el.content) {
      diagnostics.push(warn('HTML embed has no source yet and renders a placeholder', el.id, 'src'));
    }
    if (!isFiniteNumber(el.radius) || el.radius < 0) {
      diagnostics.push(warn('HTML embed radius must be a non-negative number', el.id, 'radius'));
    }
    return;
  }

  if (el.type === 'figure') {
    const figure = el as FigureElement;
    if (!FIGURE_KINDS.includes(figure.kind)) {
      diagnostics.push(warn(`Unknown figure kind "${figure.kind}"`, el.id, 'kind'));
    }
    if (!FIGURE_FUNCTIONS.includes(figure.fn)) {
      diagnostics.push(warn(`Unknown figure function "${figure.fn}"`, el.id, 'fn'));
    }
    if (!Array.isArray(figure.values)) {
      diagnostics.push(warn('Figure bar values must be a list of numbers', el.id, 'values'));
    } else {
      for (const value of figure.values) {
        if (!isFiniteNumber(value)) {
          diagnostics.push(warn('Figure bar values must be numbers', el.id, 'values'));
          break;
        }
      }
    }
    checkColor(figure.axisColor, diagnostics, el.id, 'axisColor');
    checkColor(figure.gridColor, diagnostics, el.id, 'gridColor');
    checkColor(figure.accentColor, diagnostics, el.id, 'accentColor');
    checkColor(figure.titleColor, diagnostics, el.id, 'titleColor');
    return;
  }

  if (el.type === 'latex' || el.type === 'code' || el.type === 'text') {
    if (el.type === 'latex') {
      if (typeof el.content !== 'string') {
        diagnostics.push(error('LaTeX content must be a string', el.id, 'content'));
      }
    }
    if (el.type === 'code') {
      if (!isFiniteNumber(el.fontSize) || el.fontSize <= 0) {
        diagnostics.push(warn('Code font size must be positive', el.id, 'fontSize'));
      }
      checkColor(el.color, diagnostics, el.id, 'color');
      checkColor(el.background, diagnostics, el.id, 'background');
    }
    if (el.type === 'text') {
      if (typeof el.text.content !== 'string') {
        diagnostics.push(error('Text content must be a string', el.id, 'content'));
      }
    }
    return;
  }

  // Shapes
  checkColor(el.fill, diagnostics, el.id, 'fill');
  if (el.stroke !== 'none') checkColor(el.stroke, diagnostics, el.id, 'stroke');
  if (el.text) {
    checkColor(el.text.color, diagnostics, el.id, 'text.color');
    if (!isFiniteNumber(el.text.fontSize) || el.text.fontSize <= 0) {
      diagnostics.push(warn('Text font size must be positive', el.id));
    }
  }
}

export function validateDoc(doc: Doc): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (!Array.isArray(doc.slides) || doc.slides.length === 0) {
    diagnostics.push(error('A deck needs at least one slide', undefined, 'slides'));
    return diagnostics;
  }

  const slideIds = new Set<string>();
  const elementIds = new Map<string, string>();
  const animationIds = new Map<string, string>();

  for (const slide of doc.slides) {
    if (slideIds.has(slide.id)) {
      diagnostics.push(error(`Duplicate slide id "${slide.id}"`, undefined, 'slides'));
    }
    slideIds.add(slide.id);
    if (typeof slide.name !== 'string') {
      diagnostics.push(error('Slide name must be a string', undefined, slide.id));
    }
    if (!TRANSITION_TYPES.includes(slide.transition.type)) {
      diagnostics.push(warn(`Unknown transition "${slide.transition.type}"`, undefined, slide.id));
    }
    if (!DIRECTIONS.includes(slide.transition.direction)) {
      diagnostics.push(warn(`Unknown transition direction`, undefined, slide.id));
    }
    // Per-slide canvas size: both axes together or neither, positive numbers.
    if ((slide.width === undefined) !== (slide.height === undefined)) {
      diagnostics.push(error('A slide size override needs both width and height', undefined, slide.id));
    }
    for (const [key, value] of [['width', slide.width], ['height', slide.height]] as const) {
      if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 320)) {
        diagnostics.push(error(`Slide ${key} must be a number of at least 320`, undefined, slide.id));
      }
    }

    for (const el of slide.elements) {
      checkElement(el, diagnostics, elementIds);
      for (const anim of el.animations) {
        if (animationIds.has(anim.id)) {
          diagnostics.push(error(`Duplicate animation id "${anim.id}"`, el.id));
        }
        animationIds.set(anim.id, el.id);
      }
    }
  }

  // Group consistency, checked after every element id is known.
  for (const slide of doc.slides) {
    const slideIds = new Set(slide.elements.map((el) => el.id));
    for (const el of slide.elements) {
      if (!el.members) continue;
      if (el.members.length === 0) {
        diagnostics.push(warn('Empty members list; omit it instead', el.id, 'members'));
        continue;
      }
      if (el.members.includes(el.id)) {
        diagnostics.push(warn('A group lead must not list itself', el.id, 'members'));
      }
      for (const memberId of el.members) {
        if (!slideIds.has(memberId)) {
          diagnostics.push(error(`Group member "${memberId}" does not exist on this slide`, el.id, 'members'));
        }
      }
    }
  }

  // Connector references, checked after every element id is known.
  for (const slide of doc.slides) {
    for (const el of slide.elements) {
      if (el.type !== 'connector') continue;
      for (const [path, anchor] of [
        ['from', el.from],
        ['to', el.to],
      ] as const) {
        if (anchor.kind === 'element' && !elementIds.has(anchor.elementId)) {
          diagnostics.push(error(`Connector "${el.id}" points at missing element "${anchor.elementId}"`, el.id, path));
        }
      }
    }
  }

  return diagnostics;
}

/**
 * Repairs recoverable problems so the GUI can always render:
 * - pen bounds are recomputed from points
 * - connector refs to missing elements become free points
 * Returns the repaired document plus warnings describing what changed.
 */
export function normalizeDoc(doc: Doc): { doc: Doc; diagnostics: Diagnostic[] } {
  const next = structuredClone(doc);
  const diagnostics: Diagnostic[] = [];
  const elementIds = new Set<string>();
  for (const slide of next.slides) {
    for (const el of slide.elements) elementIds.add(el.id);
  }

  for (const slide of next.slides) {
    slide.elements = slide.elements.map((el) => {
      if (el.type === 'pen') return normalizePen(el);
      if (el.type !== 'connector') return el;
      const repair = (anchor: ConnectorElement['from']): ConnectorElement['from'] => {
        if (anchor.kind !== 'element' || elementIds.has(anchor.elementId)) return anchor;
        diagnostics.push(
          warn(
            `Connector "${el.id}" target "${anchor.elementId}" is missing; using a free point`,
            el.id,
          ),
        );
        return { kind: 'point' as const, x: 0, y: 0 };
      };
      return { ...el, from: repair(el.from), to: repair(el.to) };
    });
  }

  return { doc: next, diagnostics };
}

export function docEquals(a: Doc, b: Doc): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function hasErrors(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === 'error');
}
