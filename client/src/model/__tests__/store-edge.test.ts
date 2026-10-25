import { describe, expect, it, beforeEach } from 'vitest';
import { createConnector, createEmptyDoc, createShape } from '../factories';
import { useDocStore, useUiStore } from '../store';

describe('ui store edge cases', () => {
  beforeEach(() => {
    const doc = createEmptyDoc();
    doc.slides[0].elements = [createShape('rect', 'e1', { x: 10, y: 10, width: 20, height: 20 })];
    useDocStore.getState().setDoc(doc, 'reset', { history: false });
    useDocStore.setState({ doc, past: [], future: [] });
    useUiStore.setState({
      activeSlideIndex: 0,
      selectedIds: ['e1'],
      editing: null,
      compilerErrors: [],
    });
  });

  it('prunes stale selection ids after elements are removed', () => {
    useDocStore.getState().deleteElements(['e1']);
    const valid = useUiStore.getState().selectedIds;
    expect(valid).toHaveLength(0);
  });

  it('prunes stale editing refs after the target element is removed', () => {
    useUiStore.getState().setEditing({ elementId: 'e1', target: 'text' });
    useDocStore.getState().deleteElements(['e1']);
    expect(useUiStore.getState().editing).toBeNull();
  });

  it('clamps the active slide index after a deletion', () => {
    useDocStore.getState().deleteSlide(0);
    expect(useUiStore.getState().activeSlideIndex).toBe(0);
    expect(useDocStore.getState().doc.slides).toHaveLength(1);
  });

  it('clears editing when the tool changes', () => {
    useUiStore.getState().setEditing({ elementId: 'e1', target: 'text' });
    useUiStore.getState().setTool('rect');
    expect(useUiStore.getState().editing).toBeNull();
  });

  it('deletes a selected connector directly', () => {
    const connector = createConnector('c1', {
      from: { kind: 'point', x: 0, y: 0 },
      to: { kind: 'point', x: 40, y: 40 },
    });
    useDocStore.getState().addElement(connector);
    useDocStore.getState().deleteElements(['c1']);
    expect(useDocStore.getState().doc.slides[0].elements.some((element) => element.id === 'c1')).toBe(false);
  });

  it('paste from an empty clipboard is a no-op', () => {
    const before = useDocStore.getState().doc.slides[0].elements.length;
    useDocStore.getState().pasteClipboard();
    expect(useDocStore.getState().doc.slides[0].elements.length).toBe(before);
    expect(useUiStore.getState().selectedIds).toHaveLength(1);
  });

  it('insertElement returns an id and adds the element', () => {
    const id = useDocStore.getState().insertElement('rect', 50, 50);
    expect(id).toMatch(/^e\d+$/);
    const added = useDocStore.getState().doc.slides[0].elements.find((el) => el.id === id);
    expect(added).toBeDefined();
    expect(added?.type).toBe('rect');
  });

  it('paste from a populated clipboard restores the element', () => {
    useDocStore.getState().copySelection(['e1']);
    useDocStore.getState().deleteElements(['e1']);
    useDocStore.getState().pasteClipboard();
    expect(useDocStore.getState().doc.slides[0].elements.length).toBe(1);
    expect(useDocStore.getState().doc.slides[0].elements[0].type).toBe('rect');
  });

  it('zoom is clamped between 0.1 and 4', () => {
    useUiStore.getState().setZoom(0);
    expect(useUiStore.getState().zoom).toBe(0.1);
    useUiStore.getState().setZoom(10);
    expect(useUiStore.getState().zoom).toBe(4);
  });

  it('pen width is clamped between 1 and 40', () => {
    useUiStore.getState().setPenWidth(0);
    expect(useUiStore.getState().penWidth).toBe(1);
    useUiStore.getState().setPenWidth(100);
    expect(useUiStore.getState().penWidth).toBe(40);
  });

  it('setActiveSlide clamps into the valid range', () => {
    useDocStore.getState().addSlide();
    useDocStore.getState().addSlide();
    useUiStore.getState().setActiveSlide(99);
    expect(useUiStore.getState().activeSlideIndex).toBe(2);
    useUiStore.getState().setActiveSlide(-5);
    expect(useUiStore.getState().activeSlideIndex).toBe(0);
  });
});
