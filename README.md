# Basedslider

A slide-deck editor built around a small custom slide language. Edit decks visually on a canvas or as code — both stay in sync, and either form round-trips losslessly.

## How to run

Requirements: Node.js 18+ and npm.

```bash
cd client
npm install
npm run dev
```

Vite serves the editor at http://localhost:5173 with hot reload.

### Other commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm test` | Run the test suite once (Vitest + happy-dom) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | TypeScript type check (`tsc -b`) |
| `npm run lint` | ESLint |
| `npm run build` | Type check and build for production (`dist/`) |

All commands run from `client/`.

## What it does

- **Canvas editor** — drag, resize (8 handles), rotate, marquee-select, group, snap to grid/alignments. The slide canvas itself is resizable: drag its bottom-right corner, then optionally apply that size to every slide (or set exact width/height in the properties panel). Elements: shapes (rect, ellipse, triangle, line, polygon, star), text, LaTeX (KaTeX), code blocks (Monaco), images, pen strokes, and connectors.
- **Code panel** — the whole deck is editable as plain text in a custom DSL. Code compiles to the document on pause; invalid code leaves the document untouched and reports diagnostics with line/column.
- **Round trip** — the GUI document is authoritative; the DSL is generated from it (`serializeDoc`) and parsed back (`compile`) losslessly and deterministically.
- **Undo/redo** — full document snapshots, one undo step per gesture or inspector edit.
- **Presentation mode** — fullscreen presenting with slide transitions and per-element animations (enter/emphasis/exit, click or timed triggers).
- **HTML embeds** — the toolbar's HTML button imports a local `.html` file as a live embed (or pick “Blank embed” from its caret menu); the inspector edits the page URL, the HTML source, corner radius and reloads the frame. **Import PDF** turns each page into its own slide with the page as that slide's background image (not an element) and the canvas sized to the page's content box — the blank margins of the sheet are trimmed away, keeping a small ~2% margin around the text — so you can annotate on top of it with any tool.
- **Autosave** — the deck is saved to `localStorage` 600 ms after each change.

## Project layout

```
client/
  src/
    model/        Document model: types, factories, Zustand stores, undo history, validation
    compiler/     Slide DSL: lexer, parser, compile()
    canvas/       SVG canvas, element renderers, pointer interaction, inline text editing
    panels/       Inspector (properties), toolbar, slide rail, code panel
    presentation/ Present mode, animation scheduling, effects
    geometry/     Text measurement/wrapping, shape paths, connector routing
    persistence/  localStorage load/save, import/export
    samples/      Demo deck
docs/
  slide-language.md   Full reference for the slide DSL
decks/
  *.slide             Example decks
.claude/skills/       Agent skills documenting each subsystem's invariants
```

## The slide language

```
slide "Title" {
    background: "#f6f9fc";

    text "e1" {
        x: 160; y: 330; width: 1600; height: 120;
        content: "Hello, world";
        fontSize: 56; fontWeight: 700; align: "center";
        animate { effect: "fadeIn"; trigger: "afterPrevious"; duration: 400; }
    }

    rect "e2" {
        x: 760; y: 560; width: 400; height: 200;
        fill: "#4c9aff"; radius: 12;
        text { content: "Label"; fontSize: 24; align: "center"; }
    }
}
```

See [docs/slide-language.md](docs/slide-language.md) for the complete grammar, every element and property, animations, connectors, and the validation rules. [decks/edge-theorem-partial.slide](decks/edge-theorem-partial.slide) is a real example deck.

## Architecture notes

- `model/` is the single source of truth — canvas, inspector, code panel, layers, and presentation all read from the same Zustand stores (`useDocStore` for the document, `useUiStore` for selection/zoom/presenting). Nothing else owns slide data.
- Pipeline for code edits: `source → Lexer → Parser → validateDoc() → Doc`. Hard errors leave the previous document intact; warnings never block.
- Element ids (`e1`, `c1`, `a1`, …) are stable across recompiles — they keep selection, connectors, and animation targets anchored.
- The slide is always 1920×1080 in document units; the canvas scales to fit its container.
- `.claude/skills/` documents the invariants of each subsystem (round-trip rules, undo rules, pointer state machine) — read the relevant one before changing that area.
