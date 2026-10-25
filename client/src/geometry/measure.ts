import { TextBlock } from '../model/types';

let cachedContext: CanvasRenderingContext2D | null | undefined;

function context(): CanvasRenderingContext2D | null {
  if (cachedContext !== undefined) return cachedContext;
  try {
    if (typeof document !== 'undefined' && document.createElement) {
      cachedContext = document.createElement('canvas').getContext('2d');
    } else {
      cachedContext = null;
    }
  } catch {
    cachedContext = null;
  }
  return cachedContext;
}

const widthCache = new Map<string, number>();
const CACHE_LIMIT = 4000;

export function fontFor(block: Pick<TextBlock, 'fontFamily' | 'fontSize' | 'fontWeight' | 'italic'>, size = block.fontSize): string {
  return `${block.italic ? 'italic ' : ''}${block.fontWeight} ${size}px ${block.fontFamily}`;
}

/** Width of a single line. Falls back to an approximation when canvas is unavailable. */
export function measureLine(text: string, font: string, fallbackSize: number): number {
  const key = `${font}\u0000${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;

  let width: number;
  const ctx = context();
  if (ctx) {
    ctx.font = font;
    width = ctx.measureText(text).width;
  } else {
    width = text.length * fallbackSize * 0.55;
  }

  if (widthCache.size > CACHE_LIMIT) widthCache.clear();
  widthCache.set(key, width);
  return width;
}

export interface MeasuredText {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  width: number;
  height: number;
}

function breakWord(word: string, maxWidth: number, font: string, size: number): string[] {
  const parts: string[] = [];
  let current = '';
  for (const char of word) {
    const candidate = current + char;
    if (current && measureLine(candidate, font, size) > maxWidth) {
      parts.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }
  if (current) parts.push(current);
  return parts.length > 0 ? parts : [word];
}

export function wrapText(content: string, maxWidth: number, font: string, size: number): string[] {
  const lines: string[] = [];

  for (const paragraph of content.split('\n')) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }

    const words = paragraph.split(/(\s+)/).filter((part) => part !== '');
    let current = '';

    for (const word of words) {
      const candidate = current + word;
      if (measureLine(candidate.trimEnd(), font, size) <= maxWidth) {
        current = candidate;
        continue;
      }

      if (current.trimEnd() !== '') lines.push(current.trimEnd());
      current = '';

      if (/^\s+$/.test(word)) continue;

      if (measureLine(word, font, size) > maxWidth) {
        const pieces = breakWord(word, maxWidth, font, size);
        lines.push(...pieces.slice(0, -1));
        current = pieces[pieces.length - 1] ?? '';
      } else {
        current = word;
      }
    }

    lines.push(current.trimEnd());
  }

  return lines.length > 0 ? lines : [''];
}

/**
 * Measure and wrap a text block. When autofit is on, step the font size down
 * until the block fits both the wrap width and the available height.
 */
export function measureTextBlock(
  block: TextBlock,
  maxWidth: number,
  maxHeight = Number.POSITIVE_INFINITY,
): MeasuredText {
  let size = Math.max(1, block.fontSize);
  const width = Math.max(8, maxWidth);

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const font = fontFor(block, size);
    const lines = wrapText(block.content, width, font, size);
    const lineHeight = size * block.lineHeight;
    let widest = 0;
    for (const line of lines) {
      widest = Math.max(
        widest,
        measureLine(line, font, size) + Math.max(0, line.length - 1) * block.letterSpacing,
      );
    }
    const height = lines.length * lineHeight;
    const fits = widest <= width + 0.5 && height <= maxHeight + 0.5;
    if (!block.autofit || fits || size <= 8) {
      return { lines, fontSize: size, lineHeight, width: Math.min(width, widest), height };
    }
    size = Math.max(8, size - 2);
  }

  const font = fontFor(block, size);
  const lines = wrapText(block.content, width, font, size);
  return {
    lines,
    fontSize: size,
    lineHeight: size * block.lineHeight,
    width,
    height: lines.length * size * block.lineHeight,
  };
}

export function clearMeasureCache(): void {
  widthCache.clear();
}
