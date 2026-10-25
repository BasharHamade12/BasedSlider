import { describe, expect, it } from 'vitest';
import { compile } from '../../compiler';
import { serializeDoc } from '../serialize';
import { createSlide } from '../factories';

function roundTripDoc(slides: ReturnType<typeof createSlide>[]) {
  const doc = { version: 2, title: 'bg', width: 1920, height: 1080, slides };
  const source = serializeDoc(doc as never);
  const result = compile(source);
  const errors = result.errors.filter((item) => item.severity === 'error');
  expect(errors).toEqual([]);
  expect(serializeDoc(result.doc!)).toBe(source);
  return { source, parsed: result.doc! };
}

describe('slide backgroundImage round-trip', () => {
  it('serializes and parses backgroundImage', () => {
    const slide = createSlide('s1', 'Bg', { backgroundImage: 'data:image/png;base64,AAA' });
    const { source, parsed } = roundTripDoc([slide]);
    // `background` with a default #ffffff always appears, and the new
    // `backgroundImage` property sits right after it.
    expect(source).toContain('backgroundImage: "data:image/png;base64,AAA";');
    expect(parsed.slides[0].backgroundImage).toBe('data:image/png;base64,AAA');
  });

  it('omits backgroundImage when unset', () => {
    const slide = createSlide('s1', 'Plain', {});
    const { source, parsed } = roundTripDoc([slide]);
    expect(source).not.toContain('backgroundImage');
    expect(parsed.slides[0].backgroundImage).toBeUndefined();
  });
});
