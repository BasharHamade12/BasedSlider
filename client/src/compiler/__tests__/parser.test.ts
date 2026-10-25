import { describe, expect, it } from 'vitest';
import { compile } from '../index';
import { serializeDoc } from '../../model/serialize';
import { createEmptyDoc } from '../../model/factories';

const MINIMAL = `slide "One" {
    id: "s1";
    background: "#101114";

    rect "e1" {
        x: 10;
        y: 20;
        width: 30;
        height: 40;
        fill: "#ff0000";
        text {
            content: "Label";
            fontSize: 24;
            color: "#ffffff";
        }
    }
}
`;

describe('parser', () => {
  it('parses a slide with all base properties fixed', () => {
    const result = compile(MINIMAL);
    expect(result.errors.filter((item) => item.severity === 'error')).toEqual([]);
    const doc = result.doc!;
    expect(doc.slides[0].id).toBe('s1');
    expect(doc.slides[0].background).toBe('#101114');
    const element = doc.slides[0].elements[0];
    expect(element.type).toBe('rect');
    if (element.type === 'rect') {
      expect(element.width).toBe(30);
      expect(element.text?.content).toBe('Label');
      expect(element.text?.fontSize).toBe(24);
    }
  });

  it('parses connectors with element and free-point endpoints', () => {
    const source = `slide "Links" {
    rect "e1" {
        x: 0;
        y: 0;
        width: 100;
        height: 60;
    }

    connector "c1" {
        from: "e1:right";
        to: { x: 400; y: 200; };
        routing: "curved";
        endArrow: "diamond";
        label: "flows";
    }
}
`;
    const result = compile(source);
    expect(result.doc).not.toBeNull();
    const connector = result.doc!.slides[0].elements.find((item) => item.type === 'connector')!;
    expect(connector.type).toBe('connector');
    if (connector.type === 'connector') {
      expect(connector.from).toEqual({ kind: 'element', elementId: 'e1', port: 'right' });
      expect(connector.to).toEqual({ kind: 'point', x: 400, y: 200 });
      expect(connector.routing).toBe('curved');
      expect(connector.endArrow).toBe('diamond');
    }
  });

  it('parses images with a data source, fit, and corner radius', () => {
    const source = `slide "Art" {
    image "e1" {
        x: 100;
        y: 60;
        width: 800;
        height: 450;
        src: "data:image/png;base64,iVBORw0KGgo=";
        fit: "cover";
        radius: 12;
    }
}
`;
    const result = compile(source);
    expect(result.errors.filter((item) => item.severity === 'error')).toEqual([]);
    const image = result.doc!.slides[0].elements[0];
    expect(image.type).toBe('image');
    if (image.type === 'image') {
      expect(image.src).toBe('data:image/png;base64,iVBORw0KGgo=');
      expect(image.fit).toBe('cover');
      expect(image.radius).toBe(12);
      expect(image.width).toBe(800);
    }
  });

  it('parses animations and slide transitions', () => {
    const source = `slide "Animated" {
    transition {
        type: "fade";
        direction: "up";
        duration: 250;
    }

    text "e1" {
        x: 0;
        y: 0;
        content: "Hi";

        animate {
            id: "a1";
            effect: "slideIn";
            trigger: "onClick";
            duration: 300;
            delay: 50;
            direction: "left";
            repeat: 2;
        }
    }
}
`;
    const result = compile(source);
    const doc = result.doc!;
    expect(doc.slides[0].transition.type).toBe('fade');
    expect(doc.slides[0].transition.duration).toBe(250);
    const element = doc.slides[0].elements[0];
    expect(element.animations[0]).toMatchObject({
      id: 'a1',
      effect: 'slideIn',
      trigger: 'onClick',
      duration: 300,
      delay: 50,
      direction: 'left',
      repeat: 2,
    });
  });

  it('parses pen points and derives bounds', () => {
    const source = `slide "Ink" {
    pen "e1" {
        color: "#e03131";
        width: 4;
        smoothing: true;
        points: [
            { x: 100; y: 120; pressure: 0.5; },
            { x: 200; y: 220; pressure: 0.7; },
        ];
    }
}
`;
    const result = compile(source);
    expect(result.doc).not.toBeNull();
    const pen = result.doc!.slides[0].elements[0];
    if (pen.type === 'pen') {
      expect(pen.points).toHaveLength(2);
      expect(pen.x).toBe(100);
      expect(pen.width).toBe(100);
    }
  });

  it('warns about unknown properties without rejecting the document', () => {
    const source = `slide "Warn" {
    text "e1" {
        x: 0;
        y: 0;
        content: "Hi";
        sparkle: true;
    }
}
`;
    const result = compile(source);
    expect(result.doc).not.toBeNull();
    expect(
      result.errors.some(
        (item) => item.severity === 'warning' && item.message.includes('sparkle'),
      ),
    ).toBe(true);
  });

  it('returns no document on syntax errors', () => {
    const result = compile('slide "Broken" {\n rect "e1" {');
    expect(result.doc).toBeNull();
    expect(result.errors.some((item) => item.severity === 'error')).toBe(true);
  });

  it('round-trips a parsed document back to the same source', () => {
    const first = compile(MINIMAL).doc!;
    const second = compile(serializeDoc(first)).doc!;
    expect(serializeDoc(second)).toBe(serializeDoc(first));
  });

  it('parses an empty slide', () => {
    const result = compile('slide "Empty" {}\n');
    expect(result.doc).not.toBeNull();
    expect(result.doc!.slides[0].elements).toEqual([]);
  });

  it('keeps the default deck dimensions', () => {
    const doc = createEmptyDoc();
    expect(doc.width).toBe(1920);
    expect(doc.height).toBe(1080);
  });
});
