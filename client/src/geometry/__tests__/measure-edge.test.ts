import { beforeEach, describe, expect, it } from 'vitest';
import { createTextBlock, createShape } from '../../model/factories';
import { clearMeasureCache, fontFor, measureTextBlock, wrapText } from '../measure';

describe('text measurement edge cases', () => {
  beforeEach(() => clearMeasureCache());

  it('never returns a negative measured width', () => {
    const block = createTextBlock({ fontSize: 24, content: 'OK' });
    const measured = measureTextBlock(block, 50, 100);
    expect(measured.width).toBeGreaterThanOrEqual(0);
    expect(measured.height).toBeGreaterThanOrEqual(0);
  });

  it('wraps a single unbreakable long word onto one line without throwing', () => {
    const block = createTextBlock({ fontSize: 20 });
    const font = fontFor(block);
    const lines = wrapText('supercalifragilistic', 2, font, 20);
    expect(lines.length).toBeGreaterThanOrEqual(1);
  });

  it('returns a single empty line for empty content', () => {
    const block = createTextBlock({ fontSize: 20, content: '' });
    const measured = measureTextBlock(block, 50, 100);
    expect(measured.lines).toEqual(['']);
  });

  it('keeps shape label text visible against plain boxes', () => {
    const shape = createShape('rect', 'e1', { x: 0, y: 0, width: 200, height: 120 }, {
      text: createTextBlock({ content: 'Hello', fontSize: 24, color: '#111111' }),
    });
    expect(shape.text).not.toBeNull();
    const measured = measureTextBlock(shape.text!, Math.max(8, shape.width), Math.max(8, shape.height));
    expect(measured.lines[0]).toBe('Hello');
  });
});
