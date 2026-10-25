import { describe, expect, it } from 'vitest';
import { compile } from '../../compiler';
import { serializeDoc } from '../serialize';

const ALL_PROPERTIES = `slide "Script editable" {
    id: "s1";
    background: "#101114";
    notes: "speaker notes";
    transition {
        type: "zoom";
        direction: "down";
        duration: 725;
        easing: "backOut";
    }

    rect "e1" {
        x: 11; y: 12; width: 300; height: 180;
        name: "Primary"; group: "g1"; rotation: 15; opacity: 0.75; locked: true; hidden: true;
        fill: "#123456"; stroke: "#abcdef"; strokeWidth: 3; dash: 4; radius: 16;
        shadow { x: 2; y: 8; blur: 20; color: "#00000088"; }
        text {
            content: "Shape label"; fontFamily: "Georgia, serif"; fontSize: 26; fontWeight: 700;
            italic: true; underline: true; align: "center"; lineHeight: 1.5;
            letterSpacing: 2; color: "#ffffff"; autofit: true;
        }
        animate {
            id: "a1"; effect: "slideIn"; trigger: "onClick"; duration: 400;
            delay: 75; easing: "easeIn"; direction: "left"; repeat: 3;
        }
    }

    ellipse "e2" { x: 20; y: 30; width: 80; height: 60; fill: "#ff0000"; }
    triangle "e3" { x: 30; y: 40; width: 90; height: 70; stroke: "#00ff00"; }
    line "e4" { x: 40; y: 50; width: 100; height: 2; stroke: "#0000ff"; strokeWidth: 2; dash: 6; }
    polygon "e5" { x: 50; y: 60; width: 100; height: 80; fill: "#ffaa00"; }
    star "e6" { x: 60; y: 70; width: 120; height: 120; fill: "#aa00ff"; }

    text "e7" {
        x: 100; y: 200; width: 500; height: 120;
        name: "Body"; group: "g2"; rotation: -5; opacity: 0.8; locked: true; hidden: true;
        content: "Paragraph"; fontFamily: "Arial, Helvetica, sans-serif"; fontSize: 42;
        fontWeight: 600; italic: true; underline: true; align: "right";
        lineHeight: 1.4; letterSpacing: 1.25; color: "#334455"; autofit: true;
    }

    latex "e8" {
        x: 110; y: 210; width: 400; height: 90;
        name: "Formula"; group: "g3"; rotation: 3; opacity: 0.7; locked: true; hidden: true;
        content: "\\\\int_0^1 x^2 dx"; displayMode: false; fontSize: 28;
    }

    code "e9" {
        x: 120; y: 220; width: 600; height: 240;
        name: "Snippet"; group: "g4"; rotation: 4; opacity: 0.6; locked: true; hidden: true;
        content: "const answer = 42;\\nconsole.log(answer);";
        language: "javascript"; theme: "light"; fontSize: 16; lineNumbers: false;
        color: "#222222"; background: "#eeeeee";
    }

    image "e10" {
        x: 130; y: 230; width: 500; height: 300;
        name: "Artwork"; group: "g5"; rotation: 6; opacity: 0.9; locked: true; hidden: true;
        src: "data:image/png;base64,AA=="; fit: "cover"; radius: 20;
    }

    pen "e11" {
        name: "Ink"; group: "g6"; rotation: 10; opacity: 0.5; locked: true; hidden: true;
        color: "#e03131"; width: 5; smoothing: false; mode: "highlighter";
        points: [
            { x: 10; y: 20; pressure: 0.4; tiltX: 5; tiltY: 6; },
            { x: 50; y: 80; pressure: 0.8; tiltX: 7; },
        ];
    }

    connector "c1" {
        name: "Relationship"; group: "g7"; locked: true; hidden: true;
        from: "e1:right"; to: "e2:left"; routing: "curved";
        startArrow: "diamond"; endArrow: "open"; arrowSize: 18; width: 2.5;
        dash: 5; color: "#008855"; label: "connects";
        animate {
            id: "a2"; effect: "pulse"; trigger: "withPrevious"; duration: 250;
            delay: 20; easing: "linear"; direction: "up"; repeat: 2;
        }
    }
}
`;

function normalized<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('script-editable properties', () => {
  it('accepts every slide and element property exposed by the editor', () => {
    const result = compile(ALL_PROPERTIES);
    expect(result.errors.filter((item) => item.severity === 'error')).toEqual([]);
    expect(result.doc).not.toBeNull();
    const slide = result.doc!.slides[0];
    expect(slide).toMatchObject({
      id: 's1', name: 'Script editable', background: '#101114', notes: 'speaker notes',
      transition: { type: 'zoom', direction: 'down', duration: 725, easing: 'backOut' },
    });

    const [shape, ellipse, triangle, line, polygon, star, text, latex, code, image, pen, connector] = slide.elements;
    expect(slide.elements.map((element) => element.type)).toEqual([
      'rect', 'ellipse', 'triangle', 'line', 'polygon', 'star', 'text', 'latex', 'code', 'image', 'pen', 'connector',
    ]);
    expect(shape).toMatchObject({
      id: 'e1', name: 'Primary', group: 'g1', x: 11, y: 12, width: 300, height: 180,
      rotation: 15, opacity: 0.75, locked: true, hidden: true, fill: '#123456', stroke: '#abcdef',
      strokeWidth: 3, dash: 4, radius: 16, shadow: { x: 2, y: 8, blur: 20, color: '#00000088' },
      text: { content: 'Shape label', fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700,
        italic: true, underline: true, align: 'center', lineHeight: 1.5, letterSpacing: 2, color: '#ffffff', autofit: true },
      animations: [{ id: 'a1', effect: 'slideIn', trigger: 'onClick', duration: 400, delay: 75,
        easing: 'easeIn', direction: 'left', repeat: 3 }],
    });
    expect([ellipse, triangle, line, polygon, star].every((element) => element.type !== 'connector')).toBe(true);
    expect(text).toMatchObject({ type: 'text', name: 'Body', group: 'g2', rotation: -5, opacity: 0.8, locked: true, hidden: true,
      text: { content: 'Paragraph', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 42, fontWeight: 600,
        italic: true, underline: true, align: 'right', lineHeight: 1.4, letterSpacing: 1.25, color: '#334455', autofit: true } });
    expect(latex).toMatchObject({ type: 'latex', name: 'Formula', group: 'g3', rotation: 3, opacity: 0.7, locked: true, hidden: true,
      content: '\\int_0^1 x^2 dx', displayMode: false, fontSize: 28 });
    expect(code).toMatchObject({ type: 'code', name: 'Snippet', group: 'g4', rotation: 4, opacity: 0.6, locked: true, hidden: true,
      content: 'const answer = 42;\nconsole.log(answer);', language: 'javascript', theme: 'light', fontSize: 16,
      lineNumbers: false, color: '#222222', background: '#eeeeee' });
    expect(image).toMatchObject({ type: 'image', name: 'Artwork', group: 'g5', rotation: 6, opacity: 0.9, locked: true, hidden: true,
      src: 'data:image/png;base64,AA==', fit: 'cover', radius: 20 });
    expect(pen).toMatchObject({ type: 'pen', name: 'Ink', group: 'g6', rotation: 10, opacity: 0.5, locked: true, hidden: true,
      color: '#e03131', strokeWidth: 5, smoothing: false, mode: 'highlighter',
      points: [{ x: 10, y: 20, pressure: 0.4, tiltX: 5, tiltY: 6 }, { x: 50, y: 80, pressure: 0.8, tiltX: 7 }] });
    expect(connector).toMatchObject({ type: 'connector', id: 'c1', name: 'Relationship', group: 'g7', locked: true, hidden: true,
      from: { kind: 'element', elementId: 'e1', port: 'right' }, to: { kind: 'element', elementId: 'e2', port: 'left' },
      routing: 'curved', startArrow: 'diamond', endArrow: 'open', arrowSize: 18, width: 2.5, dash: 5, color: '#008855', label: 'connects',
      animations: [{ id: 'a2', effect: 'pulse', trigger: 'withPrevious', duration: 250, delay: 20, easing: 'linear', direction: 'up', repeat: 2 }] });
  });

  it('round-trips the complete property scenario without changing the script', () => {
    const first = compile(ALL_PROPERTIES);
    expect(first.doc).not.toBeNull();
    const serialized = serializeDoc(first.doc!);
    const second = compile(serialized);
    expect(second.errors.filter((item) => item.severity === 'error')).toEqual([]);
    expect(normalized(second.doc!.slides)).toEqual(normalized(first.doc!.slides));
    expect(serializeDoc(second.doc!)).toBe(serialized);
  });
});
