export interface Position {
  line: number;
  column: number;
}

export interface SlideNode {
  type: 'slide';
  name: string;
  background: string;
  elements: ElementNode[];
  position: Position;
}

export type ElementNode =
  | RectNode
  | TextNode
  | LatexNode
  | PenNode
  | CodeNode;

export interface RectNode {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  rx?: number;
  selected?: boolean;
  position: Position;
}

export interface TextNode {
  type: 'text';
  x: number;
  y: number;
  content: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  selected?: boolean;
  position: Position;
}

export interface LatexNode {
  type: 'latex';
  x: number;
  y: number;
  content: string;
  selected?: boolean;
  position: Position;
}

export interface PointNode {
  x: number;
  y: number;
  pressure?: number;
  tiltX?: number;
  tiltY?: number;
}

export interface PenNode {
  type: 'pen';
  color: string;
  width: number;
  smoothing: boolean;
  points: PointNode[];
  selected?: boolean;
  position: Position;
}

export interface CodeNode {
  type: 'code';
  x: number;
  y: number;
  content: string;
  language?: string;
  fontSize?: number;
  color?: string;
  background?: string;
  selected?: boolean;
  position: Position;
}

export type ProgramNode = SlideNode[];

export interface CompilerError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
  phase: 'lex' | 'parse' | 'semantic';
}
