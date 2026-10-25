# Running the suites

```bash
cd client
npm test          # vitest run
npm run typecheck # tsc -b
npm run lint      # eslint .
npm run build     # tsc -b && vite build
```

The canonical identity check lives in `src/model/__tests__/roundtrip.test.ts`.
Fixtures and the seeded generator live in `src/model/__tests__/fixtures.ts`.
