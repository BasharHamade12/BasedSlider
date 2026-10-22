import { ProgramNode, SlideNode, RectNode, TextNode, LatexNode, PenNode, CodeNode, PointNode } from './ast';
import {
  Slide,
  SlideElement,
  RectElement,
  TextElement,
  LatexElement,
  PenElement,
  CodeElement,
  Point,
} from '../store/presentation.types';

function elemId(slideIdx: number, elemIdx: number): string {
  return `s${slideIdx}-e${elemIdx}`;
}

export function interpret(ast: ProgramNode): Slide[] {
  return ast.map((node, i) => mapSlide(node, i));
}

function mapSlide(node: SlideNode, slideIdx: number): Slide {
  return {
    id: `slide-${slideIdx}`,
    name: node.name,
    background: node.background,
    elements: node.elements.map((el, ei) => mapElement(el, slideIdx, ei)),
  };
}

function mapElement(node: SlideNode['elements'][number], slideIdx: number, elemIdx: number): SlideElement {
  const id = elemId(slideIdx, elemIdx);
  switch (node.type) {
    case 'rect':
      return mapRect(node, id);
    case 'text':
      return mapText(node, id);
    case 'latex':
      return mapLatex(node, id);
    case 'pen':
      return mapPen(node, id);
    case 'code':
      return mapCode(node, id);
  }
}

function mapRect(node: RectNode, id: string): RectElement {
  return {
    id,
    type: 'rect',
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    fill: node.fill,
    stroke: node.stroke,
    strokeWidth: node.strokeWidth,
    rx: node.rx,
    selected: node.selected ?? undefined,
  };
}

function mapText(node: TextNode, id: string): TextElement {
  return {
    id,
    type: 'text',
    x: node.x,
    y: node.y,
    content: node.content,
    fontSize: node.fontSize,
    fontFamily: node.fontFamily,
    color: node.color,
    bold: node.bold,
    italic: node.italic,
    selected: node.selected ?? undefined,
  };
}

function mapLatex(node: LatexNode, id: string): LatexElement {
  return {
    id,
    type: 'latex',
    x: node.x,
    y: node.y,
    content: node.content,
    selected: node.selected ?? undefined,
  };
}

function mapPen(node: PenNode, id: string): PenElement {
  const pts = node.points.map(mapPoint);
  const xs = pts.map(p => p.x);
  const ys = pts.map(p => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    id,
    type: 'pen',
    x: minX,
    y: minY,
    color: node.color,
    width: node.width,
    smoothing: node.smoothing,
    selected: node.selected ?? undefined,
    points: pts,
  };
}

function mapPoint(node: PointNode): Point {
  return {
    x: node.x,
    y: node.y,
    pressure: node.pressure ?? 0.5,
    tiltX: node.tiltX,
    tiltY: node.tiltY,
  };
}

function mapCode(node: CodeNode, id: string): CodeElement {
  return {
    id,
    type: 'code',
    x: node.x,
    y: node.y,
    content: node.content,
    language: node.language,
    fontSize: node.fontSize,
    color: node.color,
    background: node.background,
    selected: node.selected ?? undefined,
  };
}
