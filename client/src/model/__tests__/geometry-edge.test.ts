import { describe, expect, it } from 'vitest';
import { normalizeDoc } from '../validate';
import { createConnector, createEmptyDoc, createShape } from '../factories';

describe('geometry edge', () => {
  it('normalizes dangling connector target to a free point', () => {
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
