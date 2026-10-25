---
name: editor-ui-conventions
description: Layout, panel, control, and styling conventions for the editor chrome. Use when adding a toolbar action, inspector control, panel, dialog, or keyboard shortcut so it matches the rest of the app.
---

# Editor UI conventions

## Layout

```
TopToolbar
SlideRail            (thumbnails, add/duplicate/delete, drag to reorder)
┌──────────┬──────────────────────┬────────────┐
│ Code /   │ Canvas               │ Inspector  │
│ Layers   │ (zoom, pan, guides)  │ (context)  │
└──────────┴──────────────────────┴────────────┘
Console              (diagnostics, collapsible)
```

- Fixed dark theme; tokens live in `src/index.css` (`--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--accent`, `--green`, `--red`, `--radius`).
- Never hardcode a color in a component unless it is a user-facing swatch default. Use the CSS variables.
- Panels scroll independently; the app itself never scrolls (`overflow: hidden` on `html, body, #root`).
- The code and properties panels are independently collapsible. A collapse button lives in each panel header; when collapsed, a slim restore handle sits on the corresponding edge of the canvas. State lives in `useUiStore` (`leftCollapsed`, `rightCollapsed`). The slide rail collapses the same way: a collapse button at the rail's right edge, a slim "Slides" restore strip when hidden (`railCollapsed`).

## Controls (`panels/controls.tsx`)

Use these primitives instead of raw inputs, so numeric parsing and undo coalescing stay consistent:

- `NumberField` — commits on blur/Enter, arrows step by 1 (shift ×10), clamps to `min`/`max`.
- `SliderField` — live preview, coalesced undo key.
- `ColorField` — swatch + text, accepts hex/rgb/hsl/none/gradient.
- `SelectField` — options array, typed values.
- `ToggleField`, `Segmented`, `TextArea`.
- `Section` — collapsible group with an icon and title.
- `IconButton` — always has `title` and `aria-label`.

Every control receives `label`, `value`, `onChange`, and optionally `coalesce`. Controls never read the store; the inspector does.

## Inspector

- Sections appear only for properties the selected type has.
- Multi-select shows transform + arrange (align/distribute) and hides type-specific sections.
- No selection shows slide properties (background, transition, notes).
- Every edit goes through a store action; no local copies of document values.
- Show derived values (connector id, measured size) as read-only text.

## Toolbar

- Order: undo/redo · slides · shapes · text · latex · code · image · pen · connector · spacer · zoom · preview · present · file menu.
- Icon buttons are 34×34, active state uses `--accent`.
- Tooltips via `title`, no custom tooltip component.
- Destructive actions (delete slide) require a confirm only when data loss is not undoable; selection/scene edits rely on undo.

## Keyboard

| Key | Action |
|---|---|
| `Ctrl/Cmd+Z` / `Shift+Ctrl/Cmd+Z` | undo / redo |
| `Ctrl/Cmd+C` / `V` / `D` | copy / paste / duplicate |
| `Delete` / `Backspace` | delete selection |
| Arrows / Shift+Arrows | nudge 1 / 10 px |
| `V`, `R`, `T`, `L`, `C`, `P` | select, rect, text, latex, code, pen tools |
| `Escape` | cancel gesture, close menu, exit edit, exit presentation |
| `Space` (hold) | pan |
| `Ctrl/Cmd+0` | fit to window |
| `F5` / `Shift+F5` | present from start / current slide |

Shortcuts are ignored while focus is in an input, textarea, Monaco, or contentEditable.

## Feedback

- Console shows compiler diagnostics with `phase`, `line:column`, and message; zero errors shows a quiet "No errors" line.
- Toasts are not used; transient problems go to the console.
- Loading and empty states are explicit ("No slides yet", "No selection").

## Accessibility

- Buttons are real `<button>` elements with labels.
- Color is never the only signal; errors include text.
- Presentation mode traps focus and restores it on exit.
