---
name: document-model
description: The authoritative deck document — types, factories, typed actions, history, selection, and validation. Use when adding a document mutation, a new element type, undo behavior, or changing store shape.
---

# Document model

`client/src/model` is the single source of truth. Canvas, inspector, code panel, layers, and presentation all read from it. Nothing else owns slide data.

## Shape

```
Doc { version, title, width, height, slides: Slide[] }
Slide { id, name, background, transition, notes, elements: Element[] }
Element = ShapeElement | TextElement | LatexElement | CodeElement | ImageElement | PenElement | ConnectorElement
```

- `Element` is a discriminated union on `type`. Switch exhaustively and assign to `never` in the default branch.
- Geometry (`x`, `y`, `width`, `height`, `rotation`) lives on elements. Connectors have no geometry; it is derived.
- Text styling is nested: `element.text` is a `TextBlock` for `text` and for the optional label on shapes.
- Pen strokes own their thickness as `pen.strokeWidth`; `x`/`y`/`width`/`height` are the derived point bounds. Never use the bounds as a stroke width. Resizing goes through `resizePen()`, which scales the points onto the requested box and leaves the thickness unchanged.
- Animations are `element.animations: AnimationSpec[]`, each with its own stable `a<n>` id.

## Stores

Two Zustand stores in `model/store.ts`:

- `useDocStore` — `doc`, `past`, `future`, and actions. Only this store may change the document.
- `useUiStore` — `activeSlideIndex`, `selectedIds`, `tool`, `zoom`, `pan`, `editing`, `guides`, `presenting`.

Selection lives in the UI store so undo cannot clear it accidentally. After any document change, `pruneSelection()` drops ids that no longer exist.

## Writing an action

```ts
applyDoc('Move shape', (draft) => {
  const el = findElement(draft, id);
  if (el && 'x' in el) { el.x = x; el.y = y; }
});
```

Rules:

1. Actions receive a **deep-cloned draft** and mutate it. `structuredClone` on a deck is cheap and removes a whole class of aliasing bugs.
2. Use `applyDoc` for anything that should be undoable. Pass `{ history: false }` only for derived/no-op maintenance.
3. Never mutate `useDocStore.getState().doc` directly, and never `set({ doc })` from a component.
4. Continuous gestures call `beginTransaction()` on pointer-down and `commitTransaction(label)` on pointer-up. `applyDoc` inside a transaction does not push history.
5. Coalesce rapid inspector edits with `{ coalesce: 'e1:fontSize' }`; a second edit with the same key within 600 ms replaces the previous undo entry instead of stacking.
6. Validate after mutating when the operation can break references: deleting an element must delete connectors attached to it, in the same action.

## IDs

`model/ids.ts` exposes `nextId(doc, prefix)`. It scans the document for the highest numeric suffix with that prefix. Never use `Math.random()` or `Date.now()`; deterministic ids keep tests and round-trips stable.

## Validation

`model/validate.ts` returns `Diagnostic[]` (`error` | `warning` with `elementId`, `path`, `message`). Shared by the compiler and by actions that accept external data (import, paste).

- Errors: duplicate id, missing required value, connector pointing at a missing element (converted to a free point plus warning), negative width/height.
- Warnings: unknown property, malformed color, unknown animation effect.
- `assertValid(doc)` is for actions: it throws a developer error only if an action produced an invalid doc. Ship-time code never relies on the UI to catch it.

## Undo

- History stores full `Doc` snapshots, capped at 100.
- Undo/redo restores the snapshot and prunes selection and inline editing.
- One gesture = one undo step. Never leave a transaction open on pointer-up, even when the gesture is cancelled.
- Loading a file or applying code is a single undoable step labelled `Edit code` / `Import deck`.

## Rendering contract

Components derive everything from the doc. No component keeps a second copy of a property in `useState`, except transient interaction state (drag origin, marquee rect) that is discarded on pointer-up.
