import {
  CodeElement,
  ConnectorElement,
  Element,
  HtmlEmbedElement,
  FigureElement,
  ImageElement,
  LatexElement,
  PenElement,
  Point,
  ShapeElement,
  TextBlock,
  TextElement,
} from '../model/types';
import { measureTextBlock, MeasuredText } from '../geometry/measure';
import { resolveConnector } from '../geometry/connectors';
import { rotationTransform, shapePath } from '../geometry/shapes';
import { LatexContent } from './LatexContent';
import { CodeContent } from './CodeContent';
import { FigureContent } from './FigureContent';
import { renderLatex } from './LatexContent';

interface ElementViewProps {
  element: Element;
  elements: Element[];
}

export function ElementView({ element, elements }: ElementViewProps) {
  if (element.hidden) return null;

  if (element.type === 'connector') {
    return <ConnectorView connector={element} elements={elements} />;
  }

  const transform = rotationTransform(element) || undefined;

  return (
    <g
      data-element-id={element.id}
      data-element-type={element.type}
      opacity={element.opacity}
      transform={transform}
    >
      <ElementBody element={element} />
    </g>
  );
}

function ElementBody({ element }: { element: Exclude<Element, ConnectorElement> }) {
  switch (element.type) {
    case 'rect':
    case 'ellipse':
    case 'triangle':
    case 'line':
    case 'polygon':
    case 'star':
    case 'arrow':
    case 'chevron':
    case 'parallelogram':
    case 'trapezoid':
    case 'speech':
      return <ShapeView element={element} />;
    case 'text':
      return <TextView element={element} />;
    case 'latex':
      return <LatexView element={element} />;
    case 'code':
      return <CodeView element={element} />;
    case 'image':
      return <ImageView element={element} />;
    case 'html':
      return <HtmlEmbedView element={element} />;
    case 'figure':
      return <FigureView element={element} />;
    case 'pen':
      return <PenView element={element} />;
  }
}

function hitRect(element: Exclude<Element, ConnectorElement>) {
  return (
    <rect
      x={element.x}
      y={element.y}
      width={Math.max(0, element.width)}
      height={Math.max(0, element.height)}
      fill="transparent"
      pointerEvents="all"
    />
  );
}

/* ─── shapes ─── */

function shapeStyle(element: ShapeElement) {
  return {
    fill: element.fill,
    stroke: element.stroke === 'none' ? 'none' : element.stroke,
    strokeWidth: element.strokeWidth || 0,
    strokeDasharray: element.dash ? `${element.dash} ${Math.max(2, element.dash * 0.8)}` : undefined,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
    filter: element.shadow
      ? `drop-shadow(${element.shadow.x}px ${element.shadow.y}px ${element.shadow.blur}px ${element.shadow.color})`
      : undefined,
  };
}

function ShapeView({ element }: { element: ShapeElement }) {
  const style = shapeStyle(element);
  return (
    <g>
      {hitRect(element)}
      {element.type === 'rect' && (
        <rect
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          rx={element.radius || 0}
          {...style}
        />
      )}
      {element.type === 'ellipse' && (
        <ellipse
          cx={element.x + element.width / 2}
          cy={element.y + element.height / 2}
          rx={element.width / 2}
          ry={element.height / 2}
          {...style}
        />
      )}
      {element.type !== 'rect' && element.type !== 'ellipse' && (
        <path d={shapePath(element)} {...style} fill={element.type === 'line' ? 'none' : element.fill} />
      )}
      {element.text && element.text.content !== '' && (
        <ShapeLabel element={element} block={element.text} />
      )}
    </g>
  );
}

function ShapeLabel({ element, block }: { element: ShapeElement; block: TextBlock }) {
  const pad = Math.min(24, Math.max(8, Math.min(element.width, element.height) * 0.12));
  const width = Math.max(8, element.width - pad * 2);
  const height = Math.max(8, element.height - pad * 2);
  const measured = measureTextBlock(block, width, height);
  const anchor = block.align === 'center' ? 'middle' : block.align === 'right' ? 'end' : 'start';
  const x =
    block.align === 'center'
      ? element.x + element.width / 2
      : block.align === 'right'
        ? element.x + element.width - pad
        : element.x + pad;
  const y = element.y + (element.height - measured.height) / 2;

  if (block.math) {
    return (
      <MathTextView
        x={element.x + pad}
        y={element.y + pad}
        width={width}
        height={height}
        block={block}
        measured={measured}
        vertical="center"
      />
    );
  }

  return (
    <text
      x={x}
      y={y}
      fill={block.color}
      fontSize={measured.fontSize}
      fontFamily={block.fontFamily}
      fontWeight={block.fontWeight}
      fontStyle={block.italic ? 'italic' : undefined}
      textDecoration={block.underline ? 'underline' : undefined}
      letterSpacing={block.letterSpacing || undefined}
      textAnchor={anchor}
      dominantBaseline="hanging"
      pointerEvents="none"
      xmlSpace="preserve"
    >
      {measured.lines.map((line, index) => (
        <tspan key={index} x={x} dy={index === 0 ? 0 : measured.lineHeight}>
          {line === '' ? ' ' : line}
        </tspan>
      ))}
    </text>
  );
}

/* ─── text ─── */

function TextView({ element }: { element: TextElement }) {
  const block = element.text;
  const measured = measureTextBlock(block, Math.max(8, element.width), Math.max(8, element.height));

  if (block.math) {
    return (
      <g>
        {hitRect(element)}
        <MathTextView
          x={element.x}
          y={element.y}
          width={Math.max(8, element.width)}
          height={Math.max(8, element.height)}
          block={block}
          measured={measured}
          vertical="flex-start"
        />
      </g>
    );
  }

  const anchor = block.align === 'center' ? 'middle' : block.align === 'right' ? 'end' : 'start';
  const x =
    block.align === 'center'
      ? element.x + element.width / 2
      : block.align === 'right'
        ? element.x + element.width
        : element.x;

  return (
    <g>
      {hitRect(element)}
      <text
        x={x}
        y={element.y}
        fill={block.color}
        fontSize={measured.fontSize}
        fontFamily={block.fontFamily}
        fontWeight={block.fontWeight}
        fontStyle={block.italic ? 'italic' : undefined}
        textDecoration={block.underline ? 'underline' : undefined}
        letterSpacing={block.letterSpacing || undefined}
        textAnchor={anchor}
        dominantBaseline="hanging"
        xmlSpace="preserve"
      >
        {measured.lines.map((line, index) => (
          <tspan key={index} x={x} dy={index === 0 ? 0 : measured.lineHeight}>
            {line === '' ? ' ' : line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

/* ─── latex ─── */

const INLINE_MATH_SEGMENT = /\$([^$]+)\$/g;

/**
 * Renders `$…$` spans as inline KaTeX inside a measured text block. Lines and
 * placement come from the same measurement as plain text, so Math Mode only
 * swaps the glyph engine inside the same box.
 */
function MathTextView({
  x,
  y,
  width,
  height,
  block,
  measured,
  vertical,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  block: TextBlock;
  measured: MeasuredText;
  vertical: 'flex-start' | 'center';
}) {
  const alignItems = block.align === 'center' ? 'center' : block.align === 'right' ? 'flex-end' : 'flex-start';
  return (
    <foreignObject
      x={x}
      y={y}
      width={width}
      height={height}
      style={{ overflow: 'hidden' }}
    >
      <div
        className="text-math-content"
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: vertical,
          alignItems,
          fontFamily: block.fontFamily,
          fontSize: measured.fontSize,
          fontWeight: block.fontWeight,
          fontStyle: block.italic ? 'italic' : undefined,
          color: block.color,
          lineHeight: `${measured.lineHeight}px`,
          whiteSpace: 'pre',
        }}
      >
        {measured.lines.map((line, index) => (
          <div key={index}>{line === '' ? '\u00a0' : segments(line)}</div>
        ))}
      </div>
    </foreignObject>
  );
}

/** Splits one measured line into plain strings and inline KaTeX spans. */
function segments(line: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let index = 0;
  for (const node of renderMixedLine(line)) {
    if (typeof node === 'string') {
      nodes.push(<span key={index}>{node}</span>);
    } else {
      nodes.push(
        <span
          key={index}
          className="inline-math"
          dangerouslySetInnerHTML={{ __html: renderLatex(node.math, false) }}
        />,
      );
    }
    index += 1;
  }
  return nodes;
}

function renderMixedLine(line: string): (string | { math: string })[] {
  INLINE_MATH_SEGMENT.lastIndex = 0;
  const out: (string | { math: string })[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_MATH_SEGMENT.exec(line)) !== null) {
    if (match.index > last) out.push(line.slice(last, match.index));
    out.push({ math: match[1] });
    last = match.index + match[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  if (out.length === 0) out.push(line);
  return out;
}

function LatexView({ element }: { element: LatexElement }) {
  return (
    <g>
      {hitRect(element)}
      <LatexContent element={element} />
    </g>
  );
}

/* ─── figure ─── */

function FigureView({ element }: { element: FigureElement }) {
  return (
    <g>
      {hitRect(element)}
      {/* Drawn shapes sit above the hit rect; keep them click-transparent so
          selection lands on the element box, not individual strokes. */}
      <g pointerEvents="none">
        <FigureContent element={element} />
      </g>
    </g>
  );
}

/* ─── code ─── */

function CodeView({ element }: { element: CodeElement }) {
  return (
    <g>
      {hitRect(element)}
      <CodeContent element={element} />
    </g>
  );
}

/* ─── image ─── */

const IMAGE_PRESERVE_ASPECT: Record<ImageElement['fit'], string> = {
  contain: 'xMidYMid meet',
  cover: 'xMidYMid slice',
  fill: 'none',
};

function ImageView({ element }: { element: ImageElement }) {
  const width = Math.max(0, element.width);
  const height = Math.max(0, element.height);
  const clipId = `image-clip-${element.id}`;

  if (element.src.trim() === '') {
    return (
      <g>
        {hitRect(element)}
        <rect
          x={element.x}
          y={element.y}
          width={width}
          height={height}
          rx={element.radius || 0}
          fill="#eef0f4"
          stroke="#c2c8d2"
          strokeWidth={2}
          strokeDasharray="10 7"
          pointerEvents="none"
        />
        <text
          x={element.x + width / 2}
          y={element.y + height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#7b8495"
          fontSize={Math.max(12, Math.min(28, height / 4))}
          fontFamily="Inter, system-ui, sans-serif"
          pointerEvents="none"
        >
          No image yet
        </text>
      </g>
    );
  }

  return (
    <g>
      {hitRect(element)}
      {element.radius > 0 && (
        <defs>
          <clipPath id={clipId}>
            <rect
              x={element.x}
              y={element.y}
              width={width}
              height={height}
              rx={element.radius}
            />
          </clipPath>
        </defs>
      )}
      <image
        href={element.src}
        x={element.x}
        y={element.y}
        width={width}
        height={height}
        preserveAspectRatio={IMAGE_PRESERVE_ASPECT[element.fit] ?? IMAGE_PRESERVE_ASPECT.contain}
        clipPath={element.radius > 0 ? `url(#${clipId})` : undefined}
      />
    </g>
  );
}

/* ─── html embed (canvas chrome; the live frame is an HTML overlay) ─── */

function HtmlEmbedView({ element }: { element: HtmlEmbedElement }) {
  const width = Math.max(0, element.width);
  const height = Math.max(0, element.height);
  const hasUrl = element.src.trim() !== '';
  const hasContent = element.content.trim() !== '';
  const empty = !hasUrl && !hasContent;
  const label = empty ? 'No HTML yet' : hasContent ? 'HTML embed' : 'URL embed';

  return (
    <g>
      {hitRect(element)}
      <rect
        x={element.x}
        y={element.y}
        width={width}
        height={height}
        rx={element.radius || 0}
        fill={empty ? '#eef0f4' : '#23262d'}
        stroke={empty ? '#c2c8d2' : '#5b6b7b'}
        strokeWidth={empty ? 2 : 1.5}
        strokeDasharray={empty ? '10 7' : undefined}
        pointerEvents="none"
      />
      <text
        x={element.x + width / 2}
        y={element.y + height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={empty ? '#7b8495' : '#9aa5b5'}
        fontSize={Math.max(12, Math.min(28, height / 4))}
        fontFamily="Inter, system-ui, sans-serif"
        pointerEvents="none"
      >
        {label}
      </text>
    </g>
  );
}

/* ─── pen ─── */

function buildPenPath(points: Point[], smooth: boolean): string {
  if (points.length === 0) return '';
  let path = `M${points[0].x},${points[0].y}`;
  if (smooth && points.length > 2) {
    for (let i = 1; i < points.length - 1; i += 1) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      path += ` Q${points[i].x},${points[i].y} ${xc},${yc}`;
    }
    const last = points[points.length - 1];
    path += ` L${last.x},${last.y}`;
  } else {
    for (let i = 1; i < points.length; i += 1) path += ` L${points[i].x},${points[i].y}`;
  }
  return path;
}

function PenView({ element }: { element: PenElement }) {
  if (element.points.length === 0) return null;
  const highlighter = element.mode === 'highlighter';
  return (
    <g>
      <path
        d={buildPenPath(element.points, element.smoothing)}
        fill="none"
        stroke={element.color}
        strokeWidth={element.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={highlighter ? 0.35 : 1}
        style={highlighter ? { mixBlendMode: 'multiply' } : undefined}
        pointerEvents="none"
      />
      {/* Wide, invisible hit area so thin strokes stay selectable. */}
      <path
        d={buildPenPath(element.points, element.smoothing)}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(element.strokeWidth + 12, 14)}
        strokeLinecap="round"
        pointerEvents="stroke"
      />
    </g>
  );
}

/* ─── connector ─── */

function ConnectorView({ connector, elements }: { connector: ConnectorElement; elements: Element[] }) {
  if (connector.hidden) return null;
  const resolved = resolveConnector(connector, elements);
  const dash = connector.dash
    ? `${connector.dash} ${Math.max(2, connector.dash * 0.8)}`
    : undefined;
  const labelWidth = connector.label ? connector.label.length * 8.2 + 18 : 0;

  return (
    <g data-element-id={connector.id} data-element-type="connector" opacity={1}>
      <path
        d={resolved.path}
        fill="none"
        stroke={connector.color}
        strokeWidth={connector.width}
        strokeDasharray={dash}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={resolved.path}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(16, connector.width + 12)}
        strokeLinecap="round"
        pointerEvents="stroke"
      />
      {resolved.startArrow && (
        <path
          d={resolved.startArrow.d}
          fill={resolved.startArrow.filled ? connector.color : 'none'}
          stroke={connector.color}
          strokeWidth={resolved.startArrow.filled ? 0 : connector.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )}
      {resolved.endArrow && (
        <path
          d={resolved.endArrow.d}
          fill={resolved.endArrow.filled ? connector.color : 'none'}
          stroke={connector.color}
          strokeWidth={resolved.endArrow.filled ? 0 : connector.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )}
      {connector.label !== '' && (
        <g pointerEvents="none">
          <rect
            x={resolved.midpoint.x - labelWidth / 2}
            y={resolved.midpoint.y - 12}
            width={labelWidth}
            height={24}
            rx={5}
            fill="#ffffffee"
            stroke="#d6d6d6"
            strokeWidth={1}
          />
          <text
            x={resolved.midpoint.x}
            y={resolved.midpoint.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={13}
            fontFamily="Inter, system-ui, sans-serif"
            fill="#333333"
          >
            {connector.label}
          </text>
        </g>
      )}
    </g>
  );
}
