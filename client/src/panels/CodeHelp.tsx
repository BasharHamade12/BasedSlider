import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Check, Copy, Search, X } from 'lucide-react';

/** One row of a property table: what to type, what it accepts, and its default. */
type PropRow = {
  name: string;
  accepts: string;
  fallback?: string;
};

type PropGroup = {
  label: string;
  /** Column headings; the first one is the property name column. */
  columns?: [string, string, string];
  rows: PropRow[];
};

type CodeHelpEntry = {
  title: string;
  description: string;
  /** Keywords this entry covers, shown as monospace chips under the title. */
  aliases?: string[];
  /** Copyable script snippet. Entries without one render as text only. */
  snippet?: string;
  props?: PropGroup[];
  /** Shared element keys that also apply here, listed so the set is complete. */
  shared?: string[];
  keywords?: string[];
};

type CodeHelpSection = {
  title: string;
  entries: CodeHelpEntry[];
};

const GEOMETRY_SHARED = [
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'opacity',
  'name',
  'group',
  'members',
  'locked',
  'hidden',
  'animate { }',
];

const CONNECTOR_SHARED = ['name', 'group', 'members', 'locked', 'hidden', 'animate { }'];

const PEN_SHARED = [
  'rotation',
  'opacity',
  'name',
  'group',
  'members',
  'locked',
  'hidden',
  'animate { }',
];

/**
 * The complete script language as a casual user needs it: one entry per thing
 * they would build, each listing every property that thing accepts, in the
 * order they tend to need it. Snippets stay copy-paste valid.
 */
const CODE_HELP_SECTIONS: CodeHelpSection[] = [
  {
    title: 'Slides',
    entries: [
      {
        title: 'The slide block',
        description:
          'A deck is a list of slide blocks. Each has a name in quotes and a body; elements live inside the body, measured from the top-left corner of the 1920 × 1080 canvas. A size override needs both width and height.',
        aliases: ['slide "Name" { … }'],
        snippet: `slide "Opening" {\n    background: "#101114";\n\n    text "e1" {\n        x: 120; y: 120;\n        content: "Hello, world";\n        fontSize: 64;\n        color: "#ffffff";\n    }\n}`,
        props: [
          {
            label: 'Slide properties',
            rows: [
              { name: 'id', accepts: 'quoted id', fallback: 's1, s2 …' },
              { name: 'background', accepts: 'color', fallback: '"#ffffff"' },
              { name: 'backgroundImage', accepts: 'quoted image URL or data URL', fallback: 'none' },
              { name: 'width', accepts: 'number, at least 320', fallback: '1920' },
              { name: 'height', accepts: 'number, at least 320', fallback: '1080' },
              { name: 'notes', accepts: 'quoted text', fallback: '""' },
              { name: 'transition { }', accepts: 'block', fallback: 'none' },
            ],
          },
        ],
        keywords: ['slide', 'new', 'deck', 'block', 'background', 'notes', 'speaker'],
      },
      {
        title: 'Slide transition',
        description:
          'How one slide gives way to the next. Sits directly inside the slide block, beside the elements.',
        aliases: ['transition { … }'],
        snippet: `transition {\n    type: "fade";\n    direction: "right";\n    duration: 400;\n    easing: "easeOut";\n}`,
        props: [
          {
            label: 'Transition properties',
            rows: [
              { name: 'type', accepts: 'none · fade · slide · push · zoom', fallback: 'none' },
              { name: 'direction', accepts: 'up · down · left · right', fallback: 'right' },
              { name: 'duration', accepts: 'milliseconds', fallback: '400' },
              {
                name: 'easing',
                accepts: 'linear · ease · easeIn · easeOut · easeInOut · backOut',
                fallback: 'easeOut',
              },
            ],
          },
        ],
        keywords: ['transition', 'fade', 'slide', 'push', 'zoom'],
      },
    ],
  },
  {
    title: 'Elements',
    entries: [
      {
        title: 'Every element',
        description:
          'These keys work on every element type, whatever comes before them. The connector and the pen are the exceptions: their boxes come from their endpoints and points, so neither takes x, y, width or height, and a connector takes no rotation or opacity either.',
        aliases: ['shared keys'],
        snippet: `x: 120;\ny: 90;\nwidth: 480;\nheight: 240;\nrotation: 0;   // degrees\nopacity: 1;    // 0 to 1\nlocked: false;\nhidden: false;`,
        props: [
          {
            label: 'Placement',
            rows: [
              { name: 'x', accepts: 'number', fallback: '0' },
              { name: 'y', accepts: 'number', fallback: '0' },
              { name: 'width', accepts: 'number', fallback: 'depends on type' },
              { name: 'height', accepts: 'number', fallback: 'depends on type' },
              { name: 'rotation', accepts: 'degrees', fallback: '0' },
              { name: 'opacity', accepts: 'number, 0 to 1', fallback: '1' },
            ],
          },
          {
            label: 'Identity',
            rows: [
              { name: 'id', accepts: 'quoted id, right after the keyword', fallback: 'e1, c1 …' },
              { name: 'name', accepts: 'quoted label shown in Layers', fallback: 'none' },
              { name: 'group', accepts: 'quoted group id', fallback: 'none' },
              { name: 'members', accepts: 'list of element ids', fallback: 'none' },
            ],
          },
          {
            label: 'State',
            rows: [
              { name: 'locked', accepts: 'true / false', fallback: 'false' },
              { name: 'hidden', accepts: 'true / false', fallback: 'false' },
            ],
          },
          {
            label: 'Motion',
            rows: [{ name: 'animate { }', accepts: 'block, repeat as needed', fallback: 'none' }],
          },
        ],
        keywords: ['property', 'move', 'resize', 'size', 'rotate', 'opacity', 'lock', 'hide', 'name'],
      },
      {
        title: 'Shapes',
        description:
          'One keyword per shape, all with the same properties. A shape can carry a text label: the text { } block takes every text key listed further down.',
        aliases: [
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
        ],
        snippet: `rect "e3" {\n    x: 100; y: 100; width: 360; height: 200;\n    fill: "#4c9aff"; radius: 16;\n    stroke: "#1f4b8f"; strokeWidth: 2;\n    text { content: "Card"; fontSize: 28; color: "#ffffff"; }\n}`,
        props: [
          {
            label: 'Shape properties',
            rows: [
              { name: 'x', accepts: 'number', fallback: '0' },
              { name: 'y', accepts: 'number', fallback: '0' },
              { name: 'width', accepts: 'number', fallback: '320' },
              { name: 'height', accepts: 'number', fallback: '180' },
              { name: 'fill', accepts: 'color or linear-gradient(…)', fallback: '"#4c9aff"' },
              { name: 'stroke', accepts: 'color or none', fallback: 'none' },
              { name: 'strokeWidth', accepts: 'number', fallback: '0' },
              { name: 'dash', accepts: 'number, 0 is solid', fallback: '0' },
              { name: 'radius', accepts: 'number, corner rounding', fallback: '8 (rect), else 0' },
              { name: 'shadow { }', accepts: 'block: x · y · blur · color', fallback: 'none' },
              { name: 'text { }', accepts: 'block: any text key', fallback: 'none' },
            ],
          },
        ],
        shared: GEOMETRY_SHARED,
        keywords: ['shape', 'rectangle', 'box', 'circle', 'ellipse', 'triangle', 'card', 'polygon', 'star'],
      },
      {
        title: 'Text',
        description:
          'The workhorse. Line breaks inside the quotes become new lines. Width becomes the wrap width once set; Shrink to fit steps the font down until the text fits its box.',
        aliases: ['text "e1" { … }'],
        snippet: `text "e2" {\n    x: 120; y: 420; width: 900;\n    content: "First line\\nSecond line";\n    fontFamily: "Inter, system-ui, sans-serif";\n    fontSize: 32; fontWeight: 400;\n    align: "left"; lineHeight: 1.3;\n    color: "#e6e8ec";\n}`,
        props: [
          {
            label: 'Content',
            rows: [
              { name: 'content', accepts: 'quoted text, \\n for a new line', fallback: '""' },
              { name: 'math', accepts: 'true / false — render $…$ as KaTeX', fallback: 'false' },
            ],
          },
          {
            label: 'Typography',
            rows: [
              { name: 'fontFamily', accepts: 'quoted font stack', fallback: 'Inter, system-ui, sans-serif' },
              { name: 'fontSize', accepts: 'number', fallback: '32' },
              { name: 'fontWeight', accepts: '100 – 900', fallback: '400' },
              { name: 'italic', accepts: 'true / false', fallback: 'false' },
              { name: 'underline', accepts: 'true / false', fallback: 'false' },
              { name: 'align', accepts: 'left · center · right', fallback: 'left' },
              { name: 'lineHeight', accepts: 'multiple of the font size', fallback: '1.25' },
              { name: 'letterSpacing', accepts: 'number, in px', fallback: '0' },
              { name: 'color', accepts: 'color', fallback: '"#1a1b1e"' },
              { name: 'autofit', accepts: 'true / false — shrink to fit', fallback: 'false' },
            ],
          },
        ],
        shared: GEOMETRY_SHARED,
        keywords: ['text', 'title', 'paragraph', 'font', 'copy', 'heading', 'label'],
      },
      {
        title: 'Math (LaTeX)',
        description:
          'Any KaTeX expression, written as a quoted string so backslashes need doubling. displayMode centres the formula; turn it off for math that sits inline.',
        aliases: ['latex "e4" { … }'],
        snippet: `latex "e4" {\n    x: 140; y: 320;\n    content: "\\\\sum_{i=1}^{n} i = \\\\frac{n(n+1)}{2}";\n    displayMode: true; fontSize: 40;\n    color: "#1a1b1e";\n}`,
        props: [
          {
            label: 'Formula properties',
            rows: [
              { name: 'content', accepts: 'quoted KaTeX expression', fallback: '""' },
              { name: 'displayMode', accepts: 'true / false', fallback: 'true' },
              { name: 'fontSize', accepts: 'number', fallback: '32' },
              { name: 'color', accepts: 'color', fallback: '"#1a1b1e"' },
            ],
          },
        ],
        shared: GEOMETRY_SHARED,
        keywords: ['math', 'latex', 'formula', 'equation', 'katex', 'displayMode'],
      },
      {
        title: 'Code block',
        description:
          'Syntax-highlighted code with real line numbers. The language is anything Prism recognises: typescript, python, bash, json, sql…',
        aliases: ['code "e5" { … }'],
        snippet: `code "e5" {\n    x: 120; y: 260; width: 900; height: 300;\n    content: "const total = items.length;";\n    language: "typescript"; fontSize: 18;\n    lineNumbers: true; theme: "dark";\n}`,
        props: [
          {
            label: 'Code properties',
            rows: [
              { name: 'content', accepts: 'quoted source, \\n between lines', fallback: '""' },
              { name: 'language', accepts: 'typescript · python · bash · json · sql · …', fallback: 'typescript' },
              { name: 'theme', accepts: 'dark · light', fallback: 'dark' },
              { name: 'fontSize', accepts: 'number', fallback: '18' },
              { name: 'lineNumbers', accepts: 'true / false', fallback: 'true' },
              { name: 'color', accepts: 'color, plain text', fallback: '"#e6e6e6"' },
              { name: 'background', accepts: 'color, panel behind the code', fallback: '"#1e1e1e"' },
            ],
          },
        ],
        shared: GEOMETRY_SHARED,
        keywords: ['code', 'snippet', 'syntax', 'programming', 'language', 'lineNumbers'],
      },
      {
        title: 'Image',
        description:
          'Use a web URL or a data URL — the toolbar image button embeds the file for you, so an exported .slide keeps its pictures. An empty src draws a placeholder box.',
        aliases: ['image "e6" { … }'],
        snippet: `image "e6" {\n    x: 960; y: 200; width: 720; height: 400;\n    src: "https://example.com/chart.png";\n    fit: "cover"; radius: 12;\n}`,
        props: [
          {
            label: 'Image properties',
            rows: [
              { name: 'src', accepts: 'quoted URL or data URL', fallback: '""' },
              { name: 'fit', accepts: 'contain · cover · fill', fallback: 'contain' },
              { name: 'radius', accepts: 'number, corner rounding', fallback: '0' },
            ],
          },
        ],
        shared: GEOMETRY_SHARED,
        keywords: ['image', 'picture', 'photo', 'logo', 'screenshot', 'fit'],
      },
      {
        title: 'Chart',
        description:
          'A self-contained figure that redraws when you resize it. axes draws just the grid, plane adds the origin, graph adds a curve, barchart draws values.',
        aliases: ['figure "f1" { … }'],
        snippet: `figure "f1" {\n    x: 100; y: 200; width: 640; height: 420;\n    kind: "barchart";\n    title: "Quarterly reach";\n    values: [ 12, 28, 22, 40 ];\n    accentColor: "#4c9aff";\n}`,
        props: [
          {
            label: 'Figure properties',
            rows: [
              { name: 'kind', accepts: 'axes · plane · graph · barchart', fallback: 'graph' },
              { name: 'title', accepts: 'quoted caption above the plot', fallback: '""' },
              { name: 'fn', accepts: 'line · quadratic · cubic · sine · exp', fallback: 'quadratic' },
              { name: 'a', accepts: 'number, first coefficient', fallback: '1' },
              { name: 'b', accepts: 'number, second coefficient', fallback: '0' },
              { name: 'c', accepts: 'number, third coefficient', fallback: '0' },
              { name: 'domain', accepts: 'number, half of the x range', fallback: '5' },
              { name: 'values', accepts: 'list of numbers, barchart only', fallback: '[120, 200, 90, …]' },
              { name: 'axisColor', accepts: 'color', fallback: '"#1a1b1e"' },
              { name: 'gridColor', accepts: 'color', fallback: '"#d9dde3"' },
              { name: 'accentColor', accepts: 'color, bars and curve', fallback: '"#4c9aff"' },
              { name: 'titleColor', accepts: 'color', fallback: '"#1a1b1e"' },
            ],
          },
        ],
        shared: GEOMETRY_SHARED,
        keywords: ['chart', 'graph', 'bar', 'plot', 'data', 'figure', 'axis'],
      },
      {
        title: 'HTML embed',
        description:
          'A live external page, or inline HTML you write yourself. content wins when both are set; an embed with neither shows a placeholder and a warning in the Console.',
        aliases: ['html "e7" { … }'],
        snippet: `html "e7" {\n    x: 620; y: 220; width: 560; height: 480;\n    src: "https://example.com/live-widget";\n    radius: 8;\n}`,
        props: [
          {
            label: 'Embed properties',
            rows: [
              { name: 'src', accepts: 'quoted page URL', fallback: '""' },
              { name: 'content', accepts: 'quoted HTML source', fallback: '""' },
              { name: 'radius', accepts: 'number, corner rounding', fallback: '8' },
            ],
          },
        ],
        shared: GEOMETRY_SHARED,
        keywords: ['html', 'embed', 'iframe', 'widget', 'web'],
      },
      {
        title: 'Ink (pen)',
        description:
          'A freehand stroke. Its box is derived from the points, so x, y, width and height are never written — only rotation and opacity are independent.',
        aliases: ['pen "e8" { … }'],
        snippet: `pen "e8" {\n    color: "#1a1b1e"; width: 3;\n    smoothing: true; mode: "pen";\n    points: [\n        { x: 120; y: 200; pressure: 0.5; },\n        { x: 260; y: 240; pressure: 0.6; },\n    ];\n}`,
        props: [
          {
            label: 'Stroke properties',
            rows: [
              { name: 'color', accepts: 'color', fallback: '"#1a1b1e"' },
              { name: 'width', accepts: 'number, stroke thickness', fallback: '3' },
              { name: 'smoothing', accepts: 'true / false', fallback: 'true' },
              { name: 'mode', accepts: 'pen · highlighter', fallback: 'pen' },
              { name: 'points', accepts: 'list of { x; y; pressure; tiltX; tiltY; }', fallback: 'required' },
            ],
          },
        ],
        shared: PEN_SHARED,
        keywords: ['pen', 'ink', 'draw', 'freehand', 'highlighter', 'stroke', 'points'],
      },
      {
        title: 'Connector',
        description:
          'An arrow between two elements. Endpoints are "elementId:port" or a free { x; y; } point, so a connector can also run to empty canvas. Replace the ids below with your own.',
        aliases: ['connector "c1" { … }'],
        snippet: `connector "c1" {\n    from: "e1:right";\n    to: "e2:left";\n    routing: "elbow";\n    endArrow: "triangle";\n    color: "#4c9aff";\n    label: "then";\n}`,
        props: [
          {
            label: 'Connector properties',
            rows: [
              { name: 'from', accepts: '"id:port" or { x; y; }', fallback: 'required' },
              { name: 'to', accepts: '"id:port" or { x; y; }', fallback: 'required' },
              { name: 'routing', accepts: 'straight · elbow · curved', fallback: 'elbow' },
              { name: 'startArrow', accepts: 'none · triangle · open · diamond · circle · bar', fallback: 'none' },
              { name: 'endArrow', accepts: 'none · triangle · open · diamond · circle · bar', fallback: 'triangle' },
              { name: 'arrowSize', accepts: 'number', fallback: '14' },
              { name: 'width', accepts: 'number, line thickness', fallback: '3' },
              { name: 'dash', accepts: 'number, 0 is solid', fallback: '0' },
              { name: 'color', accepts: 'color', fallback: '"#4c9aff"' },
              { name: 'label', accepts: 'quoted text on the line', fallback: '""' },
            ],
          },
          {
            label: 'Ports and points',
            columns: ['Port', 'Means', 'Example'],
            rows: [
              { name: 'top · bottom', accepts: 'top or bottom edge midpoint', fallback: '"e1:top"' },
              { name: 'left · right', accepts: 'side midpoint', fallback: '"e2:left"' },
              { name: 'auto', accepts: 'the closest side, chosen for you', fallback: '"e3"' },
              { name: 'free point', accepts: 'fixed canvas coordinates', fallback: '{ x: 400; y: 120; }' },
            ],
          },
        ],
        shared: CONNECTOR_SHARED,
        keywords: ['arrow', 'connector', 'line', 'link', 'flow', 'port', 'from', 'to'],
      },
    ],
  },
  {
    title: 'Motion',
    entries: [
      {
        title: 'Animate an element',
        description:
          'Sits inside the element block, after its properties, and repeats for each step. Enter effects reveal, exit effects remove, emphasis effects draw attention.',
        aliases: ['animate { … }'],
        snippet: `animate {\n    effect: "fadeIn";\n    trigger: "onClick";\n    duration: 500;   // ms\n    delay: 0;        // ms\n    easing: "easeOut";\n    direction: "up";\n    repeat: 1;\n}`,
        props: [
          {
            label: 'Animation properties',
            rows: [
              {
                name: 'effect',
                accepts: 'fadeIn · slideIn · zoomIn · drawLine · fadeOut · slideOut · zoomOut · pulse · bounce · spin · flash',
                fallback: 'fadeIn',
              },
              { name: 'trigger', accepts: 'onClick · withPrevious · afterPrevious', fallback: 'afterPrevious' },
              { name: 'duration', accepts: 'milliseconds', fallback: '500' },
              { name: 'delay', accepts: 'milliseconds', fallback: '0' },
              {
                name: 'easing',
                accepts: 'linear · ease · easeIn · easeOut · easeInOut · backOut',
                fallback: 'easeOut',
              },
              { name: 'direction', accepts: 'up · down · left · right', fallback: 'up' },
              { name: 'repeat', accepts: 'number of plays', fallback: '1' },
              { name: 'id', accepts: 'quoted id', fallback: 'a1, a2 …' },
            ],
          },
        ],
        keywords: ['animate', 'animation', 'appear', 'reveal', 'build', 'effect', 'trigger'],
      },
    ],
  },
  {
    title: 'Values',
    entries: [
      {
        title: 'How values are written',
        description:
          'Every property takes one of seven kinds of value. Quoted text may span lines and understands \\\\, \\", \\n, \\r and \\t.',
        props: [
          {
            label: 'Value types',
            columns: ['Value', 'Write it as', 'Example'],
            rows: [
              { name: 'text', accepts: '"…" or `…`', fallback: '"Hello\\nworld"' },
              { name: 'number', accepts: 'digits, optional minus and decimal', fallback: '24, -1.5' },
              { name: 'boolean', accepts: 'true or false, no quotes', fallback: 'true' },
              {
                name: 'color',
                accepts: '#rgb · #rrggbb · #rrggbbaa · rgb() · hsl() · none',
                fallback: '"#4c9aff"',
              },
              {
                name: 'gradient',
                accepts: 'linear-gradient(angle, color, color)',
                fallback: '"linear-gradient(120deg, #4c9aff, #a855f7)"',
              },
              { name: 'list', accepts: 'values in square brackets', fallback: '[ 12, 28, 40 ]' },
              { name: 'block', accepts: 'a name followed by { … }', fallback: 'text { … }' },
            ],
          },
        ],
        keywords: ['value', 'string', 'number', 'boolean', 'color', 'list', 'gradient', 'quote'],
      },
    ],
  },
];

const TIPS: CodeHelpEntry[] = [
  {
    title: 'Ids connect things',
    description:
      'Ids such as e1, c1 and a1 are permanent. Connectors, animations and groups refer to them, so renaming an id means updating every reference.',
    keywords: ['id', 'reference', 'stable'],
  },
  {
    title: 'Punctuation matters',
    description:
      'Every property ends with a semicolon, blocks end with a closing brace, and strings need quotes. Comments are // to end of line or /* … */.',
    keywords: ['syntax', 'semicolon', 'quotes', 'comment', 'format'],
  },
  {
    title: 'Unknown keys only warn',
    description:
      'A misspelled property is reported in the Console and ignored, so the rest of the slide still renders. Unknown values fall back to the default.',
    keywords: ['typo', 'warning', 'console', 'invalid', 'unknown'],
  },
  {
    title: 'Edits apply when you pause',
    description:
      'The editor compiles about a quarter second after you stop typing. If the script is invalid, the deck stays exactly as it was and the Console names the line.',
    keywords: ['save', 'apply', 'error', 'compile', 'invalid'],
  },
  {
    title: 'The GUI rewrites this script',
    description:
      'Dragging on the canvas or changing a property regenerates the code. Only edit by hand when you want the canvas to stay untouched.',
    keywords: ['gui', 'canvas', 'regenerate', 'sync'],
  },
  {
    title: 'Shortcuts',
    description:
      'Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z redo, Ctrl/Cmd+D duplicate, Ctrl/Cmd+G group, Ctrl/Cmd+A select all, Ctrl/Cmd+0 fit the canvas, arrows nudge (Shift for 10px), F5 present from the start, Shift+F5 from this slide. Tools: V select, R rect, E ellipse, T text, L LaTeX, C code, P pen.',
    keywords: ['keyboard', 'shortcut', 'undo', 'redo', 'present', 'group', 'nudge'],
  },
];

const PROP_COLUMNS: [string, string, string] = ['Property', 'Accepts', 'Default'];

function normalize(value: string): string {
  return value.toLowerCase();
}

function rowMatches(row: PropRow, query: string): boolean {
  if (!query) return false;
  return normalize(`${row.name} ${row.accepts} ${row.fallback ?? ''}`).includes(query);
}

function matches(entry: CodeHelpEntry, query: string): boolean {
  if (!query) return true;
  const haystack = normalize(
    [
      entry.title,
      entry.description,
      entry.snippet ?? '',
      ...(entry.aliases ?? []),
      ...(entry.shared ?? []),
      ...(entry.keywords ?? []),
      ...(entry.props ?? []).flatMap((group) =>
        group.rows.flatMap((row) => [row.name, row.accepts, row.fallback ?? '']),
      ),
    ].join(' '),
  );
  return query
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Clipboard permission can be denied; fall back to a selection copy.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
}

function PropertyTable({
  group,
  query,
}: {
  group: PropGroup;
  query: string;
}) {
  const [first, second, third] = group.columns ?? PROP_COLUMNS;
  return (
    <div className="code-help-propgroup">
      <h5 className="code-help-propgroup-label">{group.label}</h5>
      <table className="code-help-proptable">
        <thead>
          <tr>
            <th scope="col">{first}</th>
            <th scope="col">{second}</th>
            <th scope="col">{third}</th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((row) => (
            <tr
              key={row.name}
              className={rowMatches(row, query) ? 'is-match' : undefined}
            >
              <th scope="row">{row.name}</th>
              <td>{row.accepts}</td>
              <td className={row.fallback ? undefined : 'is-empty'}>{row.fallback ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CodeHelp({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Close on Escape before the global editor shortcuts see the key, so the
  // canvas selection is left alone while the reference is open.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  useEffect(() => {
    if (!copied && !copyFailed) return;
    const handle = window.setTimeout(() => {
      setCopied(null);
      setCopyFailed(null);
    }, 2000);
    return () => window.clearTimeout(handle);
  }, [copied, copyFailed]);

  const trimmed = normalize(query.trim());
  const sections = useMemo(
    () =>
      CODE_HELP_SECTIONS.map((section) => ({
        title: section.title,
        entries: section.entries.filter((entry) => matches(entry, trimmed)),
      })).filter((section) => section.entries.length > 0),
    [trimmed],
  );
  const tips = useMemo(() => TIPS.filter((entry) => matches(entry, trimmed)), [trimmed]);
  const resultCount =
    sections.reduce((total, section) => total + section.entries.length, 0) + tips.length;
  const totalCount =
    CODE_HELP_SECTIONS.reduce((total, section) => total + section.entries.length, 0) + TIPS.length;
  const propertyCount = useMemo(
    () =>
      CODE_HELP_SECTIONS.reduce(
        (total, section) =>
          total +
          section.entries.reduce(
            (sum, entry) =>
              sum + (entry.props ?? []).reduce((n, group) => n + group.rows.length, 0),
            0,
          ),
        0,
      ),
    [],
  );

  // Keep Tab inside the reference: it is modal, so tabbing into the editor
  // behind the backdrop would strand keyboard users out of sight.
  const trapTab = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>('button, input, [tabindex="0"]'),
    ).filter((element) => !element.hasAttribute('disabled'));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleCopy = async (entry: CodeHelpEntry) => {
    if (!entry.snippet) return;
    const ok = await copyText(entry.snippet);
    setCopied(ok ? entry.title : null);
    setCopyFailed(ok ? null : entry.title);
  };

  return (
    <div
      className="code-help-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="code-help"
        role="dialog"
        aria-modal="true"
        aria-labelledby="code-help-title"
        ref={dialogRef}
        onKeyDown={trapTab}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="code-help-head">
          <div className="code-help-heading">
            <h2 id="code-help-title">Script reference</h2>
            <p>
              Every element, every property it accepts, and a copyable example —{' '}
              {propertyCount} properties in all.
            </p>
          </div>
          <button className="panel-collapse" onClick={onClose} aria-label="Close help" type="button">
            <X size={15} />
          </button>
        </header>

        <div className="code-help-search">
          <Search size={14} className="code-help-search-icon" aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search elements or properties — arrow, fontSize, fill…"
            aria-label="Search script commands"
          />
          {query && (
            <button
              className="code-help-search-clear"
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
              aria-label="Clear search"
              type="button"
            >
              <X size={12} />
            </button>
          )}
          <span className="code-help-count" role="status" aria-live="polite">
            {trimmed ? `${resultCount} of ${totalCount}` : `${totalCount} topics`}
          </span>
        </div>

        <div className="code-help-body">
          {resultCount === 0 && (
            <div className="code-help-empty">
              <p>No commands match “{query.trim()}”.</p>
              <p className="code-help-empty-hint">
                Try a broader word such as text, fontSize, color, arrow or animate.
              </p>
            </div>
          )}

          {sections.map((section) => (
            <section className="code-help-section" key={section.title}>
              <h3>{section.title}</h3>
              {section.entries.map((entry) => (
                <article className="code-help-entry" key={entry.title}>
                  <div className="code-help-entry-head">
                    <div className="code-help-entry-heading">
                      <h4>{entry.title}</h4>
                      {entry.aliases && entry.aliases.length > 0 && (
                        <p className="code-help-aliases">
                          {entry.aliases.map((alias) => (
                            <code key={alias}>{alias}</code>
                          ))}
                        </p>
                      )}
                    </div>
                    {entry.snippet && (
                      <button
                        className={`code-help-copy ${copied === entry.title ? 'is-copied' : ''}`}
                        onClick={() => handleCopy(entry)}
                        type="button"
                      >
                        {copied === entry.title ? <Check size={12} /> : <Copy size={12} />}
                        <span>
                          {copied === entry.title
                            ? 'Copied'
                            : copyFailed === entry.title
                              ? 'Copy failed'
                              : 'Copy'}
                        </span>
                      </button>
                    )}
                  </div>
                  <p className="code-help-desc">{entry.description}</p>
                  {entry.snippet && <pre className="code-help-snippet">{entry.snippet}</pre>}
                  {entry.props?.map((group) => (
                    <PropertyTable group={group} query={trimmed} key={group.label} />
                  ))}
                  {entry.shared && (
                    <p className="code-help-shared">
                      <span>Also accepts:</span>
                      {entry.shared.map((key) => (
                        <code key={key}>{key}</code>
                      ))}
                    </p>
                  )}
                </article>
              ))}
            </section>
          ))}

          {tips.length > 0 && (
            <section className="code-help-section">
              <h3>Good to know</h3>
              {tips.map((entry) => (
                <article className="code-help-entry" key={entry.title}>
                  <h4>{entry.title}</h4>
                  <p className="code-help-desc">{entry.description}</p>
                </article>
              ))}
            </section>
          )}
        </div>

        <footer className="code-help-foot">
          <span>
            <kbd>Esc</kbd> closes this reference
          </span>
          <span>Paste a snippet inside a slide block, then adjust the numbers.</span>
        </footer>
      </div>
    </div>
  );
}
