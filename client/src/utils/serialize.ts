import { Slide, SlideElement, PenElement, RectElement, TextElement, LatexElement, CodeElement } from '../store/presentation.types';

export function serialize(slides: Slide[]): string {
  return slides.map(serializeSlide).join('\n');
}

function serializeSlide(slide: Slide, i: number): string {
  const bg = slide.background !== '#ffffff' ? `    background: "${slide.background}";\n` : '';
  const elements = slide.elements.map(serializeElement).join('\n');
  const prefix = i > 0 ? '\n' : '';
  return `${prefix}slide "${slide.name}" {\n${bg}${elements}\n}`;
}

function indent(block: string): string {
  return block
    .split('\n')
    .map((l) => (l ? `    ${l}` : l))
    .join('\n');
}

function serializeElement(el: SlideElement): string {
  switch (el.type) {
    case 'rect':   return serializeRect(el);
    case 'text':   return serializeText(el);
    case 'latex':  return serializeLatex(el);
    case 'pen':    return serializePen(el);
    case 'code':   return serializeCode(el);
  }
}

function serializeRect(el: RectElement): string {
  const props = [
    prop('x', el.x),
    prop('y', el.y),
    prop('width', el.width),
    prop('height', el.height),
    strProp('fill', el.fill),
  ];
  if (el.stroke) props.push(strProp('stroke', el.stroke));
  if (el.strokeWidth) props.push(prop('strokeWidth', el.strokeWidth));
  if (el.rx) props.push(prop('rx', el.rx));
  if (el.selected) props.push('selected: true;');
  return `\n${indent(`rect {\n${props.join('\n')}\n}`)}`;
}

function serializeText(el: TextElement): string {
  const props = [
    prop('x', el.x),
    prop('y', el.y),
    strProp('content', el.content),
  ];
  if (el.fontSize) props.push(prop('fontSize', el.fontSize));
  if (el.fontFamily) props.push(strProp('fontFamily', el.fontFamily));
  if (el.color) props.push(strProp('color', el.color));
  if (el.bold) props.push('bold: true;');
  if (el.italic) props.push('italic: true;');
  if (el.selected) props.push('selected: true;');
  return `\n${indent(`text {\n${props.join('\n')}\n}`)}`;
}

function serializeLatex(el: LatexElement): string {
  const props = [
    prop('x', el.x),
    prop('y', el.y),
    strProp('content', el.content),
  ];
  if (el.selected) props.push('selected: true;');
  return `\n${indent(`latex {\n${props.join('\n')}\n}`)}`;
}

function serializePen(el: PenElement): string {
  const ptStr = el.points
    .map(
      (p) =>
        `{x: ${p.x}; y: ${p.y};${p.pressure !== undefined ? ` pressure: ${p.pressure};` : ''}}`,
    )
    .join(',\n');
  const props = [
    strProp('color', el.color),
    prop('width', el.width),
    `smoothing: ${el.smoothing};`,
    `points: [\n${ptStr}\n];`,
  ];
  if (el.selected) props.push('selected: true;');
  return `\n${indent(`pen {\n${props.join('\n')}\n}`)}`;
}

function prop(key: string, value: number | undefined): string {
  return `${key}: ${value};`;
}

function escapeStr(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function strProp(key: string, value: string): string {
  return `${key}: "${escapeStr(value)}";`;
}

function serializeCode(el: CodeElement): string {
  const props = [
    prop('x', el.x),
    prop('y', el.y),
    strProp('content', el.content),
  ];
  if (el.language) props.push(strProp('language', el.language));
  if (el.fontSize) props.push(prop('fontSize', el.fontSize));
  if (el.color) props.push(strProp('color', el.color));
  if (el.background) props.push(strProp('background', el.background));
  if (el.selected) props.push('selected: true;');
  return `\n${indent(`code {\n${props.join('\n')}\n}`)}`;
}
