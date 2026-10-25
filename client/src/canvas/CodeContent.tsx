import { useMemo } from 'react';
import { Highlight, PrismTheme, themes } from 'prism-react-renderer';
import { CodeElement } from '../model/types';

const PADDING = 14;
const HEADER = 40;
const CHAR_WIDTH = 0.62;

function paletteFor(theme: PrismTheme): { map: Map<string, string>; plain: string } {
  const map = new Map<string, string>();
  for (const entry of theme.styles) {
    const color = typeof entry.style.color === 'string' ? entry.style.color : undefined;
    if (!color) continue;
    for (const type of entry.types) map.set(type, color);
  }
  return { map, plain: theme.plain.color ?? '#e6e6e6' };
}

function tokenColor(types: string[], palette: { map: Map<string, string>; plain: string }): string {
  for (const type of types) {
    const color = palette.map.get(type);
    if (color) return color;
  }
  return palette.plain;
}

export function CodeContent({ element }: { element: CodeElement }) {
  const theme = element.theme === 'light' ? themes.vsLight : themes.vsDark;
  const palette = useMemo(() => paletteFor(theme), [theme]);
  const fontSize = element.fontSize;
  const lineHeight = fontSize * 1.5;
  const lines = element.content.split('\n');
  const gutter = element.lineNumbers ? 34 : 0;
  const clipId = `code-clip-${element.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const background = element.background;
  const foreground = element.color;

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect
            x={element.x + 1}
            y={element.y + 1}
            width={Math.max(0, element.width - 2)}
            height={Math.max(0, element.height - 2)}
            rx={7}
          />
        </clipPath>
      </defs>
      <rect
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        rx={8}
        fill={background}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={1}
      />
      {element.language && (
        <text
          x={element.x + PADDING}
          y={element.y + 16}
          fill="#9a9a9a"
          fontSize={12}
          fontFamily="Inter, system-ui, sans-serif"
          dominantBaseline="hanging"
        >
          {element.language}
        </text>
      )}
      <g clipPath={`url(#${clipId})`}>
        <Highlight code={element.content} language={element.language || 'plain'} theme={theme}>
          {({ tokens }) => (
            <g fontFamily="ui-monospace, Menlo, Consolas, monospace">
              {tokens.map((line, lineIndex) => (
                <text
                  key={lineIndex}
                  x={element.x + PADDING + gutter}
                  y={element.y + (element.language ? HEADER : PADDING) + lineIndex * lineHeight}
                  fontSize={fontSize}
                  dominantBaseline="hanging"
                  xmlSpace="preserve"
                >
                  {line.map((token, tokenIndex) => (
                    <tspan
                      key={tokenIndex}
                      fill={token.types.includes('plain') ? foreground : tokenColor(token.types, palette)}
                    >
                      {token.content}
                    </tspan>
                  ))}
                </text>
              ))}
            </g>
          )}
        </Highlight>
        {element.lineNumbers &&
          lines.map((_, index) => (
            <text
              key={`gutter-${index}`}
              x={element.x + PADDING + (gutter - 10)}
              y={element.y + (element.language ? HEADER : PADDING) + index * lineHeight}
              fontSize={fontSize * 0.8}
              fill="#6b7280"
              textAnchor="end"
              dominantBaseline="hanging"
            >
              {index + 1}
            </text>
          ))}
      </g>
    </g>
  );
}

export function codeCharWidth(fontSize: number): number {
  return fontSize * CHAR_WIDTH;
}
