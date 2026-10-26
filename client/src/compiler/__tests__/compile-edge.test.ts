import { describe, expect, it } from 'vitest';
import { compile } from '../index';
import { serializeDoc } from '../../model/serialize';

describe('compiler edge cases', () => {
  it('parses a deck with only unknown tokens by skipping into errors', () => {
    const result = compile('@ # $ %');
    expect(result.doc).toBeNull();
    expect(result.errors.some((item) => item.severity === 'error')).toBe(true);
  });

  it('keeps parsing after a syntax error and still reports what it can', () => {
    const source = `slide "One" {
    rect "e1" {
        x: 1;
        y: 1;
        width: 10;
        height: 10;
    }

slide "Broken" {
`;
    const result = compile(source);
    expect(result.doc).toBeNull();
    expect(result.errors.some((item) => item.severity === 'error')).toBe(true);
  });

  it('accepts a slide name string with escaped quotes', () => {
    const source = `slide "Say \\"hi\\"" {
    rect "e1" { x: 0; y: 0; width: 1; height: 1; }
}
`;
    const result = compile(source);
    expect(result.doc).not.toBeNull();
    expect(result.doc!.slides[0].name).toBe('Say "hi"');
  });

  it('preserves explicit animation IDs nested inside their element', () => {
    const source = `slide "Ids" {
    rect "e2" {
        x: 0; y: 0; width: 1; height: 1;
        animate { id: "a2"; effect: "fadeIn"; }
        animate { id: "a1"; effect: "fadeOut"; }
    }
}
`;
    const result = compile(source);
    expect(result.doc).not.toBeNull();
    const element = result.doc!.slides[0].elements[0];
    expect(element.animations.map((animation) => animation.id)).toEqual(['a2', 'a1']);
    expect(serializeDoc(result.doc!)).toContain('id: "a2";');
  });

  it('reuses explicit ids when they are not duplicates', () => {
    const source = `slide "Explicit" {
    rect "e10" { x: 0; y: 0; width: 1; height: 1; }
    rect "e11" { x: 0; y: 0; width: 1; height: 1; }
}
`;
    const result = compile(source);
    expect(result.doc).not.toBeNull();
    expect(result.doc!.slides[0].elements.map((el) => el.id)).toEqual(['e10', 'e11']);
  });

  it('produces deterministic source for identical documents', () => {
    const source = `slide "T" {
    rect "e1" { x: 10; y: 20; width: 30; height: 40; }
}
`;
    const first = compile(source);
    expect(first.doc).not.toBeNull();
    const roundtripped = compile(serializeDoc(first.doc!)).doc!;
    expect(serializeDoc(roundtripped)).toBe(serializeDoc(first.doc!));
  });

  it('rejects animation blocks outside an element instead of silently dropping them', () => {
    const source = `slide "Orphan" {
    rect "e1" { x: 0; y: 0; width: 1; height: 1; }
    animate { id: "a1"; effect: "fadeIn"; }
}
`;
    const result = compile(source);
    expect(result.doc).toBeNull();
    expect(result.errors.some((item) => item.severity === 'error')).toBe(true);
  });

  it('parses a connector whose endpoint string has no explicit port', () => {
    const source = `slide "Link" {
    rect "e1" { x: 0; y: 0; width: 100; height: 60; }
    connector "c1" { from: "e1"; to: { x: 200; y: 200; }; }
}
`;
    const result = compile(source);
    expect(result.doc).not.toBeNull();
    const connector = result.doc!.slides[0].elements.find((el) => el.type === 'connector')!;
    expect(connector.type).toBe('connector');
    if (connector.type === 'connector') {
      expect(connector.from).toEqual({ kind: 'element', elementId: 'e1', port: 'auto' });
    }
  });

  it('parses a multiline code block content with embedded newlines', () => {
    const source = `slide "Code" {
    code "e1" {
        x: 0; y: 0; width: 400; height: 200;
        content: "line one\\nline two\\nline three";
    }
}
`;
    const result = compile(source);
    expect(result.doc).not.toBeNull();
    const code = result.doc!.slides[0].elements[0];
    expect(code.type).toBe('code');
    if (code.type === 'code') {
      expect(code.content).toBe('line one\nline two\nline three');
    }
  });

  it('reads showLanguage on code blocks and defaults it to visible', () => {
    const source = compile(`slide "Code" {
    code "e1" {
        x: 0; y: 0; width: 400; height: 200;
        showLanguage: false;
    }
    code "e2" {
        x: 0; y: 240; width: 400; height: 200;
    }
}
`);
    const [hidden, shown] = source.doc!.slides[0].elements;
    expect(hidden.type === 'code' && hidden.showLanguage).toBe(false);
    expect(shown.type === 'code' && shown.showLanguage).toBe(true);
  });
});
