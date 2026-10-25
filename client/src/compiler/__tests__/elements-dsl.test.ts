import { describe, expect, it } from 'vitest';
import { compile } from '../index';
import { serializeDoc } from '../../model/serialize';
import { shapePath } from '../../geometry/shapes';
import { isShape } from '../../model/types';
import {
  createEmptyDoc,
  createHtmlEmbed,
  createLatex,
  createElementOfType,
} from '../../model/factories';
import { validateDoc } from '../../model/validate';
import { Doc } from '../../model/types';

const LATEX_COLOR = `slide "Math" {
    latex "e1" {
        x: 10; y: 10;
        content: "\\frac{a}{b}";
        color: "#0f62fe";
    }
}
`;

const LATEX_DEFAULT = `slide "Math" {
    latex "e1" {
        x: 10; y: 10;
        content: "\\frac{a}{b}";
    }
}
`;

const URL_EMBED = `slide "Embeds" {
    html "e1" {
        x: 40;
        y: 60;
        width: 640;
        height: 480;
        src: "https://example.com/widget";
        radius: 20;
        locked: true;
    }
}
`;

const SOURCE_EMBED = `slide "Embeds" {
    html "e1" {
        x: 0;
        y: 0;
        content: "<!doctype html>\\n<html><h1>Hi \\"there\\"</h1></html>";
    }
}
`;

function compileSlide(source: string): Doc {
  const result = compile(source);
  expect(result.errors.filter((item) => item.severity === 'error')).toEqual([]);
  expect(result.doc).not.toBeNull();
  return result.doc!;
}

const FIGURE_GROUP = `slide "Figures" {
    figure "e1" {
        x: 80; y: 90; width: 560; height: 380;
        kind: "graph";
        title: "Sine wave";
        fn: "sine";
        a: 2; b: 1.5; c: 0.5;
        domain: 8;
        accentColor: "#ff8800";
        group: "g1";
        members: [ "e2", "e3" ];
    }
    rect "e2" {
        x: 0; y: 0; width: 50; height: 50;
        group: "g1";
    }
    text "e3" {
        x: 0; y: 700; width: 200; height: 60;
        content: "caption";
        group: "g1";
    }
}
`;

describe('figure element and groups in the DSL', () => {
  it('parses figure properties and lead/member groups', () => {
    const doc = compileSlide(FIGURE_GROUP);
    const figure = doc.slides[0].elements.find((el) => el.id === 'e1');
    expect(figure?.type).toBe('figure');
    if (figure?.type === 'figure') {
      expect(figure.kind).toBe('graph');
      expect(figure.title).toBe('Sine wave');
      expect(figure.fn).toBe('sine');
      expect(figure.a).toBe(2);
      expect(figure.b).toBe(1.5);
      expect(figure.c).toBe(0.5);
      expect(figure.domain).toBe(8);
      expect(figure.accentColor).toBe('#ff8800');
    }
    const lead = doc.slides[0].elements.find((el) => el.id === 'e1');
    expect(lead?.group).toBe('g1');
    expect(lead?.members).toEqual(['e2', 'e3']);
    expect(doc.slides[0].elements.find((el) => el.id === 'e2')?.group).toBe('g1');
    expect(doc.slides[0].elements.find((el) => el.id === 'e2')?.members).toBeUndefined();
  });

  it('survives a serialize → compile roundtrip as one object', () => {
    const doc = compileSlide(FIGURE_GROUP);
    const source = serializeDoc(doc);
    const reparsed = compileSlide(source);
    expect(JSON.stringify(reparsed.slides)).toEqual(JSON.stringify(doc.slides));
  });

  it('flags a members list pointing at a missing element', () => {
    const source = FIGURE_GROUP.replace('"e2", "e3"', '"e2", "e9"');
    const result = compile(source);
    const errors = result.errors.filter((item) => item.severity === 'error');
    expect(errors.some((error) => error.message.includes('e9'))).toBe(true);
  });

  it('rejects an unknown figure kind with a parse warning and falls back to graph', () => {
    const source = FIGURE_GROUP.replace('kind: "graph"', 'kind: "spiral"');
    const result = compile(source);
    const figure = result.doc?.slides[0]?.elements.find((el) => el.id === 'e1');
    if (figure?.type === 'figure') expect(figure.kind).toBe('graph');
  });
});

describe('html embed', () => {
  it('parses geometry, src, radius and locked', () => {
    const doc = compileSlide(URL_EMBED);
    const embed = doc.slides[0].elements[0];
    expect(embed.type).toBe('html');
    if (embed.type === 'html') {
      expect(embed.x).toBe(40);
      expect(embed.y).toBe(60);
      expect(embed.width).toBe(640);
      expect(embed.height).toBe(480);
      expect(embed.src).toBe('https://example.com/widget');
      expect(embed.content).toBe('');
      expect(embed.radius).toBe(20);
      expect(embed.locked).toBe(true);
      expect(embed.reloadToken).toBe(0);
    }
  });

  it('parses escaped inline HTML content', () => {
    const doc = compileSlide(SOURCE_EMBED);
    const embed = doc.slides[0].elements[0];
    if (embed.type === 'html') {
      expect(embed.content).toBe('<!doctype html>\n<html><h1>Hi "there"</h1></html>');
      expect(embed.src).toBe('');
      // Radius falls back to the factory default of 8 when omitted.
      expect(embed.radius).toBe(8);
    }
  });

  it('parses and round-trips text math mode', () => {
    const doc = compileSlide(
      `slide "Math text" {\n          text "e1" {\n              x: 10; y: 10; width: 400; height: 100;\n              content: "Solve $x^2 = 4$ now";\n              math: true;\n          }\n      }\n      `,
    );
    const text = doc.slides[0].elements[0];
    expect(text.type === 'text' && text.text.math).toBe(true);
    const textElement = doc.slides[0].elements[0];
    expect(textElement.type === 'text' && textElement.text.content).toBe('Solve $x^2 = 4$ now');
    const source = serializeDoc(doc);
    expect(source).toContain('math: true;');
    expect(compile(source).doc?.slides[0].elements[0]).toEqual(textElement);
  });

  it('round-trips through the serializer unchanged', () => {
    const doc = compileSlide(URL_EMBED);
    const source = serializeDoc(doc);
    expect(source).toContain('html "e1" {');
    expect(source).toContain('src: "https://example.com/widget";');
    expect(compile(source).doc?.slides[0].elements[0]).toEqual(doc.slides[0].elements[0]);
  });

  it('prefers content over src in both directions', () => {
    const doc = compileSlide(SOURCE_EMBED);
    const source = serializeDoc(doc);
    expect(source).toContain('content: "<!doctype html>');
    expect(source).not.toContain('src:');
    expect(compile(source).doc?.slides[0].elements[0]).toEqual(doc.slides[0].elements[0]);
  });

  it('warns only when both or neither source is present', () => {
    const both = createEmptyDoc();
    both.slides[0].elements = [
      createHtmlEmbed('e1', { x: 0, y: 0 }, { src: 'https://a', content: '<p>x</p>' }),
    ];
    expect(
      validateDoc(both).filter(
        (item) => item.elementId === 'e1' && item.severity === 'warning' && item.message.startsWith('src:'),
      ),
    ).toHaveLength(1);

    const neither = createEmptyDoc();
    neither.slides[0].elements = [createHtmlEmbed('e1', { x: 0, y: 0 })];
    expect(
      validateDoc(neither).filter(
        (item) => item.elementId === 'e1' && item.severity === 'warning' && item.message.startsWith('src:'),
      ),
    ).toHaveLength(1);

    const justSrc = createEmptyDoc();
    justSrc.slides[0].elements = [
      createHtmlEmbed('e1', { x: 0, y: 0 }, { src: 'https://a' }),
    ];
    expect(validateDoc(justSrc).filter((item) => item.severity === 'warning')).toEqual([]);
  });

  it('rejects a negative radius', () => {
    const doc = createEmptyDoc();
    const embed = createHtmlEmbed('e1', { x: 0, y: 0 });
    embed.radius = -3;
    doc.slides[0].elements = [embed];
    expect(validateDoc(doc).some((item) => item.message.includes('radius'))).toBe(true);
  });

  it('parses a custom latex color and serializes it back', () => {
    const doc = compileSlide(LATEX_COLOR);
    const latex = doc.slides[0].elements[0];
    expect(latex.type).toBe('latex');
    if (latex.type === 'latex') {
      expect(latex.color).toBe('#0f62fe');
    }
    const source = serializeDoc(doc);
    expect(source).toContain('color: "#0f62fe";');
    expect(compile(source).doc?.slides[0].elements[0]).toEqual(doc.slides[0].elements[0]);
  });

  it('omits the default latex color', () => {
    const doc = compileSlide(LATEX_DEFAULT);
    const latex = doc.slides[0].elements[0];
    expect(latex.type).toBe('latex');
    if (latex.type === 'latex') {
      expect(latex.color).toBe('#1a1b1e');
    }
    expect(serializeDoc(doc)).not.toContain('color:');
  });

  it('colors factory latex with the shared default', () => {
    expect(createLatex('e1', { x: 0, y: 0 }).color).toBe('#1a1b1e');
  });

  it('creates a factory embed with sane defaults', () => {
    const doc = createEmptyDoc();
    const embed = createElementOfType('html', doc, 100, 90);
    expect(embed.type).toBe('html');
    if (embed.type === 'html') {
      expect(embed.x).toBe(100);
      expect(embed.y).toBe(90);
      expect(embed.width).toBe(720);
      expect(embed.height).toBe(480);
      expect(embed.radius).toBe(8);
      expect(embed.src).toBe('');
      expect(embed.content).toBe('');
    }
  });
});

describe('extended shape kinds', () => {
  const SOURCE = `slide "Shapes" {
      arrow "e1" { x: 10; y: 10; width: 200; height: 100; }
      chevron "e2" { x: 10; y: 130; width: 200; height: 80; }
      parallelogram "e3" { x: 10; y: 230; width: 200; height: 80; }
      trapezoid "e4" { x: 10; y: 330; width: 200; height: 80; }
      speech "e5" { x: 10; y: 430; width: 240; height: 120; }
  }
  `;

  it('parses the five new kinds with valid geometry', () => {
    const doc = compileSlide(SOURCE);
    const kinds = doc.slides[0].elements.map((el) => el.type);
    expect(kinds).toEqual(['arrow', 'chevron', 'parallelogram', 'trapezoid', 'speech']);
    for (const element of doc.slides[0].elements) {
      if (!isShape(element)) continue;
      expect(shapePath(element)).toMatch(/^M/);
    }
  });

  it('survives a serialize → compile roundtrip', () => {
    const doc = compileSlide(SOURCE);
    const source = serializeDoc(doc);
    expect(compile(source).doc?.slides).toEqual(doc.slides);
  });
});
