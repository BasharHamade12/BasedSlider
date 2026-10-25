---
name: slide-dsl
description: The Basedslider slide language — grammar, canonical formatting, stable IDs, and how to add syntax without breaking round-trip. Use when changing the lexer, parser, serializer, or adding a new element type or property.
---

# Slide DSL

The DSL is the portable, human-readable form of a deck. The GUI document is authoritative; the DSL is generated from it and parsed back whenever the user types code.

Read `references/grammar.md` for the full grammar and every property.

## Non-negotiables

1. `serializeDoc(doc)` is **total and deterministic**: same doc in, same bytes out.
2. `parse(serializeDoc(doc))` deep-equals `doc` (derived fields excluded). Any parser/serializer change must keep the round-trip test green.
3. **IDs are emitted always.** They are the only thing keeping selection, connectors, and animation targets stable across recompiles.
4. A GUI action must never be able to emit code that fails to parse.
5. Unknown properties are diagnostics, never silent drops, and never crashes.

## Pipeline

`source → Lexer → Parser → validateDoc() → Doc`

- `compiler/lexer.ts` — scanner. Strings support `"` and backticks, escapes, and real newlines. Comments: `//` and `/* */`.
- `compiler/parser.ts` — recursive descent, collects `CompileError[]`, builds model objects directly with factories. There is no intermediate AST; do not reintroduce one.
- `compiler/index.ts` — `compile(source): { doc, errors }`. `doc` is `null` whenever `errors` contains an error.
- `model/validate.ts` — semantic checks shared by parsing and GUI actions.

## Adding a property

1. Add it to the type in `model/types.ts` (optional is safer).
2. Add the default in `model/factories.ts` if it must exist.
3. Parse it in `compiler/parser.ts` (`parseProps` for flat props, dedicated function for blocks).
4. Serialize it in `model/serialize.ts` in the canonical order for that element.
5. Add it to `validate.ts` if it has constraints.
6. Add the control to `panels/Inspector.tsx`.
7. Add it to a fixture in `model/__tests__/fixtures.ts` so round-trip covers it.

Never write a property in a different order in the serializer than in the documented order, or diffs churn.

## Adding an element type

1. Extend `Element` with an interface carrying a literal `type` tag.
2. Add a `create<Type>Element()` factory with sensible defaults and a fresh ID.
3. Add a keyword token, a `parse<Type>` method, and the token to `ELEMENT_KEYWORDS`.
4. Add `serialize<Type>` and register it in `serializeElement`.
5. Add a renderer case in `canvas/ElementView.tsx` and make `sw` exhaustive (`const _never: never = element`).
6. Add an inspector section, a toolbar/tool entry if creatable, and a fixture.

## Canonical formatting

```
slide "Name" {
    background: "#ffffff";

    rect "e1" {
        x: 100;
        y: 100;
        width: 400;
        height: 200;
        fill: "#ff0000";
    }
}
```

- 4 spaces per level, one property per line, trailing `;`.
- Blank line between the slide header/background and the first element, and between elements.
- Strings are double-quoted with `\\`, `\"`, `\n`, `\r`, `\t` escaped.
- Numbers are emitted without trailing zeros (`0.5`, `100`, `-3`).
- Omit optional properties that equal the factory default **only** if the parser restores exactly that default. When in doubt, emit.
- Animation and transition blocks are emitted only when they contain non-default values.

## ID rules

- Format `e<number>`, `c<number>`, `s<number>`, `g<number>`, `a<number>`.
- `model/ids.ts` derives the next counter by scanning the document; never keep a global counter across documents.
- IDs are immutable after creation. Duplicate IDs are a validation error.
- Deleting then undoing must restore the same IDs (the document snapshot does this naturally).

## Error behavior

- Compile errors leave the previous document intact. The code panel keeps the user's text; the console shows every diagnostic with line and column.
- Warnings (unknown property, odd color, unknown effect) do not block applying code.
- Never throw out of `compile()`.
