import { describe, expect, it } from 'vitest';
import { serializeDoc } from '../serialize';
import { createEmptyDoc, createShape, createConnector, createPen, createImage, createCode } from '../factories';

describe('serialization edge cases', () => {
  it('produces deterministic output for the same document', () => {
    const doc = createEmptyDoc();
    doc.slides[0].elements = [
      createShape('rect', 'e1', { x: 10, y: 10, width: 100, height: 100 }),
    ];
    expect(serializeDoc(doc)).toBe(serializeDoc(doc));
  });

  it('drops default values from the canonical source', () => {
    const doc = createEmptyDoc();
    doc.slides[0].elements = [
      createShape('rect', 'e1', { x: 0, y: 0, width: 30, height: 30 }, {
        fill: '#4c9aff',
        stroke: 'none',
        strokeWidth: 0,
        dash: 0,
        radius: 8,
        shadow: null,
        text: null,
        locked: false,
        hidden: false,
        name: undefined,
        group: undefined,
      }),
    ];
    const source = serializeDoc(doc);
    expect(source).not.toContain('stroke: "none"');
    expect(source).not.toContain('strokeWidth: 0');
    expect(source).not.toContain('radius: 0');
    expect(source).toContain('rect "e1"');
  });

  it('escapes a slide name with quotes', () => {
    const doc = createEmptyDoc();
    doc.slides[0].name = 'Say "hi"';
    const source = serializeDoc(doc);
    expect(source).toContain('slide "Say \\"hi\\""');
  });

  it('serializes a pen with points and mode', () => {
    const doc = createEmptyDoc();
    doc.slides[0].elements = [
      createPen('e1', [
        { x: 0, y: 0, pressure: 0.5 },
        { x: 100, y: 100, pressure: 0.8, tiltX: 9 },
        { x: 200, y: 0, pressure: 0.5, tiltY: 3 },
      ], { mode: 'highlighter', color: '#e03131' }),
    ];
    const source = serializeDoc(doc);
    expect(source).toContain('pen "e1"');
    expect(source).toContain('mode: "highlighter"');
    expect(source).toContain('color: "#e03131"');
    expect(source).toContain('tiltX: 9');
    expect(source).toContain('tiltY: 3');
  });

  it('serializes connector endpoints in both forms', () => {
    const doc = createEmptyDoc();
    doc.slides[0].elements = [
      createShape('rect', 'e1', { x: 0, y: 0, width: 100, height: 60 }),
      createConnector('c1', {
        from: { kind: 'element', elementId: 'e1', port: 'right' },
        to: { kind: 'point', x: 300, y: 200 },
      }),
    ];
    const source = serializeDoc(doc);
    expect(source).toContain('from: "e1:right"');
    expect(source).toContain('to: { x: 300; y: 200; }');
  });

  it('serializes code block theme, language, and line numbers', () => {
    const doc = createEmptyDoc();
    doc.slides[0].elements = [
      createCode('e1', { x: 0, y: 0, width: 400, height: 200 }, {
        language: 'python',
        theme: 'light',
        fontSize: 14,
        lineNumbers: false,
        color: '#111111',
        background: '#fafafa',
        content: 'print("hi")',
      }),
    ];
    const source = serializeDoc(doc);
    expect(source).toContain('language: "python"');
    expect(source).toContain('theme: "light"');
    expect(source).toContain('lineNumbers: false');
  });

  it('serializes showLanguage only when the language label is hidden', () => {
    const doc = createEmptyDoc();
    doc.slides[0].elements = [createCode('e1', { x: 0, y: 0, width: 400, height: 200 })];
    expect(serializeDoc(doc)).not.toContain('showLanguage');

    doc.slides[0].elements = [
      createCode('e1', { x: 0, y: 0, width: 400, height: 200 }, { showLanguage: false }),
    ];
    expect(serializeDoc(doc)).toContain('showLanguage: false');
  });

  it('serializes image src and fit', () => {
    const doc = createEmptyDoc();
    doc.slides[0].elements = [
      createImage('e1', { x: 0, y: 0, width: 400, height: 200 }, {
        src: 'https://example.com/a.png',
        fit: 'cover',
        radius: 12,
      }),
    ];
    const source = serializeDoc(doc);
    expect(source).toContain('src: "https://example.com/a.png"');
    expect(source).toContain('fit: "cover"');
    expect(source).toContain('radius: 12');
  });
});
