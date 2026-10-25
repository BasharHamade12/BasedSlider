import { describe, expect, it, beforeEach } from 'vitest';
import { createEmptyDoc, createShape, createPen, createText, createCode } from '../../model/factories';
import { useDocStore, useUiStore } from '../../model/store';
import { fireEvent, render } from '@testing-library/react';
import { CanvasPanel } from '../../canvas/CanvasPanel';

describe('canvas interaction edge cases', () => {
  beforeEach(() => {
    const doc = createEmptyDoc();
    doc.slides[0].elements = [
      createShape('rect', 'e1', { x: 100, y: 100, width: 120, height: 80 }),
      createShape('rect', 'locked', { x: 300, y: 100, width: 120, height: 80 }, { locked: true }),
      createPen('p1', [
        { x: 50, y: 50, pressure: 0.5 },
        { x: 70, y: 70, pressure: 0.5 },
      ]),
    ];
    useDocStore.getState().setDoc(doc, 'reset', { history: false });
    useDocStore.setState({ doc, past: [], future: [] });
    useUiStore.setState({
      activeSlideIndex: 0,
      selectedIds: [],
      tool: 'select',
      zoom: 1,
      pan: { x: 0, y: 0 },
      snapEnabled: false,
      gridEnabled: false,
      compilerErrors: [],
      editing: null,
      contextMenu: null,
      measurements: {},
    });
  });

  it('renders an empty deck message when there are no slides', () => {
    const empty = createEmptyDoc();
    empty.slides = [];
    useDocStore.getState().setDoc(empty, 'reset', { history: false });
    useDocStore.setState({ doc: empty, past: [], future: [] });
    const { container } = render(<CanvasPanel />);
    expect(container.textContent).toMatch(/no slides/i);
  });

  it('commits inline text edits when clicking outside the editor', () => {
    const doc = createEmptyDoc();
    doc.slides[0].elements = [createText('t1', { x: 100, y: 100, width: 300, height: 100 }, {}, { content: 'Before' })];
    useDocStore.getState().setDoc(doc, 'reset', { history: false });
    useDocStore.setState({ doc, past: [], future: [] });
    useUiStore.setState({ activeSlideIndex: 0, selectedIds: ['t1'], editing: { elementId: 't1', target: 'text' } });
    const { container } = render(<CanvasPanel />);

    const editor = container.querySelector<HTMLTextAreaElement>('.inline-text-editor');
    expect(editor).not.toBeNull();
    fireEvent.change(editor!, { target: { value: 'Saved on blur' } });
    fireEvent.blur(editor!);

    const updated = useDocStore.getState().doc.slides[0].elements[0];
    expect(updated.type === 'text' && updated.text.content).toBe('Saved on blur');
    expect(useUiStore.getState().sourceCode).toContain('content: "Saved on blur";');
    expect(useUiStore.getState().editing).toBeNull();
  });

  it('commits inline text edits when pressing the canvas, whose pointerdown prevents native blur', () => {
    const doc = createEmptyDoc();
    doc.slides[0].elements = [createText('t1', { x: 100, y: 100, width: 300, height: 100 }, {}, { content: 'Before' })];
    useDocStore.getState().setDoc(doc, 'reset', { history: false });
    useDocStore.setState({ doc, past: [], future: [] });
    useUiStore.setState({ activeSlideIndex: 0, selectedIds: ['t1'], editing: { elementId: 't1', target: 'text' } });
    const { container } = render(<CanvasPanel />);

    const editor = container.querySelector<HTMLTextAreaElement>('.inline-text-editor');
    expect(editor).not.toBeNull();
    fireEvent.change(editor!, { target: { value: 'Saved by press' } });
    // No blur event: the canvas gesture handler calls preventDefault, which is
    // what used to swallow the edit when clicking away.
    const svg = document.querySelector('svg[role="application"]')!;
    fireEvent.pointerDown(svg, { button: 0, pointerId: 3, clientX: 2000, clientY: 2000 });
    fireEvent.pointerUp(svg, { button: 0, pointerId: 3, clientX: 2000, clientY: 2000 });

    const updated = useDocStore.getState().doc.slides[0].elements[0];
    expect(updated.type === 'text' && updated.text.content).toBe('Saved by press');
    expect(useUiStore.getState().editing).toBeNull();
  });

  it('commits inline code edits made in the canvas editor', () => {
    const doc = createEmptyDoc();
    doc.slides[0].elements = [createCode('c1', { x: 50, y: 50, width: 400, height: 200 }, { content: 'before();' })];
    useDocStore.getState().setDoc(doc, 'reset', { history: false });
    useDocStore.setState({ doc, past: [], future: [] });
    useUiStore.setState({ activeSlideIndex: 0, selectedIds: ['c1'], editing: { elementId: 'c1', target: 'code' } });
    const { container } = render(<CanvasPanel />);

    const editor = container.querySelector<HTMLTextAreaElement>('.inline-text-editor');
    expect(editor).not.toBeNull();
    expect(editor!.value).toBe('before();');
    fireEvent.change(editor!, { target: { value: 'after();' } });
    const svg = document.querySelector('svg[role="application"]')!;
    fireEvent.pointerDown(svg, { button: 0, pointerId: 4, clientX: 2000, clientY: 2000 });
    fireEvent.pointerUp(svg, { button: 0, pointerId: 4, clientX: 2000, clientY: 2000 });

    const updated = useDocStore.getState().doc.slides[0].elements[0];
    expect(updated.type === 'code' && updated.content).toBe('after();');
    expect(useUiStore.getState().sourceCode).toContain('content: "after();";');
    expect(useUiStore.getState().editing).toBeNull();
  });

  it('does not select a locked element on pointer down and labels the canvas accessibly', () => {
    render(<CanvasPanel />);
    const lockedElement = document.querySelector('[data-element-id="locked"]');
    expect(lockedElement).toBeTruthy();
    fireEvent.pointerDown(lockedElement!, { button: 0, pointerId: 1, clientX: 320, clientY: 120 });
    expect(useUiStore.getState().selectedIds).toEqual([]);
    expect(document.querySelector('svg[role="application"]')).toHaveAccessibleName(
      'Slide 1 slide canvas',
    );
  });
});
