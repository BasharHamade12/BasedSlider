import { describe, expect, it } from 'vitest';
import { computeContentBounds, expandBounds } from '../contentBounds';

/** RGBA pixel buffer of `width` × `height`, every pixel set to `rgb`. */
function fill(width: number, height: number, rgb: [number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  }
  return data;
}

/** Paint one pixel (inclusive bounds). */
function paint(data: Uint8ClampedArray, width: number, x: number, y: number, rgb: [number, number, number] = [10, 10, 10]): void {
  const p = (y * width + x) * 4;
  data[p] = rgb[0];
  data[p + 1] = rgb[1];
  data[p + 2] = rgb[2];
}

/** Draw a solid rectangle of content pixels, inclusive bounds. */
function rect(data: Uint8ClampedArray, width: number, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) paint(data, width, x, y);
  }
}

describe('computeContentBounds', () => {
  it('returns null for a fully white page', () => {
    expect(computeContentBounds(fill(10, 8, [255, 255, 255]), 10, 8)).toBeNull();
  });

  it('returns null for an off-white (near-white) page', () => {
    expect(computeContentBounds(fill(10, 8, [252, 251, 253]), 10, 8)).toBeNull();
  });

  it('finds the bounding box of a centered content block', () => {
    const data = fill(16, 10, [255, 255, 255]);
    rect(data, 16, 4, 2, 11, 7);
    expect(computeContentBounds(data, 16, 10)).toEqual({ x: 4, y: 2, width: 8, height: 6 });
  });

  it('ignores isolated specks outside the content block', () => {
    const data = fill(16, 10, [255, 255, 255]);
    rect(data, 16, 4, 2, 11, 7);
    // Scanner dust: one or two pixels on the edges must not pin the bounds.
    paint(data, 16, 0, 0);
    paint(data, 16, 15, 1);
    paint(data, 16, 5, 9);
    expect(computeContentBounds(data, 16, 10)).toEqual({ x: 4, y: 2, width: 8, height: 6 });
  });

  it('counts a 3-pixel speck as content (threshold boundary)', () => {
    const data = fill(16, 10, [255, 255, 255]);
    rect(data, 16, 4, 2, 11, 5);
    paint(data, 16, 0, 0);
    paint(data, 16, 0, 1);
    paint(data, 16, 0, 2);
    expect(computeContentBounds(data, 16, 10)).toEqual({ x: 0, y: 2, width: 12, height: 4 });
  });

  it('treats antialiased text edges as content', () => {
    const data = fill(10, 6, [255, 255, 255]);
    for (let y = 1; y <= 4; y += 1) {
      for (let x = 3; x <= 6; x += 1) paint(data, 10, x, y, [246, 246, 246]);
    }
    expect(computeContentBounds(data, 10, 6)).toEqual({ x: 3, y: 1, width: 4, height: 4 });
  });

  it('includes a dark (non-white) background as content over the whole page', () => {
    const data = fill(8, 6, [28, 28, 30]);
    expect(computeContentBounds(data, 8, 6)).toEqual({ x: 0, y: 0, width: 8, height: 6 });
  });

  it('returns null for empty dimensions', () => {
    expect(computeContentBounds(new Uint8ClampedArray(0), 0, 0)).toBeNull();
  });

  it('handles a content pixel in every row/column of the page', () => {
    const data = fill(5, 5, [255, 255, 255]);
    rect(data, 5, 0, 0, 4, 4);
    expect(computeContentBounds(data, 5, 5)).toEqual({ x: 0, y: 0, width: 5, height: 5 });
  });
});

describe('expandBounds', () => {
  it('pads every side by the requested fraction of the content box', () => {
    // 20×20 box flush at (0,0) in a 60×60 page, padding 10%: the left/top
    // pad is clamped, so only the right/bottom pad grows it, to 22×22.
    expect(expandBounds({ x: 0, y: 0, width: 20, height: 20 }, 0.1, 60, 60))
      .toEqual({ x: 0, y: 0, width: 22, height: 22 });
    // Same box centered: padding grows it symmetrically.
    expect(expandBounds({ x: 20, y: 20, width: 20, height: 20 }, 0.1, 60, 60))
      .toEqual({ x: 18, y: 18, width: 24, height: 24 });
  });

  it('clamps the padding to the containing raster', () => {
    // Content flush against the top/left edge: the pad cannot leave the page.
    expect(expandBounds({ x: 0, y: 0, width: 10, height: 10 }, 0.5, 12, 12))
      .toEqual({ x: 0, y: 0, width: 12, height: 12 });
    // Content flush against the bottom/right edge likewise.
    expect(expandBounds({ x: 8, y: 8, width: 10, height: 10 }, 0.5, 18, 18))
      .toEqual({ x: 3, y: 3, width: 15, height: 15 });
  });

  it('never returns an empty region', () => {
    expect(expandBounds({ x: 5, y: 5, width: 1, height: 1 }, 0, 10, 10))
      .toEqual({ x: 5, y: 5, width: 1, height: 1 });
  });
});
