/**
 * Bounding box of the non-white ("content") region of a rasterized page.
 *
 * Imported PDF pages keep their sheet's blank margins (LaTeX geometry, for
 * example), and the slide canvas is the content area the user actually wants.
 * This helper finds where the content starts so the importer can crop the
 * raster — and size the canvas to the cropped region — instead of shipping a
 * canvas full of white space.
 */

export interface PixelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Classifies a pixel as white when every channel is at or above this level,
 * so antialiased edges of text and figures still register as content.
 */
const WHITE_LEVEL = 250;

/**
 * A row or column only contains content when it holds at least this many
 * content pixels; fewer than that is treated as noise (a scan speck, a
 * compression artifact) that would otherwise pin a thin margin in place.
 */
const MIN_MARKS = 3;

/**
 * Grows a content box by `fraction` of its own size on every side (the small
 * breathing room the importer keeps around trimmed PDF pages), clamped to the
 * containing raster of `width` × `height` so the pad never invents a region
 * beyond the page.
 */
export function expandBounds(
  bounds: PixelBounds,
  fraction: number,
  width: number,
  height: number,
): PixelBounds {
  const padX = Math.round(bounds.width * fraction);
  const padY = Math.round(bounds.height * fraction);
  const x0 = Math.max(0, bounds.x - padX);
  const y0 = Math.max(0, bounds.y - padY);
  const x1 = Math.min(width, bounds.x + bounds.width + padX);
  const y1 = Math.min(height, bounds.y + bounds.height + padY);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export function computeContentBounds(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
): PixelBounds | null {
  if (width <= 0 || height <= 0) return null;
  const rows = new Int32Array(height);
  const cols = new Int32Array(width);
  const pixelCount = width * height;
  for (let i = 0; i < pixelCount; i += 1) {
    const p = i * 4;
    const x = i % width;
    const y = (i / width) | 0;
    if (
      data[p] < WHITE_LEVEL || data[p + 1] < WHITE_LEVEL || data[p + 2] < WHITE_LEVEL
    ) {
      rows[y] += 1;
      cols[x] += 1;
    }
  }
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    if (rows[y] >= MIN_MARKS) {
      if (top === -1) top = y;
      bottom = y;
    }
  }
  if (top === -1) return null;
  let left = -1;
  let right = -1;
  for (let x = 0; x < width; x += 1) {
    if (cols[x] >= MIN_MARKS) {
      if (left === -1) left = x;
      right = x;
    }
  }
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}
