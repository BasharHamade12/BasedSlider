---
name: roundtrip-testing
description: Required test patterns for the DSL, document model, and geometry, including the serialize→parse identity check and seeded fuzzing. Use when adding syntax, changing the serializer, touching document actions, or before finishing any feature.
---

# Round-trip and correctness testing

The core promise is: **the generated script always parses and always describes the document exactly.** Tests enforce it; manual checking does not.

Run with `npm test` (Vitest). Add `npm run typecheck`, `npm run lint`, `npm run build` before declaring work done.

## The identity test

```ts
expect(parse(serializeDoc(doc)).doc).toEqual(doc);
```

Rules for making this hold:

- Fixtures are built with factories, so every field has its final default.
- The serializer emits every field the parser cannot infer (especially ids, rotation, opacity, animation ids).
- Derived-only fields (pen `x`/`y`, connector geometry, measurements) are normalized before comparison.
- `parse` never leaves `undefined` where the fixture has `null` (pick one and keep it).

## Required suites

| File | Covers |
|---|---|
| `compiler/__tests__/lexer.test.ts` | escapes, multiline strings, comments, numbers, unknown characters |
| `compiler/__tests__/parser.test.ts` | every element, nested text, connector forms, animations, error recovery, unknown props |
| `model/__tests__/serialize.test.ts` | canonical output, escaping, property order, omission rules |
| `model/__tests__/roundtrip.test.ts` | identity over fixtures + 200 seeded random docs |
| `model/__tests__/history.test.ts` | undo/redo, transaction coalescing, selection pruning, delete-with-connectors |
| `model/__tests__/validate.test.ts` | duplicate ids, dangling connector, negative sizes, unknown effect |
| `geometry/__tests__/connectors.test.ts` | anchors, auto port, elbow, arrowheads |
| `geometry/__tests__/measure.test.ts` | wrapping, autofit, fallback without canvas |
| `presentation/__tests__/schedule.test.ts` | trigger grouping, delays, exit order |

## Fuzzing

`model/__tests__/fixtures.ts` exports `randomDoc(seed)`. Use a small deterministic PRNG (mulberry32); never `Math.random()`.

Generate 1–5 slides and 0–12 elements per slide, drawing from every type. Keep values valid:

- IDs unique within the doc.
- Connectors reference element IDs that exist.
- Strings include quotes, newlines, backslashes, and unicode.
- Numbers include negatives and decimals; sizes stay ≥ 4.
- Colors from a small valid set.

Assert round-trip and `validateDoc(doc)` with zero errors. Print the seed on failure so it is reproducible.

## Behaviour tests

- Every action that can delete must be tested for dangling references.
- Drag coalescing: `beginTransaction`, five `applyDoc` calls, `commitTransaction` → exactly one history entry.
- Applying invalid code must leave the previous doc untouched: `applyCode()` returns false and the doc is byte-identical.
- Deleting an element removes attached connectors in one step and undo restores both.

## Rules

1. Do not weaken an assertion to make a change pass. Fix the serializer/parser instead.
2. A new element or property is not done until a fixture exercises it.
3. Never mock the document model in geometry tests; build real elements with factories.
4. Keep tests pure (no DOM) except where a hook requires it; prefer extracting logic into plain functions.
5. When a test exposes a bug, add the minimal failing case to the fixture set permanently.
