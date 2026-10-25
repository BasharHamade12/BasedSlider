---
name: canvas-interaction
description: Pointer, selection, transform, snapping, and inline-editing rules for the SVG canvas. Use when changing drag/resize/rotate, hit-testing, zoom/pan, marquee selection, or on-canvas text editing.
---

# Canvas interaction

## Coordinates

The slide is always 1920×1080 (`SLIDE_W`, `SLIDE_H`). The SVG is rendered at an exact pixel size derived from the container:

```
fitScale = min(containerW / 1920, containerH / 1080)
scale    = fitScale * zoom
svgW     = 1920 * scale
svgH     = 1080 * scale
```

Because the SVG has an exact size, there is no letterboxing:

```ts
function clientToSlide(clientX, clientY, rect, scale) {
  return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
}
```

`useCanvasSize` owns a `ResizeObserver` and returns `{ scale, svgW, svgH, rectRef }`. Zoom and pan live in `useUiStore`; pan is applied with a CSS translate on the stage, never baked into the document.

Handle sizes are divided by `scale` so they stay constant on screen. All hit areas are measured in slide units.

## Pointer state machine

One hook (`canvas/useInteraction.ts`) owns every canvas gesture. Do not add per-element pointer handlers.

```
idle → pressing → (moving | resizing | rotating | marquee | connecting | drawing) → idle
```

- Pointer-down records `{ mode, startPoint, snapshot }` and calls `beginTransaction()`.
- Pointer-move mutates the document through `applyElement`/`moveElements` while the transaction is open.
- Pointer-up commits the transaction **once**, releases capture, and clears transient state.
- Cancel (Escape, pointercancel, lost capture) restores the snapshot and commits nothing.

Hit-testing uses `event.target.closest('[data-element-id]')` and `[data-handle]` on the root `<svg>`. Connectors get an invisible 14 px stroke for hit-testing.

## Selection

- Click selects; shift-click toggles; marquee selects intersecting elements.
- Clicking empty canvas clears selection.
- Grouped elements (`group: "g1"`) select and move together.
- Locked elements cannot be selected by click or marquee; hidden elements are not rendered.
- Arrow keys nudge 1 px, shift+arrow 10 px.
- Copy/paste/duplicate use an internal clipboard and always assign fresh ids.

## Transforms

- Move: delta from pointer-down, with snapping.
- Resize: 8 handles. Anchor the opposite edge; shift preserves aspect ratio; `width`/`height` clamp to a 4 px minimum.
- Rotate: handle above the top edge; snap to 15° with shift.
- For `text` and shape labels, resizing changes the wrap width; font size only changes through the inspector or autofit.
- Resizing a `pen` stroke maps its derived point bounds onto the new box, scaling the points; `strokeWidth` is deliberately left alone. Rotation is ordinary geometry, so the same handles work.

## Snapping

- Grid step 8 px (toggleable).
- Align to other elements' left/center/right and top/middle/bottom, and to slide center.
- Threshold is `6 / scale` slide units.
- Emit guide lines into `useUiStore.guides` during the gesture and clear them on pointer-up. Guides are never part of the document.

## Inline editing

Double-click a text element, or any shape (which creates a label when missing):

1. `useUiStore.editing = { elementId, target }` (`target` is `text` or `label`).
2. Position a `<textarea>` over the element using the element's screen rect (unrotated; rotation is ignored while editing).
3. Style it to approximate the text (font family, size, weight, alignment, color) so the jump is small.
4. Commit on blur or Cmd/Ctrl+Enter; cancel on Escape. Commit is a single undo step.
5. Hide the underlying text while editing to avoid double rendering.

Pointer capture and `preventDefault()` on pointerdown suppress the native `dblclick` event. Detect a second press on the same element within 400 ms and 8 slide units inside `pointerdown`; keep an `onDoubleClick` fallback that uses the current selection when the event target is retargeted to the SVG.

## Draw mode

The drawing overlay captures the pointer, accumulates points with pressure, and shows a live path. On pointer-up, create a `pen` element through the store (one undo step), normalize its points so `x`/`y` is the bounding-box minimum, and clear the live stroke. Highlighter mode sets `mode: "highlighter"` (opacity + blend in the renderer). Store thickness in `pen.strokeWidth`; the normalized bounds are independent of it.

## Connect mode

Hovering a shape shows four ports. Pointer-down on a port starts a pending connector; moving draws a preview; pointer-up over a shape creates the connector with `auto` ports on both ends (or the hovered port on the target). Releasing over empty space creates a free endpoint. Escape cancels.
