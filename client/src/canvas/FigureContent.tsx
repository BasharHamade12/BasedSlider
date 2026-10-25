import { FigureElement, figureFunction } from '../model/types';

/**
 * Self-contained SVG renderer for `figure` elements. Everything is drawn
 * relative to the element box, so moving/resizing the element reshapes the
 * drawing instead of scattering children around the slide.
 */
export function FigureContent({ element }: { element: FigureElement }) {
  const { x, y, width, height } = element;
  const W = Math.max(0, width);
  const H = Math.max(0, height);
  // Room for tick labels and the title strip.
  const pad = Math.min(64, Math.max(28, Math.min(W, H) * 0.12));
  const titleH = element.title ? Math.min(48, Math.max(24, H * 0.12)) : 0;

  return (
    <g>
      {element.title && (
        <text
          x={x + W / 2}
          y={y + titleH / 2 + 5}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={element.titleColor}
          fontSize={Math.max(14, Math.min(30, W * 0.06))}
          fontWeight={700}
        >
          {element.title}
        </text>
      )}
      <Clip id={`figure-clip-${element.id}`} box={{ x, y: y + titleH, width: W, height: H - titleH }}>
        {element.kind === 'plane' ? (
          <PlaneBody element={element} box={{ x, y: y + titleH, width: W, height: H - titleH }} pad={pad} />
        ) : element.kind === 'barchart' ? (
          <BarChartBody element={element} box={{ x, y: y + titleH, width: W, height: H - titleH }} pad={pad} />
        ) : (
          <AxesBody element={element} box={{ x, y: y + titleH, width: W, height: H - titleH }} pad={pad} />
        )}
      </Clip>
    </g>
  );
}

function Clip({ id, box, children }: { id: string; box: Rect; children: React.ReactNode }) {
  return (
    <>
      <clipPath id={id}>
        <rect x={box.x} y={box.y} width={box.width} height={box.height} rx={4} />
      </clipPath>
      <g clipPath={`url(#${id})`}>{children}</g>
    </>
  );
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/* ─── body builders ─── */

interface BodyProps {
  element: FigureElement;
  box: Rect;
  pad: number;
}

function PlaneBody({ element, box, pad }: BodyProps) {
  const stride = Math.max(28, Math.min(40, box.width / 16));
  const cols = Math.max(1, Math.floor((box.width - pad) / stride));
  const rows = Math.max(1, Math.floor((box.height - pad) / stride));
  const ox = box.x + pad / 2 + (box.width - pad - cols * stride) / 2;
  const oy = box.y + pad / 2 + (box.height - pad - rows * stride) / 2;
  const vLines = [];
  const hLines = [];
  for (let c = 0; c <= cols; c++) {
    vLines.push(ox + c * stride);
  }
  for (let r = 0; r <= rows; r++) {
    hLines.push(oy + r * stride);
  }
  return (
    <g>
      {vLines.map((lineX) => (
        <line key={`v${lineX}`} x1={lineX} y1={oy} x2={lineX} y2={oy + rows * stride} stroke={element.gridColor} strokeWidth={1} />
      ))}
      {hLines.map((lineY) => (
        <line key={`h${lineY}`} x1={ox} y1={lineY} x2={ox + cols * stride} y2={lineY} stroke={element.gridColor} strokeWidth={1} />
      ))}
      <line x1={ox} y1={oy} x2={ox + cols * stride} y2={oy} stroke={element.axisColor} strokeWidth={3} />
      <line x1={ox} y1={oy} x2={ox} y2={oy + rows * stride} stroke={element.axisColor} strokeWidth={3} />
    </g>
  );
}

function AxesBody({ element, box, pad }: BodyProps) {
  const plot = {
    x: box.x + pad,
    y: box.y + pad,
    width: Math.max(10, box.width - pad * 2),
    height: Math.max(10, box.height - pad * 2),
  };
  const cx = plot.x + plot.width / 2;
  const cy = plot.y + plot.height / 2;
  const tick = 6;
  const arrow = 12;

  // Ticks every unit step: choose a step so the axes stay readable at any size.
  const step = Math.max(20, Math.min(60, plot.width / element.domain / 2));

  const ticksX = [];
  for (let t = 0; cx + t <= plot.x + plot.width; t += step) {
    if (t > 0) ticksX.push(cx + t);
    if (cx - t >= plot.x) ticksX.push(cx - t);
  }
  const ticksY = [];
  for (let t = 0; cy + t <= plot.y + plot.height; t += step) {
    if (t > 0) ticksY.push(cy + t);
    if (cy - t >= plot.y) ticksY.push(cy - t);
  }

  const labelSize = Math.max(12, Math.min(24, plot.width * 0.05));

  return (
    <g>
      {ticksX.map((line) => (
        <line key={`tx${line}`} x1={line} y1={cy - tick} x2={line} y2={cy + tick} stroke={element.axisColor} strokeWidth={2} />
      ))}
      {ticksY.map((line) => (
        <line key={`ty${line}`} x1={cx - tick} y1={line} x2={cx + tick} y2={line} stroke={element.axisColor} strokeWidth={2} />
      ))}
      <AxisArrow x1={plot.x} y1={cy} x2={plot.x + plot.width} y2={cy} arrow={arrow} color={element.axisColor} direction="right" />
      <AxisArrow x1={cx} y1={plot.y + plot.height} x2={cx} y2={plot.y} arrow={arrow} color={element.axisColor} direction="up" />
      <text x={plot.x + plot.width - arrow} y={cy - 12} fill={element.axisColor} fontSize={labelSize} textAnchor="end">
        x
      </text>
      <text x={cx + 12} y={plot.y + arrow} fill={element.axisColor} fontSize={labelSize}>
        y
      </text>
      <text x={cx + 8} y={cy + 8} fill={element.axisColor} fontSize={labelSize * 0.9}>
        O
      </text>
      {element.kind === 'graph' && (
        <CurveBody element={element} plot={plot} cx={cx} cy={cy} />
      )}
    </g>
  );
}

/** Axis line ending in an arrowhead: direction 'right' or 'up'. */
function AxisArrow({
  x1,
  y1,
  x2,
  y2,
  arrow,
  color,
  direction,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  arrow: number;
  color: string;
  direction: 'right' | 'up';
}) {
  const head =
    direction === 'right'
      ? `${x2 + arrow},${y2} ${x2 - arrow * 0.6},${y2 - arrow * 0.5} ${x2 - arrow * 0.6},${y2 + arrow * 0.5}`
      : `${x2},${y2 - arrow} ${x2 - arrow * 0.5},${y2 + arrow * 0.6} ${x2 + arrow * 0.5},${y2 + arrow * 0.6}`;
  return (
    <g stroke={color} strokeWidth={3} fill={color}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <polygon points={head} stroke="none" />
    </g>
  );
}

function CurveBody({
  element,
  plot,
  cx,
  cy,
}: {
  element: FigureElement;
  plot: Rect;
  cx: number;
  cy: number;
}) {
  const samples = 80;
  const xMax = Math.max(0.5, element.domain);
  const fn = element.fn;
  let yMin = Number.POSITIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;
  const values: number[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const mathX = -xMax + (i / samples) * 2 * xMax;
    const value = figureFunction(fn, element.a, element.b, element.c, mathX);
    if (!Number.isFinite(value)) {
      values.push(NaN);
      continue;
    }
    values.push(value);
    if (value > yMax) yMax = value;
    if (value < yMin) yMin = value;
  }
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) return null;
  // Add headroom so extreme values don't pin to the border.
  const span = Math.max(1e-3, (yMax - yMin) * 1.15);
  const mid = (yMax + yMin) / 2;
  yMin = mid - span / 2;
  yMax = mid + span / 2;

  let d = '';
  let pen = false;
  for (let i = 0; i <= samples; i += 1) {
    const mathX = -xMax + (i / samples) * 2 * xMax;
    const value = values[i];
    const px = cx + (mathX / xMax) * (plot.width / 2);
    const py = cy - ((value - mid) / span) * plot.height;
    if (!Number.isFinite(value)) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${px.toFixed(2)},${py.toFixed(2)}`;
    pen = true;
  }

  return <path d={d} fill="none" stroke={element.accentColor} strokeWidth={3.5} strokeLinecap="round" />;
}

function BarChartBody({ element, box, pad }: BodyProps) {
  const plot = {
    x: box.x + pad,
    y: box.y + pad,
    width: Math.max(10, box.width - pad * 2),
    height: Math.max(10, box.height - pad * 2),
  };
  const values = element.values.length > 0 ? element.values : [1];
  const peak = Math.max(...values.map((value) => Math.abs(value)), 1);
  const barW = Math.max(6, (plot.width / values.length) * 0.6);
  const gap = (plot.width - barW * values.length) / (values.length + 1);

  return (
    <g>
      <line x1={plot.x} y1={plot.y} x2={plot.x} y2={plot.y + plot.height} stroke={element.axisColor} strokeWidth={3} />
      <line x1={plot.x} y1={plot.y + plot.height} x2={plot.x + plot.width} y2={plot.y + plot.height} stroke={element.axisColor} strokeWidth={3} />
      {values.map((value, index) => {
        const barH = (Math.abs(value) / peak) * (plot.height - 8);
        return (
          <rect
            key={index}
            x={plot.x + gap + index * (barW + gap)}
            y={plot.y + plot.height - barH}
            width={barW}
            height={barH}
            rx={3}
            fill={element.accentColor}
          />
        );
      })}
    </g>
  );
}
