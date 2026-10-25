import { describe, expect, it, beforeEach } from 'vitest';
import { compile } from '../../compiler';
import { serializeDoc } from '../../model/serialize';
import { createEmptyDoc, createSlide } from '../../model/factories';
import { canvasSize } from '../../model/types';
import { useDocStore, useUiStore } from '../../model/store';

function makeDoc(slides: ReturnType<typeof createSlide>[]) {
  return { version: 2, title: 'size', width: 1920, height: 1080, slides };
}

describe('slide width/height round-trip', () => {
  it('serializes an override and parses it back', () => {
    const slide = createSlide('s1', 'Small', { width: 960, height: 540 });
    const source = serializeDoc(makeDoc([slide]) as never);
    expect(source).toContain('width: 960;');
    expect(source).toContain('height: 540;');
    const result = compile(source);
    expect(result.errors.filter((item) => item.severity === 'error')).toEqual([]);
    expect(result.doc!.slides[0].width).toBe(960);
    expect(result.doc!.slides[0].height).toBe(540);
  });

  it('omits size for default-size slides and defaults resolve to 1920×1080', () => {
    const slide = createSlide('s1', 'Default', {});
    const source = serializeDoc(makeDoc([slide]) as never);
    expect(source).not.toContain('width:');
    expect(source).not.toContain('height:');
    const result = compile(source);
    expect(result.doc!.slides[0].width).toBeUndefined();
    expect(canvasSize(result.doc!.slides[0])).toEqual({ width: 1920, height: 1080 });
  });
});

describe('applyBoardSizeAll', () => {
  beforeEach(() => {
    const doc = createEmptyDoc();
    useDocStore.getState().setDoc(doc, 'reset', { history: false });
    useDocStore.setState({ doc, past: [], future: [] });
    useUiStore.setState({ activeSlideIndex: 0, selectedIds: [], editing: null, compilerErrors: [] });
  });

  it('sets the size on every slide in one undo step', () => {
    useDocStore.getState().addSlide();
    useDocStore.getState().addSlide();
    const pastBefore = useDocStore.getState().past.length;
    useDocStore.getState().applyBoardSizeAll(960, 540);
    const doc = useDocStore.getState().doc;
    for (const slide of doc.slides) {
      expect(slide.width).toBe(960);
      expect(slide.height).toBe(540);
    }
    expect(useDocStore.getState().past).toHaveLength(pastBefore + 1);
    useDocStore.getState().undo();
    for (const slide of useDocStore.getState().doc.slides) {
      expect(slide.width).toBeUndefined();
      expect(slide.height).toBeUndefined();
    }
  });
});
