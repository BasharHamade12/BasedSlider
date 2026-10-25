import { useMemo } from 'react';
import katex from 'katex';
import { LatexElement } from '../model/types';

const MAX_CACHE = 500;
const htmlCache = new Map<string, string>();

/** Shared KaTeX HTML cache; also drives inline `$…$` math inside text blocks. */
export function renderLatex(source: string, displayMode: boolean): string {
  const key = `${displayMode ? 'D' : 'I'}:${source}`;
  const cached = htmlCache.get(key);
  if (cached !== undefined) return cached;

  let html = '';
  try {
    html = katex.renderToString(source, {
      displayMode,
      throwOnError: false,
      trust: false,
      output: 'htmlAndMathml',
    });
  } catch {
    html = '';
  }

  if (htmlCache.size > MAX_CACHE) htmlCache.clear();
  htmlCache.set(key, html);
  return html;
}

export function LatexContent({ element }: { element: LatexElement }) {
  const html = useMemo(
    () => renderLatex(element.content, element.displayMode),
    [element.content, element.displayMode],
  );

  return (
    <foreignObject
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      style={{ overflow: 'hidden' }}
    >
      <div
        className="latex-content"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: element.displayMode ? 'center' : 'flex-start',
          fontSize: `${element.fontSize}px`,
          color: element.color || '#1a1b1e',
          boxSizing: 'border-box',
          padding: 4,
          overflow: 'hidden',
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </foreignObject>
  );
}
