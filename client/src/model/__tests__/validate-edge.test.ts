import { describe, expect, it } from 'vitest';
import { validateDoc, normalizeDoc, hasErrors } from '../validate';
import { createText, createShape, createConnector, createEmptyDoc } from '../factories';
import { Doc, Slide } from '../types';

describe('validate', () => {
  it('rejects an empty deck', () => {
    const doc = { slides: [] } as unknown as Doc;
    expect(hasErrors(validateDoc(doc))).toBe(true);
  });

  it('rejects a deck missing the slides array', () => {
    const doc = {} as Doc;
    expect(hasErrors(validateDoc(doc))).toBe(true);
  });

  it('rejects duplicate slide ids', () => {
    const e1 = createText('e1', { x: 0, y: 0, width: 100, height: 100 }, {}, { content: 'a' });
    const s1: Slide = {
      id: 's1',
      name: 's1',
      background: '#fff',
      notes: '',
      transition: { type: 'none', direction: 'right', duration: 0, easing: 'linear' },
      elements: [e1],
    };
    const s2: Slide = { ...s1, id: 's1' };
    const doc: Doc = { version: 2, title: 'Test', width: 1920, height: 1080, slides: [s1, s2] };
    expect(hasErrors(validateDoc(doc))).toBe(true);
  });

  it('rejects non-string slide names', () => {
    const doc = {
      version: 2,
      title: 'Test',
      width: 1920,
      height: 1080,
      slides: [
        {
          id: 's1',
          name: 123,
          background: '#fff',
          notes: '',
          transition: { type: 'none', direction: 'right', duration: 0, easing: 'linear' },
          elements: [],
        },
      ],
    } as unknown as Doc;
    expect(hasErrors(validateDoc(doc))).toBe(true);
  });

  it('normalizes a dangling connector target into a free point', () => {
    const good = createShape('rect', 'e1', { x: 0, y: 0, width: 100, height: 100 }, {});
    const conn = createConnector('c1', {
      from: { kind: 'element', elementId: 'e1', port: 'auto' },
      to: { kind: 'element', elementId: 'missing', port: 'auto' },
    });
    const doc = createEmptyDoc();
    doc.slides[0].elements = [good, conn];
    const { doc: normalized, diagnostics } = normalizeDoc(doc);
    const connector = normalized.slides[0].elements.find((el) => el.id === 'c1');
    expect(connector?.type).toBe('connector');
    expect(connector?.type === 'connector' && connector.to.kind).toBe('point');
    expect(diagnostics.some((d) => d.message.includes('missing'))).toBe(true);
  });
});

