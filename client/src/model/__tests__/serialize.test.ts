import { describe, expect, it } from 'vitest';
import { createImage, createPen, createText } from '../factories';
import { quote, serializeDoc, serializeSlide } from '../serialize';
import { createEmptyDoc } from '../factories';
import { compile } from '../../compiler';

describe('serializer', () => {
  it('escapes quotes, backslashes, newlines, and tabs', () => {
    expect(quote('a"b\\c\nd\te')).toBe('"a\\"b\\\\c\\nd\\te"');
  });

  it('emits slide ids so reordering cannot change identity', () => {
    const doc = createEmptyDoc();
    doc.slides[0].id = 's7';
    const source = serializeDoc(doc);
    expect(source).toContain('id: "s7";');
  });

  it('emits the element id in the header', () => {
    const doc = createEmptyDoc();
    doc.slides[0].elements.push(
      createText('e42', { x: 10, y: 20 }, {}, { content: 'Hi' }),
    );
    expect(serializeDoc(doc)).toContain('text "e42" {');
  });

  it('omits default optional text properties but keeps content', () => {
    const doc = createEmptyDoc();
    doc.slides[0].elements.push(
      createText('e1', { x: 0, y: 0 }, {}, { content: 'Hello' }),
    );
    const source = serializeSlide(doc.slides[0]);
    expect(source).toContain('content: "Hello";');
    expect(source).not.toContain('fontSize');
    expect(source).not.toContain('fontFamily');
  });

  it('emits animation ids and transition blocks', () => {
    const doc = createEmptyDoc();
    doc.slides[0].transition = {
      type: 'fade',
      direction: 'up',
      duration: 300,
      easing: 'linear',
    };
    doc.slides[0].elements.push(
      createText(
        'e1',
        { x: 0, y: 0 },
        {
          animations: [
            {
              id: 'a9',
              effect: 'fadeIn',
              trigger: 'onClick',
              duration: 500,
              delay: 0,
              easing: 'easeOut',
              direction: 'up',
              repeat: 1,
            },
          ],
        },
        { content: 'Animated' },
      ),
    );
    const source = serializeSlide(doc.slides[0]);
    expect(source).toContain('transition {');
    expect(source).toContain('animate {');
    expect(source).toContain('id: "a9";');
  });

  it('keeps pen stroke width separate from pen bounds', () => {
    const doc = createEmptyDoc();
    const pen = createPen(
      'e1',
      [
        { x: 100, y: 100, pressure: 0.5 },
        { x: 300, y: 180, pressure: 0.5 },
      ],
      { strokeWidth: 7 },
    );
    doc.slides[0].elements.push(pen);

    expect(pen.width).toBe(200);
    expect(pen.height).toBe(80);
    const source = serializeSlide(doc.slides[0]);
    expect(source).toContain('width: 7;');

    const parsed = compile(source).doc?.slides[0].elements[0];
    expect(parsed?.type).toBe('pen');
    if (parsed?.type === 'pen') {
      expect(parsed.strokeWidth).toBe(7);
      expect(parsed.width).toBe(200);
      expect(parsed.height).toBe(80);
    }
  });

  it('keeps image sources and omits default fit and radius', () => {
    const doc = createEmptyDoc();
    doc.slides[0].elements.push(
      createImage('e1', { x: 0, y: 0 }, { src: 'https://example.com/a.png' }),
    );
    const source = serializeSlide(doc.slides[0]);
    expect(source).toContain('image "e1" {');
    expect(source).toContain('src: "https://example.com/a.png";');
    expect(source).not.toContain('fit:');
    expect(source).not.toContain('radius:');
  });

  it('produces empty output for a deck with no slides', () => {
    const doc = createEmptyDoc();
    doc.slides = [];
    expect(serializeDoc(doc)).toBe('');
  });
});
