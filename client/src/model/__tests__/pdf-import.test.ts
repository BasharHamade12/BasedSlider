import { describe, expect, it, beforeEach } from 'vitest';
import { createEmptyDoc } from '../factories';
import { useDocStore, useUiStore } from '../store';

describe('importPdfPages', () => {
  beforeEach(() => {
    const doc = createEmptyDoc();
    useDocStore.getState().setDoc(doc, 'reset', { history: false });
    useDocStore.setState({ doc, past: [], future: [] });
    useUiStore.setState({ activeSlideIndex: 0, selectedIds: [], editing: null, compilerErrors: [] });
  });

  it('creates one slide per page after the active slide', () => {
    useDocStore.getState().importPdfPages([
      { src: 'data:image/jpeg;base64,AAA', width: 1920, height: 1080 },
      { src: 'data:image/jpeg;base64,BBB', width: 1920, height: 1080 },
    ]);
    const doc = useDocStore.getState().doc;
    expect(doc.slides).toHaveLength(3);
    expect(doc.slides[1].name).toBe('Page 1');
    expect(doc.slides[2].name).toBe('Page 2');
    // The imported slides land directly after the slide that was open.
    expect(useUiStore.getState().activeSlideIndex).toBe(1);
  });

  it('sets the page as the slide background image instead of an element', () => {
    useDocStore.getState().importPdfPages([
      { src: 'data:image/jpeg;base64,AAA', width: 1920, height: 1080 },
    ]);
    const slide = useDocStore.getState().doc.slides[1];
    expect(slide.backgroundImage).toBe('data:image/jpeg;base64,AAA');
    expect(slide.elements).toHaveLength(0);
    expect(slide.background).toBe('#ffffff');
  });

  it('sizes the canvas to the PDF page, not the raster scale', () => {
    // Letter page rendered at 1236×1600 px: the canvas must be the page's own
    // 612×792 points, while the higher-res raster stays as the background.
    useDocStore.getState().importPdfPages([
      {
        src: 'data:image/webp;base64,LETTER',
        width: 1236,
        height: 1600,
        pageWidth: 612,
        pageHeight: 792,
      },
      { src: 'data:image/webp;base64,WIDE', width: 1600, height: 700, pageWidth: 900, pageHeight: 400 },
    ]);
    const doc = useDocStore.getState().doc;
    expect(doc.slides[1]).toMatchObject({ width: 612, height: 792 });
    expect(doc.slides[1].backgroundImage).toBe('data:image/webp;base64,LETTER');
    expect(doc.slides[2]).toMatchObject({ width: 900, height: 400 });
  });

  it('falls back to the raster size when no page size is supplied', () => {
    useDocStore.getState().importPdfPages([{ src: 'data:x', width: 1240, height: 1754 }]);
    expect(useDocStore.getState().doc.slides[1]).toMatchObject({ width: 1240, height: 1754 });
  });

  it('scales a tiny page up on both axes without distorting it', () => {
    useDocStore.getState().importPdfPages([
      { src: 'data:x', width: 200, height: 120, pageWidth: 200, pageHeight: 120 },
    ]);
    const slide = useDocStore.getState().doc.slides[1];
    expect(slide.height).toBe(320);
    expect(slide.width).toBe(Math.round(200 * (320 / 120)));
  });

  it('hands out unique slide ids across the whole batch', () => {
    useDocStore.getState().importPdfPages([
      { src: 'data:image/jpeg;base64,AAA', width: 1920, height: 1080 },
      { src: 'data:image/jpeg;base64,BBB', width: 1920, height: 1080 },
      { src: 'data:image/jpeg;base64,CCC', width: 1920, height: 1080 },
    ]);
    const slideIds = useDocStore.getState().doc.slides.map((s) => s.id);
    expect(new Set(slideIds).size).toBe(slideIds.length);
  });

  it('is one undo step and can be fully undone', () => {
    useDocStore.getState().importPdfPages([
      { src: 'data:image/jpeg;base64,AAA', width: 1920, height: 1080 },
      { src: 'data:image/jpeg;base64,BBB', width: 1920, height: 1080 },
    ]);
    expect(useDocStore.getState().past).toHaveLength(1);
    useDocStore.getState().undo();
    const doc = useDocStore.getState().doc;
    expect(doc.slides).toHaveLength(1);
    expect(doc.slides[0].elements).toHaveLength(0);
  });

  it('ignores an empty page list', () => {
    useDocStore.getState().importPdfPages([]);
    expect(useDocStore.getState().doc.slides).toHaveLength(1);
    expect(useDocStore.getState().past).toHaveLength(0);
  });
});
