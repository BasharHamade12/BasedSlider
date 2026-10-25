import { describe, expect, it } from 'vitest';
import { createTextBlock } from '../../model/factories';
import { clearMeasureCache, fontFor, measureTextBlock, wrapText } from '../measure';

describe('text measurement', () => {
  it('falls back to an estimate without a canvas context', () => {
    clearMeasureCache();
    const block = createTextBlock({ fontSize: 20 });
    const font = fontFor(block);
    const measured = measureTextBlock({ ...block, content: 'hello' }, 500);
    expect(measured.width).toBeGreaterThan(0);
    expect(font).toContain('20px');
  });

  it('wraps long lines and preserves explicit newlines', () => {
    const block = createTextBlock({ fontSize: 16 });
    const font = fontFor(block);
    const lines = wrapText('hello world this is a long line', 90, font, 16);
    expect(lines.length).toBeGreaterThan(1);

    const explicit = wrapText('first\nsecond', 500, font, 16);
    expect(explicit).toEqual(['first', 'second']);
  });

  it('shrinks font size when autofit is on', () => {
    const block = createTextBlock({
      content: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      fontSize: 48,
      autofit: true,
      lineHeight: 1.2,
    });
    const measured = measureTextBlock(block, 120, 200);
    expect(measured.fontSize).toBeLessThan(48);
    expect(measured.lines.length).toBeGreaterThan(1);
  });

  it('does not shrink when autofit is off', () => {
    const block = createTextBlock({ content: 'A very long line', fontSize: 48 });
    const measured = measureTextBlock(block, 100, 50);
    expect(measured.fontSize).toBe(48);
  });
});
