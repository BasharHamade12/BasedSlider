---
name: connectors-arrows
description: Shape-to-shape connector anchors, routing, and arrowhead geometry. Use when changing connector behavior, adding arrow types, fixing routing, or working with attached endpoints.
---

# Connectors and arrows

## Model

```ts
type AnchorRef =
  | { kind: 'element'; elementId: string; port: 'top' | 'right' | 'bottom' | 'left' | 'auto' }
  | { kind: 'point'; x: number; y: number };

interface ConnectorElement {
  id: string;
  type: 'connector';
  from: AnchorRef;
  to: AnchorRef;
  routing: 'straight' | 'elbow' | 'curved';
  startArrow: ArrowType;
  endArrow: ArrowType;
  arrowSize: number;
  width: number;
  dash: number;
  color: string;
  label?: string;
  animations: AnimationSpec[];
}
```

Connectors store **no geometry**. It is resolved every render from the current element bounds, so a connector follows its shapes during a drag with no extra bookkeeping.

## Resolution pipeline

`geometry/connectors.ts` exposes one entry point:

```ts
resolveConnector(c: ConnectorElement, elements: Element[]): ResolvedConnector
```

`ResolvedConnector` contains `start`, `end`, `path`, `startAngle`, `endAngle`, `midpoint`, `bounds`. The renderer and the selection overlay both consume it; never recompute geometry in a component.

1. **Anchor point** — `anchorPoint(element, port)`:
   - `rect`/shape bounds are `x..x+width`, `y..y+height`.
   - `ellipse`: port points on the ellipse edge (cx, cy ± h/2).
   - `top = (cx, y)`, `bottom = (cx, y+h)`, `left = (x, cy)`, `right = (x+w, cy)`.
   - `auto` chooses the port whose normal points most directly at the other endpoint.
   - Free points are returned as-is.
   - Rotation is applied around the element centre (`rotateVector` in `geometry/shapes.ts`): the port point and its normal both rotate with the shape, so a rotated element is attached on its visual edge. `auto` compares the target direction in the element's own (unrotated) frame, so it still picks the side that faces the target.
2. **Routing**:
   - `straight`: `M start L end`.
   - `elbow`: leave each endpoint along its port normal for a stub (`max(24, arrowSize * 2)`), then join with one or two axis-aligned segments. Choose the middle split on the axis with the larger gap. Always emit `H`/`V` commands.
   - `curved`: cubic Bézier with control points offset along the port normals by `max(40, distance / 3)`.
3. **Angles** — the end angle comes from the last path segment (`atan2`). Arrowheads are built from that angle, not from the raw endpoint delta, so elbows get correctly oriented heads.

## Arrowheads

`arrowPath(type, tip, angle, size)` returns an SVG path string, or `null` for `none`.

- `triangle` — filled isosceles triangle, base `size * 0.8` behind the tip.
- `open` — two stroked lines forming a V.
- `diamond` — filled rhombus centred on the tip.
- `circle` — filled circle centred slightly behind the tip.
- `bar` — perpendicular stroked line at the tip.
- `none` — no path.

The line/path is shortened by `size * 0.9` at each end that has a filled head so the stroke does not poke through the tip. Open/bar heads do not shorten.

## Interaction

- Connector hit area: duplicate the path with `stroke-width={Math.max(14, width + 10)}`, `stroke="transparent"`, `fill="none"`, and `pointerEvents="stroke"`.
- Selecting a connector shows endpoint handles. Dragging one updates that endpoint; dropping on a shape attaches it at the nearest port.
- Deleting a shape deletes every connector that references it in the **same** undo step.
- A dangling reference (hand-written code) becomes a free point at the shape's last known position, plus a warning. Rendering must never throw.

## Labels

The label sits at `midpoint` with a background pill matching the canvas style. Double-click edits it inline; empty string removes it.

## Tests

`geometry/__tests__/connectors.test.ts` must cover:

- anchors for all four ports on a known rect,
- anchors, normals, and `auto` port choice on a rotated element,
- `auto` port choice for all four relative directions,
- elbow path segment count and axis alignment,
- arrowhead tip exactly at the endpoint for angles 0, 45, 90, 180,
- dangling endpoint fallback.
