---
name: rich-content
description: LaTeX, syntax-highlighted code, and text measurement inside the SVG canvas. Use when working on math rendering, code blocks, fonts, autofit, wrapping, or selection bounds.
---

# Rich content

## LaTeX (KaTeX 0.19)

- Import once in `main.tsx`: `import 'katex/dist/katex.min.css'`. Never copy the CSS away from the package, or the font URLs break.
- Render with:

```ts
katex.renderToString(source, {
  displayMode,
  throwOnError: false,
  trust: false,
  output: 'htmlAndMathml',
})
```

- Place the HTML in `<foreignObject>`:

```tsx
<foreignObject x={x} y={y} width={w} height={h}>
  <div xmlns="http://www.w3.org/1999/xhtml"
       dangerouslySetInnerHTML={{ __html: html }} />
</foreignObject>
```

- `throwOnError: false` renders invalid TeX in red instead of throwing. Also surface the parse message as a warning in the inspector/console; never let invalid math blank the canvas.
- Memoize `renderToString` by `source + displayMode` in a module-level `Map` capped at 500 entries.
- Size: measure the rendered `div` with a hidden element or `getBoundingClientRect`, then store the measured size **outside** the document (`uiStore.measurements`) to avoid undo churn. The DSL may carry an explicit width/height; measurement only refines it.
- KaTeX HTML is not portable SVG. Exports that rasterize will need to draw the math into a canvas; do not claim vector-perfect export.

## Code (prism-react-renderer 2.4)

- Use the named `Highlight` render-prop API. Do not inject HTML.
- Output token lines as `<text>` with `<tspan>` children:

```tsx
<Highlight code={content} language={language} theme={themes.vsDark}>
  {({ tokens }) => tokens.map((line, i) => (
    <text key={i} x={x} y={y + i * lineHeight} xmlSpace="preserve">
      {line.map((token, j) => (
        <tspan key={j} fill={colorFor(token.types)}>{token.content}</tspan>
      ))}
    </text>
  ))}
</Highlight>
```

- Map token types to a small palette (`keyword`, `string`, `comment`, `number`, `function`, `operator`, `punctuation`, `plain`). Do not spread HTML props onto `<tspan>`.
- Unknown languages fall back to `plain`; never throw.
- Hidden lines and trailing empty lines still get a `<text>` row so line count matches.
- Box size: `width = max(220, maxChars * fontSize * 0.62 + padding * 2)`, `height = padTop + lines * lineHeight + padBottom`. `language` adds a title row.

## Text measurement (`geometry/measure.ts`)

A single module owns measurement so renderer, selection, and wrapping agree.

```ts
const ctx = document.createElement('canvas').getContext('2d')!;
ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`;
const width = ctx.measureText(line).width;
```

- Cache by `font|text` in a `Map` (cap 2000).
- `wrapText(content, maxWidth, font)` splits on explicit `\n` first, then greedily by words; long words break by character.
- `measureBlock(block, maxWidth)` returns `{ lines, lineHeight, width, height }`.
- `autofit` shrinks font size in 2 px steps down to 8 px until the block fits its box.
- SVG rendering and the selection overlay must both call these functions. Never hardcode widths.
- The canvas 2D context is unavailable in tests (node); guard with a fallback estimator (`0.55 * fontSize * length`) so pure tests never crash.

## Shape labels

- A shape's optional `text` block is vertically centred with `pad = min(24, min(width, height) * 0.15)`.
- Alignment applies horizontally; line spacing is `fontSize * lineHeight`.
- Empty content means no label rendered.
- Double-clicking edits the label; the editor overlay uses the same measured geometry.

## Fonts

- Use a curated list of system stacks (`Inter, system-ui, sans-serif`, `Georgia, serif`, `ui-monospace, Menlo, Consolas, monospace`). No webfont loading; avoids FOUT and offline breakage.
- KaTeX fonts come from its package CSS only.
