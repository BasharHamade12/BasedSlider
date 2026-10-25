import { createHtmlEmbed, createTextBlock, DEFAULT_LATEX_COLOR } from './factories';
import {
  AnchorRef,
  CodeElement,
  ConnectorElement,
  Doc,
  Element,
  FigureElement,
  HtmlEmbedElement,
  ImageElement,
  LatexElement,
  PenElement,
  ShapeElement,
  Slide,
  TextBlock,
  TextElement,
} from './types';

/* ─── primitives ─── */

export function quote(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
}

export function num(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Object.is(value, -0)) return '0';
  const rounded = Math.round(value * 10000) / 10000;
  return String(rounded);
}

function indentOf(depth: number): string {
  return '    '.repeat(depth);
}

function prop(depth: number, key: string, value: string | number | boolean): string {
  const formatted = typeof value === 'string' ? quote(value) : String(value);
  return `${indentOf(depth)}${key}: ${formatted};`;
}

function rawProp(depth: number, key: string, raw: string): string {
  return `${indentOf(depth)}${key}: ${raw};`;
}

/* ─── text ─── */

const TEXT_DEFAULTS = createTextBlock();

function textLines(block: TextBlock, depth: number, alwaysContent = true): string[] {
  const lines: string[] = [];
  if (alwaysContent || block.content !== '') lines.push(prop(depth, 'content', block.content));
  if (block.fontFamily !== TEXT_DEFAULTS.fontFamily) lines.push(prop(depth, 'fontFamily', block.fontFamily));
  if (block.fontSize !== TEXT_DEFAULTS.fontSize) lines.push(prop(depth, 'fontSize', block.fontSize));
  if (block.fontWeight !== TEXT_DEFAULTS.fontWeight) lines.push(prop(depth, 'fontWeight', block.fontWeight));
  if (block.italic) lines.push(prop(depth, 'italic', true));
  if (block.underline) lines.push(prop(depth, 'underline', true));
  if (block.align !== TEXT_DEFAULTS.align) lines.push(prop(depth, 'align', block.align));
  if (block.lineHeight !== TEXT_DEFAULTS.lineHeight) lines.push(prop(depth, 'lineHeight', block.lineHeight));
  if (block.letterSpacing !== TEXT_DEFAULTS.letterSpacing) {
    lines.push(prop(depth, 'letterSpacing', block.letterSpacing));
  }
  if (block.color !== TEXT_DEFAULTS.color) lines.push(prop(depth, 'color', block.color));
  if (block.autofit) lines.push(prop(depth, 'autofit', true));
  if (block.math) lines.push(prop(depth, 'math', true));
  return lines;
}

/* ─── base ─── */

function baseLines(el: Element, depth: number): string[] {
  const lines: string[] = [];
  if (el.name) lines.push(prop(depth, 'name', el.name));
  if (el.group) {
    lines.push(prop(depth, 'group', el.group));
    // Only the group lead carries the member list; members repeat just the tag.
    if (el.members && el.members.length > 0) {
      lines.push(`${indentOf(depth)}members: [ ${el.members.map(quote).join(', ')} ];`);
    }
  }
  if (el.locked) lines.push(prop(depth, 'locked', true));
  if (el.hidden) lines.push(prop(depth, 'hidden', true));
  return lines;
}

function geometryLines(el: Exclude<Element, ConnectorElement>, depth: number): string[] {
  return [
    prop(depth, 'x', el.x),
    prop(depth, 'y', el.y),
    prop(depth, 'width', el.width),
    prop(depth, 'height', el.height),
    ...(el.rotation !== 0 ? [prop(depth, 'rotation', el.rotation)] : []),
    ...(el.opacity !== 1 ? [prop(depth, 'opacity', el.opacity)] : []),
  ];
}

/* ─── elements ─── */

function animationLines(el: Element, depth: number): string[] {
  const lines: string[] = [];
  for (const anim of el.animations) {
    lines.push(`${indentOf(depth)}animate {`);
    lines.push(prop(depth + 1, 'id', anim.id));
    lines.push(prop(depth + 1, 'effect', anim.effect));
    lines.push(prop(depth + 1, 'trigger', anim.trigger));
    lines.push(prop(depth + 1, 'duration', anim.duration));
    lines.push(prop(depth + 1, 'delay', anim.delay));
    lines.push(prop(depth + 1, 'easing', anim.easing));
    lines.push(prop(depth + 1, 'direction', anim.direction));
    lines.push(prop(depth + 1, 'repeat', anim.repeat));
    lines.push(`${indentOf(depth)}}`);
  }
  return lines;
}

function shadowLines(el: ShapeElement, depth: number): string[] {
  if (!el.shadow) return [];
  return [
    `${indentOf(depth)}shadow {`,
    prop(depth + 1, 'x', el.shadow.x),
    prop(depth + 1, 'y', el.shadow.y),
    prop(depth + 1, 'blur', el.shadow.blur),
    prop(depth + 1, 'color', el.shadow.color),
    `${indentOf(depth)}}`,
  ];
}

function serializeShape(el: ShapeElement, depth: number): string[] {
  const lines: string[] = [`${indentOf(depth)}${el.type} ${quote(el.id)} {`];
  const body = depth + 1;
  lines.push(...geometryLines(el, body), ...baseLines(el, body));
  lines.push(prop(body, 'fill', el.fill));
  if (el.stroke !== 'none') lines.push(prop(body, 'stroke', el.stroke));
  if (el.strokeWidth !== 0) lines.push(prop(body, 'strokeWidth', el.strokeWidth));
  if (el.dash !== 0) lines.push(prop(body, 'dash', el.dash));
  if (el.type === 'rect' || el.radius !== 0) lines.push(prop(body, 'radius', el.radius));
  lines.push(...shadowLines(el, body));
  if (el.text) {
    lines.push(`${indentOf(body)}text {`);
    lines.push(...textLines(el.text, body + 1));
    lines.push(`${indentOf(body)}}`);
  }
  lines.push(...animationLines(el, body));
  lines.push(`${indentOf(depth)}}`);
  return lines;
}

function serializeText(el: TextElement, depth: number): string[] {
  const lines: string[] = [`${indentOf(depth)}text ${quote(el.id)} {`];
  const body = depth + 1;
  lines.push(...geometryLines(el, body), ...baseLines(el, body));
  lines.push(...textLines(el.text, body));
  lines.push(...animationLines(el, body));
  lines.push(`${indentOf(depth)}}`);
  return lines;
}

function serializeLatex(el: LatexElement, depth: number): string[] {
  const lines: string[] = [`${indentOf(depth)}latex ${quote(el.id)} {`];
  const body = depth + 1;
  lines.push(...geometryLines(el, body), ...baseLines(el, body));
  lines.push(prop(body, 'content', el.content));
  if (!el.displayMode) lines.push(prop(body, 'displayMode', false));
  if (el.fontSize !== 32) lines.push(prop(body, 'fontSize', el.fontSize));
  if (el.color !== DEFAULT_LATEX_COLOR) lines.push(prop(body, 'color', el.color));
  lines.push(...animationLines(el, body));
  lines.push(`${indentOf(depth)}}`);
  return lines;
}

function serializeCode(el: CodeElement, depth: number): string[] {
  const lines: string[] = [`${indentOf(depth)}code ${quote(el.id)} {`];
  const body = depth + 1;
  lines.push(...geometryLines(el, body), ...baseLines(el, body));
  lines.push(prop(body, 'content', el.content));
  if (el.language !== 'typescript') lines.push(prop(body, 'language', el.language));
  if (el.theme !== 'dark') lines.push(prop(body, 'theme', el.theme));
  if (el.fontSize !== 18) lines.push(prop(body, 'fontSize', el.fontSize));
  if (!el.lineNumbers) lines.push(prop(body, 'lineNumbers', false));
  if (el.color !== '#e6e6e6') lines.push(prop(body, 'color', el.color));
  if (el.background !== '#1e1e1e') lines.push(prop(body, 'background', el.background));
  lines.push(...animationLines(el, body));
  lines.push(`${indentOf(depth)}}`);
  return lines;
}

function serializePointList(el: PenElement, body: number): string[] {
  const lines: string[] = [`${indentOf(body)}points: [`];
  for (const point of el.points) {
    const extra =
      (point.tiltX !== undefined ? ` tiltX: ${num(point.tiltX)};` : '') +
      (point.tiltY !== undefined ? ` tiltY: ${num(point.tiltY)};` : '');
    lines.push(
      `${indentOf(body + 1)}{ x: ${num(point.x)}; y: ${num(point.y)}; pressure: ${num(point.pressure)};${extra} },`,
    );
  }
  lines.push(`${indentOf(body)}];`);
  return lines;
}

const HTML_EMBED_DEFAULTS = createHtmlEmbed('e0', { x: 0, y: 0, width: 720, height: 480 });

function serializeHtml(el: HtmlEmbedElement, depth: number): string[] {
  const lines: string[] = [`${indentOf(depth)}html ${quote(el.id)} {`];
  const body = depth + 1;
  lines.push(...geometryLines(el, body), ...baseLines(el, body));
  // Content wins over src by validation convention; src is only serialized
  // when there is no content so edits round-trip back to the same element.
  if (el.content !== '') lines.push(prop(body, 'content', el.content));
  else if (el.src !== '') lines.push(prop(body, 'src', el.src));
  else lines.push(prop(body, 'src', ''));
  if (el.radius !== HTML_EMBED_DEFAULTS.radius) lines.push(prop(body, 'radius', el.radius));
  lines.push(...animationLines(el, body));
  lines.push(`${indentOf(depth)}}`);
  return lines;
}

function serializeImage(el: ImageElement, depth: number): string[] {
  const lines: string[] = [`${indentOf(depth)}image ${quote(el.id)} {`];
  const body = depth + 1;
  lines.push(...geometryLines(el, body), ...baseLines(el, body));
  lines.push(prop(body, 'src', el.src));
  if (el.fit !== 'contain') lines.push(prop(body, 'fit', el.fit));
  if (el.radius !== 0) lines.push(prop(body, 'radius', el.radius));
  lines.push(...animationLines(el, body));
  lines.push(`${indentOf(depth)}}`);
  return lines;
}

function serializeFigure(el: FigureElement, depth: number): string[] {
  const lines: string[] = [`${indentOf(depth)}figure ${quote(el.id)} {`];
  const body = depth + 1;
  lines.push(...geometryLines(el, body), ...baseLines(el, body));
  lines.push(prop(body, 'kind', el.kind));
  if (el.title !== '') lines.push(prop(body, 'title', el.title));
  lines.push(prop(body, 'axisColor', el.axisColor));
  if (el.gridColor !== '#d9dde3') lines.push(prop(body, 'gridColor', el.gridColor));
  if (el.accentColor !== '#4c9aff') lines.push(prop(body, 'accentColor', el.accentColor));
  if (el.titleColor !== '#1a1b1e') lines.push(prop(body, 'titleColor', el.titleColor));
  if (el.kind === 'graph') {
    lines.push(prop(body, 'fn', el.fn));
    if (el.a !== 1) lines.push(prop(body, 'a', el.a));
    if (el.b !== 0) lines.push(prop(body, 'b', el.b));
    if (el.c !== 0) lines.push(prop(body, 'c', el.c));
    if (el.domain !== 5) lines.push(prop(body, 'domain', el.domain));
  }
  if (el.kind === 'barchart') {
    lines.push(`${indentOf(body)}values: [ ${el.values.map(num).join(', ')} ];`);
  }
  lines.push(...animationLines(el, body));
  lines.push(`${indentOf(depth)}}`);
  return lines;
}

function serializePen(el: PenElement, depth: number): string[] {
  const lines: string[] = [`${indentOf(depth)}pen ${quote(el.id)} {`];
  const body = depth + 1;
  lines.push(...baseLines(el, body));
  // Pen geometry is derived from points; only rotation/opacity are independent.
  if (el.rotation !== 0) lines.push(prop(body, 'rotation', el.rotation));
  if (el.opacity !== 1) lines.push(prop(body, 'opacity', el.opacity));
  lines.push(prop(body, 'color', el.color));
  lines.push(prop(body, 'width', el.strokeWidth));
  lines.push(prop(body, 'smoothing', el.smoothing));
  if (el.mode !== 'pen') lines.push(prop(body, 'mode', el.mode));
  lines.push(...serializePointList(el, body));
  lines.push(...animationLines(el, body));
  lines.push(`${indentOf(depth)}}`);
  return lines;
}

function anchorValue(anchor: AnchorRef): string {
  if (anchor.kind === 'element') return quote(`${anchor.elementId}:${anchor.port}`);
  return `{ x: ${num(anchor.x)}; y: ${num(anchor.y)}; }`;
}

function serializeConnector(el: ConnectorElement, depth: number): string[] {
  const lines: string[] = [`${indentOf(depth)}connector ${quote(el.id)} {`];
  const body = depth + 1;
  lines.push(...baseLines(el, body));
  lines.push(rawProp(body, 'from', anchorValue(el.from)));
  lines.push(rawProp(body, 'to', anchorValue(el.to)));
  lines.push(prop(body, 'routing', el.routing));
  lines.push(prop(body, 'startArrow', el.startArrow));
  lines.push(prop(body, 'endArrow', el.endArrow));
  if (el.arrowSize !== 14) lines.push(prop(body, 'arrowSize', el.arrowSize));
  if (el.width !== 3) lines.push(prop(body, 'width', el.width));
  if (el.dash !== 0) lines.push(prop(body, 'dash', el.dash));
  if (el.color !== '#4c9aff') lines.push(prop(body, 'color', el.color));
  if (el.label !== '') lines.push(prop(body, 'label', el.label));
  lines.push(...animationLines(el, body));
  lines.push(`${indentOf(depth)}}`);
  return lines;
}

function serializeElement(el: Element, depth: number): string[] {
  switch (el.type) {
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
      return serializeShape(el, depth);
    case 'text':
      return serializeText(el, depth);
    case 'latex':
      return serializeLatex(el, depth);
    case 'code':
      return serializeCode(el, depth);
    case 'image':
      return serializeImage(el, depth);
    case 'html':
      return serializeHtml(el, depth);
    case 'figure':
      return serializeFigure(el, depth);
    case 'pen':
      return serializePen(el, depth);
    case 'connector':
      return serializeConnector(el, depth);
  }
}

/* ─── slide / doc ─── */

function transitionLines(slide: Slide, depth: number): string[] {
  const transition = slide.transition;
  const isDefault =
    transition.type === 'none' &&
    transition.direction === 'right' &&
    transition.duration === 400 &&
    transition.easing === 'easeOut';
  if (isDefault) return [];
  return [
    `${indentOf(depth)}transition {`,
    prop(depth + 1, 'type', transition.type),
    prop(depth + 1, 'direction', transition.direction),
    prop(depth + 1, 'duration', transition.duration),
    prop(depth + 1, 'easing', transition.easing),
    `${indentOf(depth)}}`,
  ];
}

export function serializeSlide(slide: Slide): string {
  const lines: string[] = [`slide ${quote(slide.name)} {`];
  lines.push(prop(1, 'id', slide.id));
  lines.push(prop(1, 'background', slide.background));
  if (slide.backgroundImage) lines.push(prop(1, 'backgroundImage', slide.backgroundImage));
  // A size override is written only when it differs from the deck default.
  if (slide.width !== undefined) lines.push(prop(1, 'width', slide.width));
  if (slide.height !== undefined) lines.push(prop(1, 'height', slide.height));
  if (slide.notes) lines.push(prop(1, 'notes', slide.notes));
  lines.push(...transitionLines(slide, 1));
  for (const el of slide.elements) {
    lines.push('');
    lines.push(...serializeElement(el, 1));
  }
  lines.push('}');
  return lines.join('\n');
}

/**
 * Canonical deck source. Deterministic: identical documents produce identical text.
 * Deck metadata (title/version) is not part of the slide language.
 */
export function serializeDoc(doc: Doc): string {
  if (doc.slides.length === 0) return '';
  return `${doc.slides.map(serializeSlide).join('\n\n')}\n`;
}
