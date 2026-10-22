export type SlideId = string;
export type ElementId = string;

export interface Point {
  x: number;
  y: number;
  pressure: number;
  tiltX?: number;
  tiltY?: number;
}

export interface BaseElement {
  id: ElementId;
  type: 'rect' | 'text' | 'latex' | 'pen' | 'code';
  x: number;
  y: number;
  width?: number;
  height?: number;
  selected?: boolean;
}

export interface RectElement extends BaseElement {
  type: 'rect';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  rx?: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
}

export interface LatexElement extends BaseElement {
  type: 'latex';
  content: string;
}

export interface PenElement extends BaseElement {
  type: 'pen';
  color: string;
  width: number;
  smoothing: boolean;
  points: Point[];
}

export interface CodeElement extends BaseElement {
  type: 'code';
  content: string;
  language?: string;
  fontSize?: number;
  color?: string;
  background?: string;
}

export type SlideElement = RectElement | TextElement | LatexElement | PenElement | CodeElement;

export interface Slide {
  id: SlideId;
  name: string;
  background: string;
  elements: SlideElement[];
}

export interface CompilerError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
  phase: 'lex' | 'parse' | 'semantic';
}

export interface ActiveStroke {
  color: string;
  width: number;
  points: Point[];
}
