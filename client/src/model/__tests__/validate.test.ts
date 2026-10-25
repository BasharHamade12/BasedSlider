import { describe, expect, it } from 'vitest';
import { createConnector, createEmptyDoc, createImage, createPen, createShape } from '../factories';
import { validateDoc, normalizeDoc } from '../validate';

describe('validation', () => {
  it('reports duplicate element ids', () => {
    const doc = createEmptyDoc();
    doc.slides[0].elements = [
      createShape('rect', 'e1', { x: 0, y: 0 }),
      createShape('ellipse', 'e1', { x: 10, y: 10 }),
    ];
    const errors = validateDoc(doc).filter((item) => item.severity === 'error');
    expect(errors.some((item) => item.message.includes('Duplicate element id'))).toBe(true);
  });

  it('reports negative dimensions', () => {
    const doc = createEmptyDoc();
    const shape = createShape('rect', 'e1', { x: 0, y: 0 });
    shape.width = -4;
    doc.slides[0].elements = [shape];
    expect(validateDoc(doc).some((item) => item.message.includes('negative'))).toBe(true);
  });

  it('reports dangling connector references but normalizes them to points', () => {
    const doc = createEmptyDoc();
    doc.slides[0].elements = [
      createConnector('c1', {
        from: { kind: 'element', elementId: 'missing', port: 'auto' },
        to: { kind: 'point', x: 10, y: 10 },
      }),
    ];

    const errors = validateDoc(doc).filter((item) => item.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);

    const normalized = normalizeDoc(doc);
    expect(normalized.diagnostics.some((item) => item.severity === 'warning')).toBe(true);
    expect(validateDoc(normalized.doc).filter((item) => item.severity === 'error')).toHaveLength(0);
    const connector = normalized.doc.slides[0].elements[0];
    expect(connector.type === 'connector' && connector.from.kind).toBe('point');
  });

  it('warns about an unknown image fit and an empty source', () => {
    const doc = createEmptyDoc();
    const image = createImage('e1', { x: 0, y: 0 });
    (image as { fit: string }).fit = 'stretch';
    doc.slides[0].elements = [image];
    const warnings = validateDoc(doc).filter((item) => item.severity === 'warning');
    expect(warnings.some((item) => item.message.includes('image fit'))).toBe(true);
    expect(warnings.some((item) => item.message.includes('no source'))).toBe(true);
  });

  it('recomputes pen bounds from its points', () => {
    const pen = createPen('e1', [
      { x: 50, y: 60, pressure: 0.5 },
      { x: 150, y: 160, pressure: 0.5 },
    ]);
    pen.x = 999;
    pen.y = 999;
    pen.width = 1;
    pen.height = 1;
    const doc = createEmptyDoc();
    doc.slides[0].elements = [pen];

    const normalized = normalizeDoc(doc);
    const fixed = normalized.doc.slides[0].elements[0];
    expect(fixed.type === 'pen' && fixed.x).toBe(50);
    expect(fixed.type === 'pen' && fixed.width).toBe(100);
  });

  it('gives legacy pen strokes without strokeWidth a sane thickness', () => {
    const pen = createPen('e1', [
      { x: 10, y: 10, pressure: 0.5 },
      { x: 110, y: 10, pressure: 0.5 },
    ]);
    const legacy = { ...pen, strokeWidth: undefined } as unknown as typeof pen;
    const doc = createEmptyDoc();
    doc.slides[0].elements = [legacy];

    const fixed = normalizeDoc(doc).doc.slides[0].elements[0];
    expect(fixed.type === 'pen' && fixed.strokeWidth).toBe(3);
    expect(fixed.type === 'pen' && fixed.width).toBe(100);
  });
});
