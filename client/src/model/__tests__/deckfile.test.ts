import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compile } from '../../compiler';

const source = readFileSync(resolve(process.cwd(), '../decks/edge-theorem-partial.slide'), 'utf8');

describe('recreated Edge Theorem deck', () => {
  it('compiles without errors', () => {
    const result = compile(source);
    const errors = result.errors.filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);
    expect(result.doc).not.toBeNull();
  });
});
