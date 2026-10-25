import {
  createAnimation,
  createCode,
  createConnector,
  createDocWithSlides,
  createImage,
  createLatex,
  createHtmlEmbed,
  createPen,
  createShape,
  createShadow,
  createSlide,
  createText,
  createTextBlock,
  createElementOfType,
} from '../factories';
import { Doc, ElementType, Slide } from '../types';

export function fullFixture(): Doc {
  const slide = createSlide('s1', 'Everything', {
    background: '#101114',
    notes: 'Speaker notes with "quotes" and a \\ backslash.',
    transition: { type: 'slide', direction: 'left', duration: 450, easing: 'easeInOut' },
    elements: [
      createShape(
        'rect',
        'e1',
        { x: 10, y: 20, width: 300, height: 200 },
        {
          name: 'Panel',
          group: 'g1',
          rotation: 12,
          opacity: 0.8,
          locked: true,
          hidden: true,
          fill: 'linear-gradient(90deg, #ff0000, #0000ff)',
          stroke: '#ffffff',
          strokeWidth: 2,
          dash: 6,
          radius: 14,
          shadow: createShadow({ x: 4, y: 9, blur: 22, color: '#11223388' }),
          text: createTextBlock({
            content: 'Label "quoted"\nline 2',
            fontFamily: 'Georgia, serif',
            fontSize: 28,
            fontWeight: 700,
            italic: true,
            underline: true,
            color: '#ffffff',
            align: 'center',
            lineHeight: 1.6,
            letterSpacing: 2.25,
            autofit: true,
          }),
          animations: [
            createAnimation('a1', {
              effect: 'zoomIn',
              trigger: 'onClick',
              duration: 400,
              delay: 75,
              easing: 'backOut',
              direction: 'left',
              repeat: 3,
            }),
          ],
        },
      ),
      createText(
        'e2',
        { x: 400, y: 40, width: 500, height: 120 },
        { name: 'Body copy', group: 'g2', rotation: -4, locked: true, hidden: true, opacity: 0.75 },
        {
          content: 'Multi\nline \\ backslash',
          fontSize: 36,
          italic: true,
          underline: true,
          align: 'right',
          letterSpacing: 1.5,
          lineHeight: 1.4,
          color: '#123456',
          autofit: true,
        },
      ),
      createLatex('e3', { x: 100, y: 300, width: 600, height: 150 }, {
        name: 'Integral', group: 'g4', locked: true, hidden: true, opacity: 0.8,
        content: '\\int_0^1 x^2 dx',
        displayMode: false,
        fontSize: 24,
      }),
      createCode('e4', { x: 800, y: 300, width: 700, height: 300 }, {
        name: 'Example code', group: 'g5', locked: true, hidden: true, opacity: 0.9,
        content: 'const x = "hi";\nconsole.log(x);',
        language: 'javascript',
        theme: 'light',
        fontSize: 16,
        lineNumbers: false,
        color: '#111111',
        background: '#fafafa',
      }),
      createPen(
        'e5',
        [
          { x: 100, y: 500, pressure: 0.4, tiltX: 10 },
          { x: 160, y: 540, pressure: 0.8, tiltY: 5 },
          { x: 220, y: 500, pressure: 0.5 },
        ],
        {
          name: 'Ink annotation', group: 'g6', locked: true, hidden: true,
          rotation: 12,
          color: '#e03131',
          strokeWidth: 5,
          smoothing: false,
          mode: 'highlighter',
          opacity: 0.6,
        },
      ),
      createShape('ellipse', 'e6', { x: 600, y: 500, width: 260, height: 160 }, {
        fill: 'rgba(0,0,0,0.2)',
        animations: [
          createAnimation('a2', {
            effect: 'pulse',
            trigger: 'afterPrevious',
            duration: 300,
            repeat: 2,
          }),
        ],
      }),
      createShape('star', 'e7', { x: 900, y: 500, width: 180, height: 180 }, {
        fill: '#f6ad55',
      }),
      createShape('triangle', 'e10', { x: 1100, y: 100, width: 90, height: 80 }, {
        fill: '#00a884', stroke: '#004433', strokeWidth: 3, dash: 2, rotation: 15, opacity: 0.7,
      }),
      createShape('line', 'e11', { x: 1200, y: 100, width: 120, height: 4 }, {
        fill: 'none', stroke: '#222222', strokeWidth: 2, dash: 5,
      }),
      createShape('polygon', 'e12', { x: 1350, y: 100, width: 100, height: 90 }, {
        fill: '#8b5cf6', stroke: '#4c1d95', strokeWidth: 1, radius: 9,
      }),
      createConnector(
        'c1',
        {
          from: { kind: 'element', elementId: 'e1', port: 'right' },
          to: { kind: 'element', elementId: 'e6', port: 'left' },
        },
        {
          name: 'Primary link',
          group: 'g3',
          locked: true,
          hidden: true,
          routing: 'curved',
          startArrow: 'diamond',
          endArrow: 'open',
          arrowSize: 18,
          width: 2.5,
          dash: 4,
          color: '#2f855a',
          label: 'link',
          animations: [
            createAnimation('a3', {
              effect: 'drawLine',
              trigger: 'onClick',
              duration: 600,
              delay: 50,
            }),
          ],
        },
      ),
      createConnector('c2', {
        from: { kind: 'point', x: 10, y: 900 },
        to: { kind: 'element', elementId: 'e7', port: 'auto' },
        routing: 'straight',
        startArrow: 'bar',
        endArrow: 'circle',
      }),
    ],
  });

  const second = createSlide('s2', 'Second slide', {
    background: '#ffffff',
    transition: { type: 'none', direction: 'right', duration: 400, easing: 'easeOut' },
    elements: [
      createText('e8', { x: 80, y: 80, width: 600, height: 100 }, {}, {
        content: 'Second slide',
        fontSize: 40,
      }),
      createImage('e9', { x: 80, y: 220, width: 480, height: 270 }, {
        name: 'Embedded artwork', group: 'g7', locked: true, hidden: true, opacity: 0.65,
        src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=',
        fit: 'cover',
        radius: 18,
        animations: [
          createAnimation('a4', {
            effect: 'zoomIn',
            trigger: 'withPrevious',
            duration: 350,
          }),
        ],
      }),
      createHtmlEmbed('e13', { x: 620, y: 220, width: 560, height: 340 }, {
        name: 'Live widget',
        src: 'https://example.com/widget',
        radius: 12,
      }),
    ],
  });

  return createDocWithSlides([slide, second], 'Fixture deck');
}

/** Small deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TYPES: ElementType[] = [
  'rect',
  'ellipse',
  'triangle',
  'line',
  'polygon',
  'star',
  'text',
  'latex',
  'code',
  'image',
  'pen',
  'connector',
];

const STRINGS = [
  'Plain',
  'Quote " inside',
  'Backslash \\ inside',
  'Line one\nLine two',
  'Unicode — ✓ 日本語',
  '',
];

const COLORS = ['#ffffff', '#101114', '#4c9aff', 'rgba(0,0,0,0.2)', 'linear-gradient(90deg, #f00, #00f)'];
const IMAGE_SOURCES = [
  'https://example.com/chart.png',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=',
];
const EFFECTS = ['fadeIn', 'slideIn', 'zoomIn', 'pulse', 'bounce', 'fadeOut'] as const;

export function randomDoc(seed: number): Doc {
  const random = mulberry32(seed);
  const pick = <T,>(values: T[]): T => values[Math.floor(random() * values.length)];
  const number = (min: number, max: number) => Math.round(min + random() * (max - min));

  const slideCount = 1 + Math.floor(random() * 3);
  const doc = createDocWithSlides([], 'Random deck');
  let animationCounter = 0;

  for (let s = 0; s < slideCount; s += 1) {
    const slide: Slide = createSlide(`s${s + 1}`, pick(['Intro', 'Middle', 'End']) + ` ${s + 1}`, {
      background: pick(['#ffffff', '#101114', '#f7f8fa']),
      transition: {
        type: pick(['none', 'fade', 'slide', 'push', 'zoom']),
        direction: pick(['up', 'down', 'left', 'right']),
        duration: number(0, 900),
        easing: pick(['linear', 'ease', 'easeIn', 'easeOut', 'easeInOut', 'backOut']),
      },
    });

    doc.slides.push(slide);

    const elementCount = Math.floor(random() * 9);
    for (let i = 0; i < elementCount; i += 1) {
      const type = pick(TYPES);
      const element = createElementOfType(type, doc, number(-100, 1600), number(-100, 900));

      if (element.type !== 'connector' && element.type !== 'pen') {
        element.width = number(4, 800);
        element.height = number(4, 500);
        element.rotation = number(-180, 180);
        element.opacity = Number(random().toFixed(2));
      }

      if (element.type !== 'connector') {
        element.locked = random() < 0.15;
        element.hidden = random() < 0.1;
        if (random() < 0.3) element.group = 'g1';
        const name = pick(STRINGS);
        if (random() < 0.3 && name !== '') element.name = name;
      }

      if (element.type === 'text') {
        element.text.content = pick(STRINGS);
        element.text.fontSize = number(8, 96);
        element.text.align = pick(['left', 'center', 'right']);
        element.text.italic = random() < 0.5;
      }
      if (element.type === 'latex') {
        element.content = '\\frac{a}{b}';
        element.displayMode = random() < 0.5;
      }
      if (element.type === 'code') {
        element.content = pick(STRINGS);
        element.language = pick(['typescript', 'python', 'javascript']);
        element.theme = pick(['dark', 'light']);
      }
      if (element.type === 'image') {
        element.src = pick(IMAGE_SOURCES);
        element.fit = pick(['contain', 'cover', 'fill']);
        element.radius = number(0, 40);
      }
      if (element.type === 'pen') {
        element.color = pick(COLORS.slice(0, 4));
        element.mode = pick(['pen', 'highlighter']);
      }
      if (element.type === 'connector') {
        element.color = pick(COLORS.slice(0, 4));
        element.label = pick(STRINGS);
        element.routing = pick(['straight', 'elbow', 'curved']);
      } else if (
        element.type !== 'pen' &&
        element.type !== 'latex' &&
        element.type !== 'code' &&
        element.type !== 'text' &&
        element.type !== 'image' &&
        element.type !== 'html' &&
        element.type !== 'figure'
      ) {
        element.fill = pick(COLORS);
      }

      if (random() < 0.45) {
        animationCounter += 1;
        const effect = pick([...EFFECTS]);
        element.animations.push(
          createAnimation(`a${animationCounter}`, {
            effect,
            trigger: pick(['onClick', 'withPrevious', 'afterPrevious']),
            duration: number(0, 1200),
            delay: number(0, 400),
            direction: pick(['up', 'down', 'left', 'right']),
            repeat: number(1, 3),
          }),
        );
      }

      slide.elements.push(element);
    }
  }

  return doc;
}
