export const SLIDE_W = 1920;
export const SLIDE_H = 1080;
export const DOC_VERSION = 2;

export type SlideId = string;
export type ElementId = string;

export interface Point {
  x: number;
  y: number;
  pressure: number;
  tiltX?: number;
  tiltY?: number;
}

/* ─── Values ─── */

export type Easing = 'linear' | 'ease' | 'easeIn' | 'easeOut' | 'easeInOut' | 'backOut';
export type Align = 'left' | 'center' | 'right';
export type Direction = 'up' | 'down' | 'left' | 'right';
export type ShapeKind = 'rect' | 'ellipse' | 'triangle' | 'line' | 'polygon' | 'star' | 'arrow' | 'chevron' | 'parallelogram' | 'trapezoid' | 'speech';
export type ImageFit = 'contain' | 'cover' | 'fill';
export type ArrowType = 'none' | 'triangle' | 'open' | 'diamond' | 'circle' | 'bar';
export type Routing = 'straight' | 'elbow' | 'curved';
export type FigureKind = 'axes' | 'plane' | 'graph' | 'barchart';
export type FigureFunction = 'line' | 'quadratic' | 'cubic' | 'sine' | 'exp';
export type PenMode = 'pen' | 'highlighter';
export type AnchorPort = 'top' | 'right' | 'bottom' | 'left' | 'auto';
export type TransitionType = 'none' | 'fade' | 'slide' | 'push' | 'zoom';

export type AnimationEffect =
  | 'fadeIn'
  | 'slideIn'
  | 'zoomIn'
  | 'drawLine'
  | 'fadeOut'
  | 'slideOut'
  | 'zoomOut'
  | 'pulse'
  | 'bounce'
  | 'spin'
  | 'flash';

export type AnimationTrigger = 'onClick' | 'withPrevious' | 'afterPrevious';

export const FIGURE_KINDS: FigureKind[] = ['axes', 'plane', 'graph', 'barchart'];
export const FIGURE_FUNCTIONS: FigureFunction[] = ['line', 'quadratic', 'cubic', 'sine', 'exp'];

/** Evaluate the figure curve family at x with coefficients a/b/c. */
export function figureFunction(fn: FigureFunction, a: number, b: number, c: number, x: number): number {
  switch (fn) {
    case 'line':
      return a * x + b;
    case 'quadratic':
      return a * x * x + b * x + c;
    case 'cubic':
      return a * x * x * x + b * x * x + c * x;
    case 'sine':
      return a * Math.sin(b * x) + c;
    case 'exp':
      return a * Math.exp(b * x) + c;
  }
}

/* ─── Styling ─── */

export interface Shadow {
  x: number;
  y: number;
  blur: number;
  color: string;
}

export interface TextBlock {
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  underline: boolean;
  align: Align;
  lineHeight: number;
  letterSpacing: number;
  color: string;
  autofit: boolean;
  /** Render `$…$` spans as inline KaTeX math. */
  math: boolean;
}

/* ─── Elements ─── */

export interface AnimationSpec {
  id: string;
  effect: AnimationEffect;
  trigger: AnimationTrigger;
  duration: number;
  delay: number;
  easing: Easing;
  direction: Direction;
  repeat: number;
}

export interface ElementBase {
  id: ElementId;
  name?: string;
  group?: string;
  /**
   * Group members listed on the group's lead element (the one with the lowest
   * numeric id). Members keep only `group`; the list makes the group explicit
   * in the script and survives round-trips unambiguously.
   */
  members?: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  hidden: boolean;
  animations: AnimationSpec[];
}

export interface ShapeElement extends ElementBase {
  type: ShapeKind;
  fill: string;
  stroke: string;
  strokeWidth: number;
  dash: number;
  radius: number;
  shadow: Shadow | null;
  text: TextBlock | null;
}

export interface TextElement extends ElementBase {
  type: 'text';
  text: TextBlock;
}

export interface LatexElement extends ElementBase {
  type: 'latex';
  content: string;
  displayMode: boolean;
  fontSize: number;
  /** Text color of the rendered math (KaTeX markup keeps its own font roles). */
  color: string;
}

export interface ImageElement extends ElementBase {
  type: 'image';
  /** URL or data URL. Empty means the placeholder box is drawn. */
  src: string;
  fit: ImageFit;
  radius: number;
}

export interface CodeElement extends ElementBase {
  type: 'code';
  content: string;
  language: string;
  /** Draw the language name in the block's header row. */
  showLanguage: boolean;
  theme: 'dark' | 'light';
  fontSize: number;
  lineNumbers: boolean;
  color: string;
  background: string;
}

export interface HtmlEmbedElement extends ElementBase {
  type: 'html';
  /** External page URL. Mutually exclusive with `content` (content wins). */
  src: string;
  /** Embedded HTML source text, e.g. from a picked .html file or authored inline. */
  content: string;
  radius: number;
  /** Bumped to force the live frame to remount. Not serialized when 0. */
  reloadToken: number;
}

export interface FigureElement extends ElementBase {
  type: 'figure';
  kind: FigureKind;
  /** Caption drawn above the figure (may be empty). */
  title: string;
  axisColor: string;
  gridColor: string;
  accentColor: string;
  titleColor: string;
  /** Curve family for the `graph` kind: f(x) built from a/b/c. */
  fn: FigureFunction;
  /** Coefficients of the selected curve family. */
  a: number;
  b: number;
  c: number;
  /** Half of the plotted x-domain: x runs over [-xMax, xMax]. */
  domain: number;
  /** Bar heights for the `barchart` kind. */
  values: number[];
}

export interface PenElement extends ElementBase {
  type: 'pen';
  color: string;
  /** Stroke thickness. Bounds `width`/`height` are derived from the points. */
  strokeWidth: number;
  smoothing: boolean;
  mode: PenMode;
  points: Point[];
}

export interface ElementAnchor {
  kind: 'element';
  elementId: ElementId;
  port: AnchorPort;
}

export interface PointAnchor {
  kind: 'point';
  x: number;
  y: number;
}

export type AnchorRef = ElementAnchor | PointAnchor;

export interface ConnectorElement {
  id: ElementId;
  type: 'connector';
  name?: string;
  group?: string;
  members?: string[];
  locked: boolean;
  hidden: boolean;
  animations: AnimationSpec[];
  from: AnchorRef;
  to: AnchorRef;
  routing: Routing;
  startArrow: ArrowType;
  endArrow: ArrowType;
  arrowSize: number;
  width: number;
  dash: number;
  color: string;
  label: string;
}

export type Element =
  | ShapeElement
  | TextElement
  | LatexElement
  | CodeElement
  | ImageElement
  | HtmlEmbedElement
  | FigureElement
  | PenElement
  | ConnectorElement;

export type ElementType = Element['type'];

/* ─── Slides ─── */

export interface SlideTransition {
  type: TransitionType;
  direction: Direction;
  duration: number;
  easing: Easing;
}

export interface Slide {
  id: SlideId;
  name: string;
  background: string;
  /**
   * Optional full-bleed background image (data URL), drawn contain-fit behind
   * every element. Deeper than the background color but never selectable, so
   * imported pages and photos can sit under annotations cleanly.
   */
  backgroundImage?: string;
  /**
   * Optional per-slide canvas size. Both or neither: when absent the slide
   * uses the deck default (SLIDE_W × SLIDE_H). Written as slide properties so
   * the size survives script round-trips.
   */
  width?: number;
  height?: number;
  notes: string;
  transition: SlideTransition;
  elements: Element[];
}

/** The canvas size a slide actually renders at (defaults fill in per-slide overrides). */
export function canvasSize(slide: Pick<Slide, 'width' | 'height'>): { width: number; height: number } {
  const width = typeof slide.width === 'number' && slide.width > 0 && Number.isFinite(slide.width) ? slide.width : SLIDE_W;
  const height = typeof slide.height === 'number' && slide.height > 0 && Number.isFinite(slide.height) ? slide.height : SLIDE_H;
  return { width, height };
}

export interface Doc {
  version: number;
  title: string;
  width: number;
  height: number;
  slides: Slide[];
}

/* ─── Diagnostics ─── */

export type DiagnosticPhase = 'lex' | 'parse' | 'validate' | 'action';

export interface Diagnostic {
  severity: 'error' | 'warning';
  phase: DiagnosticPhase;
  message: string;
  line?: number;
  column?: number;
  elementId?: string;
}

export interface CompileResult {
  doc: Doc | null;
  errors: Diagnostic[];
}

/* ─── Guards ─── */

export const SHAPE_KINDS: ShapeKind[] = [
  'rect',
  'ellipse',
  'triangle',
  'line',
  'polygon',
  'star',
  'arrow',
  'chevron',
  'parallelogram',
  'trapezoid',
  'speech',
];

export function isShape(el: Element): el is ShapeElement {
  return (
    el.type !== 'text' &&
    el.type !== 'latex' &&
    el.type !== 'code' &&
    el.type !== 'image' &&
    el.type !== 'html' &&
    el.type !== 'figure' &&
    el.type !== 'pen' &&
    el.type !== 'connector'
  );
}

export function isConnector(el: Element): el is ConnectorElement {
  return el.type === 'connector';
}

export function hasGeometry(el: Element): el is Exclude<Element, ConnectorElement> {
  return el.type !== 'connector';
}

export function hasText(el: Element): el is ShapeElement | TextElement {
  return el.type === 'text' || (isShape(el) && el.text !== null);
}

export const ANIMATION_EFFECTS: AnimationEffect[] = [
  'fadeIn',
  'slideIn',
  'zoomIn',
  'drawLine',
  'fadeOut',
  'slideOut',
  'zoomOut',
  'pulse',
  'bounce',
  'spin',
  'flash',
];

export const ENTER_EFFECTS: AnimationEffect[] = ['fadeIn', 'slideIn', 'zoomIn', 'drawLine'];
export const EXIT_EFFECTS: AnimationEffect[] = ['fadeOut', 'slideOut', 'zoomOut'];
export const EMPHASIS_EFFECTS: AnimationEffect[] = ['pulse', 'bounce', 'spin', 'flash'];

export const EASINGS: Easing[] = ['linear', 'ease', 'easeIn', 'easeOut', 'easeInOut', 'backOut'];
export const ARROW_TYPES: ArrowType[] = ['none', 'triangle', 'open', 'diamond', 'circle', 'bar'];
export const ROUTINGS: Routing[] = ['straight', 'elbow', 'curved'];
export const ANCHOR_PORTS: AnchorPort[] = ['top', 'right', 'bottom', 'left', 'auto'];
export const TRANSITION_TYPES: TransitionType[] = ['none', 'fade', 'slide', 'push', 'zoom'];
export const IMAGE_FITS: ImageFit[] = ['contain', 'cover', 'fill'];
export const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];
