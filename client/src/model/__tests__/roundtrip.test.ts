import { describe, expect, it } from 'vitest';
import { compile } from '../../compiler';
import { serializeDoc } from '../serialize';
import { createFigure } from '../factories';
import { createDemoDeck } from '../../samples/demoDeck';
import { fullFixture, randomDoc } from './fixtures';

function normalize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function roundTrip(sourceDoc: ReturnType<typeof fullFixture>) {
  const source = serializeDoc(sourceDoc);
  const result = compile(source);
  const errors = result.errors.filter((item) => item.severity === 'error');
  expect(errors).toEqual([]);
  expect(result.doc).not.toBeNull();
  expect(normalize(result.doc!.slides)).toEqual(normalize(sourceDoc.slides));
  return source;
}

describe('serialize → parse identity', () => {
  it('preserves every element property in the full fixture', () => {
    roundTrip(fullFixture());
  });

  it('preserves the demo deck', () => {
    roundTrip(createDemoDeck());
  });

  it('preserves a figure element and a lead/member group', () => {
    const doc = fullFixture();
    const slide = doc.slides[0];
    const figure = createFigure('f1', { x: 80, y: 90, width: 560, height: 380 }, {
      kind: 'graph',
      title: ' momentum',
      titleColor: '#223344',
      accentColor: '#ff8800',
      gridColor: '#eef0f2',
      axisColor: '#101010',
      fn: 'sine',
      a: 2,
      b: 1.5,
      c: 0.5,
      domain: 8,
    });
    const bar = createFigure('f2', { x: 90, y: 100, width: 480, height: 320 }, {
      kind: 'barchart',
      title: 'Sales',
      values: [10, 30, 20, 45],
    });
    const shape = slide.elements.find((el) => el.type !== 'connector')!;
    shape.group = 'g9';
    const groupMate = slide.elements.find((el) => el !== shape && el.type !== 'connector')!;
    groupMate.group = 'g9';
    shape.members = [groupMate.id];
    slide.elements.push(figure, bar);
    roundTrip(doc);
  });

  it('is deterministic', () => {
    const doc = fullFixture();
    expect(serializeDoc(doc)).toBe(serializeDoc(doc));
    expect(serializeDoc(doc)).toBe(serializeDoc(structuredClone(doc)));
  });

  it('holds for 200 seeded random decks', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const doc = randomDoc(seed);
      const source = serializeDoc(doc);
      const result = compile(source);
      const errors = result.errors.filter((item) => item.severity === 'error');
      if (errors.length > 0 || !result.doc) {
        throw new Error(`seed ${seed} failed to compile: ${JSON.stringify(errors.slice(0, 3))}`);
      }
      expect(normalize(result.doc.slides), `seed ${seed}`).toEqual(normalize(doc.slides));

      // Re-serializing the parsed document must be byte-identical.
      expect(serializeDoc(result.doc), `seed ${seed}`).toBe(source);
    }
  });
});
