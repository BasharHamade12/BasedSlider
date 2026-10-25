import {
  createAnimation,
  createCode,
  createConnector,
  createLatex,
  createPen,
  createShape,
  createText,
  createTextBlock,
  createDocWithSlides,
  createSlide,
} from '../model/factories';
import { Doc, Slide } from '../model/types';

const titleSlide: Slide = createSlide('s1', 'Basedslider', {
  background: '#101114',
  transition: { type: 'fade', direction: 'left', duration: 500, easing: 'easeOut' },
  elements: [
    createShape(
      'rect',
      'e1',
      { x: 140, y: 236, width: 120, height: 8 },
      { fill: '#4c9aff', radius: 4 },
    ),
    createText(
      'e2',
      { x: 140, y: 280, width: 1280, height: 150 },
      {
        animations: [createAnimation('a1', { effect: 'fadeIn', trigger: 'afterPrevious', duration: 500 })],
      },
      {
        content: 'Basedslider',
        fontSize: 104,
        fontWeight: 700,
        color: '#ffffff',
        lineHeight: 1.05,
      },
    ),
    createText(
      'e3',
      { x: 144, y: 450, width: 980, height: 90 },
      {
        animations: [
          createAnimation('a2', {
            effect: 'slideIn',
            trigger: 'afterPrevious',
            duration: 550,
            delay: 120,
            direction: 'up',
          }),
        ],
      },
      {
        content: 'Code-first slides. GUI-fast editing.',
        fontSize: 36,
        color: '#9aa4b2',
      },
    ),
    createShape(
      'star',
      'e4',
      { x: 1480, y: 200, width: 220, height: 220 },
      {
        fill: 'rgba(76,154,255,0.12)',
        stroke: '#4c9aff',
        strokeWidth: 2,
        animations: [
          createAnimation('a3', {
            effect: 'spin',
            trigger: 'afterPrevious',
            duration: 900,
            easing: 'easeInOut',
          }),
        ],
      },
    ),
    createText(
      'e5',
      { x: 150, y: 720, width: 900, height: 70 },
      {},
      {
        content: 'Press → for the next slide',
        fontSize: 24,
        color: '#5c6675',
      },
    ),
  ],
});

const architectureSlide: Slide = createSlide('s2', 'Architecture', {
  background: '#ffffff',
  transition: { type: 'slide', direction: 'left', duration: 420, easing: 'easeOut' },
  elements: [
    createText(
      'e6',
      { x: 120, y: 80, width: 900, height: 90 },
      {},
      { content: 'How it fits together', fontSize: 48, fontWeight: 700, color: '#1a1b1e' },
    ),
    createShape(
      'rect',
      'e7',
      { x: 150, y: 280, width: 380, height: 190 },
      {
        fill: '#1e1e1e',
        radius: 18,
        shadow: { x: 0, y: 8, blur: 20, color: '#00000022' },
        text: createTextBlock({
          content: 'Editor',
          fontSize: 30,
          fontWeight: 600,
          color: '#ffffff',
          align: 'center',
        }),
      },
    ),
    createShape(
      'rect',
      'e8',
      { x: 770, y: 280, width: 380, height: 190 },
      {
        fill: '#2b6cb0',
        radius: 18,
        text: createTextBlock({
          content: 'Document model',
          fontSize: 26,
          fontWeight: 600,
          color: '#ffffff',
          align: 'center',
        }),
      },
    ),
    createShape(
      'rect',
      'e9',
      { x: 1390, y: 280, width: 380, height: 190 },
      {
        fill: '#2f855a',
        radius: 18,
        text: createTextBlock({
          content: 'Renderer',
          fontSize: 30,
          fontWeight: 600,
          color: '#ffffff',
          align: 'center',
        }),
      },
    ),
    createConnector(
      'c1',
      {
        from: { kind: 'element', elementId: 'e7', port: 'right' },
        to: { kind: 'element', elementId: 'e8', port: 'left' },
      },
      {
        endArrow: 'triangle',
        color: '#4c9aff',
        width: 3,
        label: 'actions',
        animations: [
          createAnimation('a4', { effect: 'drawLine', trigger: 'afterPrevious', duration: 700 }),
        ],
      },
    ),
    createConnector(
      'c2',
      {
        from: { kind: 'element', elementId: 'e8', port: 'right' },
        to: { kind: 'element', elementId: 'e9', port: 'left' },
      },
      {
        routing: 'curved',
        endArrow: 'diamond',
        color: '#2f855a',
        label: 'slides',
      },
    ),
    createConnector(
      'c3',
      {
        from: { kind: 'element', elementId: 'e7', port: 'bottom' },
        to: { kind: 'element', elementId: 'e9', port: 'top' },
      },
      {
        routing: 'straight',
        startArrow: 'circle',
        endArrow: 'open',
        color: '#c53030',
        width: 2,
        dash: 8,
      },
    ),
    createText(
      'e10',
      { x: 150, y: 520, width: 1100, height: 60 },
      {},
      {
        content: 'Typed actions → validated document → canonical script',
        fontSize: 24,
        color: '#718096',
      },
    ),
    createCode(
      'e11',
      { x: 150, y: 610, width: 1000, height: 330 },
      {
        animations: [
          createAnimation('a5', { effect: 'fadeIn', trigger: 'afterPrevious', duration: 450, delay: 100 }),
        ],
        content:
          "const shape = createShape('rect', 'e12', {\n  x: 100, y: 160,\n  width: 380, height: 180,\n});\n\nstore.addElement(shape); // undoable\nstore.updateElement('e12', { fill: '#4c9aff' });",
        language: 'typescript',
        fontSize: 17,
      },
    ),
  ],
});

const richSlide: Slide = createSlide('s3', 'Rich content', {
  background: '#f7f8fa',
  transition: { type: 'zoom', direction: 'left', duration: 450, easing: 'easeInOut' },
  elements: [
    createText(
      'e12',
      { x: 110, y: 70, width: 1100, height: 90 },
      {},
      { content: 'Math, code, shapes, ink', fontSize: 46, fontWeight: 700, color: '#1a1b1e' },
    ),
    createLatex(
      'e13',
      { x: 110, y: 210, width: 900, height: 200 },
      {
        content: '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}',
        fontSize: 38,
        animations: [
          createAnimation('a6', { effect: 'fadeIn', trigger: 'onClick', duration: 500 }),
        ],
      },
    ),
    createCode(
      'e14',
      { x: 1080, y: 200, width: 720, height: 300 },
      {
        animations: [
          createAnimation('a7', {
            effect: 'slideIn',
            trigger: 'withPrevious',
            duration: 500,
            direction: 'left',
          }),
        ],
        content: "def greet(name: str) -> str:\n    return f\"Hello, {name}!\"\n\nprint(greet('world'))",
        language: 'python',
        fontSize: 18,
        theme: 'dark',
      },
    ),
    createShape(
      'ellipse',
      'e15',
      { x: 120, y: 640, width: 360, height: 220 },
      {
        fill: 'linear-gradient(90deg, #4c9aff, #9b51e0)',
        text: createTextBlock({
          content: 'Gradients',
          fontSize: 28,
          fontWeight: 600,
          color: '#ffffff',
          align: 'center',
        }),
        animations: [
          createAnimation('a8', {
            effect: 'zoomIn',
            trigger: 'afterPrevious',
            duration: 450,
            delay: 150,
          }),
        ],
      },
    ),
    createShape(
      'triangle',
      'e16',
      { x: 560, y: 650, width: 240, height: 200 },
      {
        fill: '#f6ad55',
        stroke: '#c05621',
        strokeWidth: 3,
        text: createTextBlock({
          content: 'Shapes',
          fontSize: 24,
          color: '#1a1b1e',
          align: 'center',
        }),
      },
    ),
    createPen(
      'e17',
      [
        { x: 900, y: 760, pressure: 0.4 },
        { x: 980, y: 700, pressure: 0.6 },
        { x: 1060, y: 800, pressure: 0.5 },
        { x: 1140, y: 700, pressure: 0.7 },
        { x: 1220, y: 760, pressure: 0.4 },
      ],
      { color: '#e03131', strokeWidth: 6, smoothing: true },
    ),
    createText(
      'e18',
      { x: 1080, y: 560, width: 720, height: 60 },
      {},
      { content: 'Freehand ink → pen element', fontSize: 22, color: '#718096' },
    ),
  ],
});

const endSlide: Slide = createSlide('s4', 'Thanks', {
  background: '#101114',
  transition: { type: 'fade', direction: 'left', duration: 400, easing: 'easeOut' },
  elements: [
    createText(
      'e19',
      { x: 140, y: 400, width: 1400, height: 160 },
      {
        animations: [
          createAnimation('a9', { effect: 'fadeIn', trigger: 'afterPrevious', duration: 600 }),
        ],
      },
      {
        content: 'Build decks like you build software.',
        fontSize: 64,
        fontWeight: 700,
        color: '#ffffff',
        lineHeight: 1.15,
      },
    ),
    createText(
      'e20',
      { x: 144, y: 600, width: 1200, height: 70 },
      {
        animations: [
          createAnimation('a10', {
            effect: 'slideIn',
            trigger: 'afterPrevious',
            duration: 500,
            delay: 150,
            direction: 'up',
          }),
        ],
      },
      {
        content: 'Every edit is typed, validated, undoable, and reflected in the script.',
        fontSize: 26,
        color: '#9aa4b2',
      },
    ),
  ],
});

export function createDemoDeck(): Doc {
  return createDocWithSlides([titleSlide, architectureSlide, richSlide, endSlide], 'Basedslider demo');
}
