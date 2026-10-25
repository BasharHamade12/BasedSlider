import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CanvasPanel } from '../../canvas/CanvasPanel';
import {
  createAnimation,
  createCode,
  createConnector,
  createEmptyDoc,
  createImage,
  createLatex,
  createPen,
  createShape,
  createText,
  createTextBlock,
} from '../../model/factories';
import { useDocStore, useUiStore } from '../../model/store';
import { Element } from '../../model/types';
import { RightPanel } from '../RightPanel';
import { TopToolbar } from '../TopToolbar';
import { SlideRail } from '../SlideRail';
import { BottomPanel } from '../BottomPanel';
import { saveDeck } from '../../persistence/storage';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function reset(elements: Element[] = []) {
  const doc = createEmptyDoc();
  doc.slides[0].elements = elements;
  useDocStore.getState().setDoc(doc, 'scenario reset', { history: false });
  useDocStore.setState({ doc, past: [], future: [] });
  useUiStore.setState({
    activeSlideIndex: 0,
    selectedIds: [],
    tool: 'select',
    zoom: 1,
    pan: { x: 0, y: 0 },
    guides: { v: [], h: [] },
    snapEnabled: false,
    gridEnabled: false,
    editing: null,
    presenting: false,
    presentFrom: 0,
    compilerErrors: [],
    sourceCode: '',
    sourceOrigin: 'gui',
    measurements: {},
  });
}

describe('presentation editor usage scenarios', () => {
  beforeEach(() => reset());

  it('creates a rectangle from the toolbar shape menu and enters text edit after adding text', () => {
    render(<TopToolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Shapes' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rectangle' }));
    expect(useDocStore.getState().doc.slides[0].elements[0].type).toBe('rect');

    fireEvent.click(screen.getByRole('button', { name: 'Text' }));
    const created = useDocStore.getState().doc.slides[0].elements[1];
    expect(created.type).toBe('text');
    expect(useUiStore.getState().editing).toEqual({ elementId: created.id, target: 'text' });
  });

  it('saves the deck locally and communicates save failures accessibly', () => {
    const doc = createEmptyDoc();
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => undefined);
    render(<BottomPanel />);

    act(() => useUiStore.getState().setSaveStatus('saving'));
    expect(screen.getByRole('status')).toHaveTextContent('Saving');
    expect(saveDeck(doc)).toBe(true);
    expect(storageWrite).toHaveBeenCalledWith('basedslider:doc:v2', JSON.stringify(doc));

    act(() => useUiStore.getState().setSaveStatus('saved'));
    expect(screen.getByRole('status')).toHaveTextContent('Saved locally');

    storageWrite.mockImplementationOnce(() => { throw new Error('Storage quota exceeded'); });
    expect(saveDeck(doc)).toBe(false);
    act(() => useUiStore.getState().setSaveStatus('error'));
    expect(screen.getByRole('status')).toHaveTextContent("Couldn't save");
  });

  it('activates a slide with the keyboard from the slide rail', () => {
    const doc = createEmptyDoc();
    const firstSlide = doc.slides[0];
    const secondSlide = { ...firstSlide, id: 's2', name: 'Slide 2' };
    doc.slides = [firstSlide, secondSlide];
    useDocStore.getState().setDoc(doc, 'two slide setup', { history: false });
    useDocStore.setState({ doc, past: [], future: [] });
    render(<SlideRail />);

    const secondTab = screen.getByRole('tab', { name: '2. Slide 2' });
    expect(secondTab).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(secondTab, { key: 'ArrowRight' });

    expect(useUiStore.getState().activeSlideIndex).toBe(1);
    expect(screen.getByRole('tab', { name: '2. Slide 2' })).toHaveAttribute('tabindex', '0');
  });

  it('creates LaTeX and code blocks from toolbar actions', () => {
    render(<TopToolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'LaTeX' }));
    fireEvent.click(screen.getByRole('button', { name: 'Code block' }));
    expect(useDocStore.getState().doc.slides[0].elements.map((element) => element.type)).toEqual([
      'latex', 'code',
    ]);
  });

  it('creates an HTML embed from the toolbar and edits it in the inspector', () => {
    render(<TopToolbar />);
    // The toolbar's HTML button imports a file; a blank embed lives in its menu.
    fireEvent.click(screen.getByRole('button', { name: 'HTML embed options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Blank embed' }));
    const embed = useDocStore.getState().doc.slides[0].elements[0];
    expect(embed.type).toBe('html');
    cleanup();

    useUiStore.getState().setSelection([embed.id]);
    render(<RightPanel />);

    fireEvent.change(screen.getByLabelText('Page URL'), {
      target: { value: 'https://example.com/live' },
    });
    fireEvent.blur(screen.getByLabelText('Page URL'));
    const afterUrl = useDocStore.getState().doc.slides[0].elements[0];
    expect(afterUrl.type === 'html' ? afterUrl.src : '').toBe('https://example.com/live');

    fireEvent.change(screen.getByLabelText('HTML source'), {
      target: { value: '<h1>Hello</h1>' },
    });
    fireEvent.blur(screen.getByLabelText('HTML source'));
    fireEvent.change(screen.getByLabelText('Corner radius'), { target: { value: '24' } });
    fireEvent.blur(screen.getByLabelText('Corner radius'));

    const edited = useDocStore.getState().doc.slides[0].elements[0];
    if (edited.type === 'html') {
      expect(edited.content).toBe('<h1>Hello</h1>');
      expect(edited.radius).toBe(24);
      expect(edited.reloadToken).toBe(0);
    }

    // The reload button bumps the token so the live frame remounts.
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    const reloaded = useDocStore.getState().doc.slides[0].elements[0];
    if (reloaded.type === 'html') {
      expect(reloaded.reloadToken).toBe(1);
    }
  });

  it('imports an HTML file from the toolbar as a populated embed', async () => {
    render(<TopToolbar />);
    const input = document.querySelector('input[type=file][accept*=".html"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    const file = new File(['<h1>Imported</h1>'], 'card.html', { type: 'text/html' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      const embed = useDocStore.getState().doc.slides[0].elements[0];
      expect(embed?.type).toBe('html');
      if (embed?.type === 'html') {
        expect(embed.content).toBe('<h1>Imported</h1>');
        expect(embed.name).toBe('card.html');
      }
    });
  });

  it('resizes a selected text object by dragging the canvas southeast handle', async () => {
    reset([createText('e1', { x: 100, y: 100, width: 200, height: 100 }, {}, { content: 'Drag me' })]);
    const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    const clientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() { return this.classList?.contains('canvas-viewport') ? 1968 : clientWidth?.get?.call(this) ?? 0; },
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() { return this.classList?.contains('canvas-viewport') ? 1128 : clientHeight?.get?.call(this) ?? 0; },
    });

    try {
      render(<CanvasPanel />);
      const svg = document.querySelector<SVGSVGElement>('svg[role="application"]')!;
      svg.getBoundingClientRect = () => ({
        x: 0, y: 0, left: 0, top: 0, right: 1920, bottom: 1080, width: 1920, height: 1080,
        toJSON: () => ({}),
      });
      const target = document.querySelector<SVGGElement>('[data-element-id="e1"]')!;
      fireEvent.pointerDown(target, { button: 0, pointerId: 1, clientX: 150, clientY: 130 });
      fireEvent.pointerMove(svg, { button: 0, pointerId: 1, clientX: 150, clientY: 130 });
      fireEvent.pointerUp(svg, { button: 0, pointerId: 1, clientX: 150, clientY: 130 });
      expect(useUiStore.getState().selectedIds).toEqual(['e1']);

      await waitFor(() => expect(document.querySelector('[data-handle="se"]')).not.toBeNull());
      const handle = document.querySelector('[data-handle="se"]')!;
      fireEvent.pointerDown(handle, { button: 0, pointerId: 2, clientX: 300, clientY: 200 });
      fireEvent.pointerMove(svg, { button: 0, pointerId: 2, clientX: 350, clientY: 230 });
      fireEvent.pointerUp(svg, { button: 0, pointerId: 2, clientX: 350, clientY: 230 });
      expect(useDocStore.getState().doc.slides[0].elements[0]).toMatchObject({
        x: 100, y: 100, width: 250, height: 130,
      });
      expect(useDocStore.getState().past).toHaveLength(1);
    } finally {
      if (clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
      else Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
      if (clientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', clientHeight);
      else Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
    }
  });

  it('changes text font size and content from the properties inspector', () => {
    reset([createText('e1', { x: 10, y: 20, width: 300, height: 100 }, {}, { content: 'Before' })]);
    useUiStore.getState().setSelection(['e1']);
    render(<RightPanel />);

    fireEvent.change(screen.getByLabelText('Size'), { target: { value: '64' } });
    fireEvent.blur(screen.getByLabelText('Size'));
    fireEvent.change(screen.getByLabelText('Content'), { target: { value: 'After' } });
    fireEvent.blur(screen.getByLabelText('Content'));

    expect(useDocStore.getState().doc.slides[0].elements[0]).toMatchObject({
      type: 'text', text: { content: 'After', fontSize: 64 },
    });
  });

  it('edits shape geometry and appearance in the inspector and supports undo/redo', () => {
    reset([createShape('rect', 'e1', { x: 10, y: 20, width: 200, height: 100 })]);
    useUiStore.getState().setSelection(['e1']);
    render(<RightPanel />);

    fireEvent.change(screen.getByLabelText('W'), { target: { value: '320' } });
    fireEvent.blur(screen.getByLabelText('W'));
    const fillInput = screen.getAllByLabelText('Fill')[1];
    fireEvent.change(fillInput, { target: { value: '#00aa88' } });
    fireEvent.blur(fillInput);
    expect(useDocStore.getState().doc.slides[0].elements[0]).toMatchObject({ width: 320, fill: '#00aa88' });

    useDocStore.getState().undo();
    expect(useDocStore.getState().doc.slides[0].elements[0]).toMatchObject({ width: 320, fill: '#4c9aff' });
    useDocStore.getState().undo();
    expect(useDocStore.getState().doc.slides[0].elements[0]).toMatchObject({ width: 200, fill: '#4c9aff' });
    useDocStore.getState().redo();
    useDocStore.getState().redo();
    expect(useDocStore.getState().doc.slides[0].elements[0]).toMatchObject({ width: 320, fill: '#00aa88' });
  });

  it('updates slide name, background, notes, and transition through the inspector', () => {
    render(<RightPanel />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Overview' } });
    fireEvent.blur(screen.getByLabelText('Name'));
    fireEvent.change(screen.getByLabelText('Background color'), { target: { value: '#fafafa' } });
    fireEvent.change(screen.getByLabelText('Speaker notes'), { target: { value: 'Say hello' } });
    fireEvent.blur(screen.getByLabelText('Speaker notes'));
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'fade' } });

    expect(useDocStore.getState().doc.slides[0]).toMatchObject({
      name: 'Overview', background: '#fafafa', notes: 'Say hello', transition: { type: 'fade' },
    });
  });

  it('edits shape shadow and embedded label properties in the inspector', () => {
    const shape = createShape('rect', 'e1', { x: 0, y: 0, width: 240, height: 120 }, {
      shadow: { x: 0, y: 6, blur: 16, color: '#00000055' },
      text: createTextBlock({ content: 'Label' }),
    });
    reset([shape]);
    useUiStore.getState().setSelection(['e1']);
    render(<RightPanel />);

    fireEvent.change(screen.getByLabelText('Shadow X'), { target: { value: '4' } });
    fireEvent.blur(screen.getByLabelText('Shadow X'));
    fireEvent.change(screen.getByLabelText('Blur'), { target: { value: '24' } });
    fireEvent.blur(screen.getByLabelText('Blur'));
    fireEvent.change(screen.getByLabelText('Content'), { target: { value: 'Updated label' } });
    fireEvent.blur(screen.getByLabelText('Content'));
    fireEvent.change(screen.getByLabelText('Size'), { target: { value: '30' } });
    fireEvent.blur(screen.getByLabelText('Size'));
    fireEvent.click(screen.getByLabelText('Italic'));

    expect(useDocStore.getState().doc.slides[0].elements[0]).toMatchObject({
      shadow: { x: 4, blur: 24 },
      text: { content: 'Updated label', fontSize: 30, italic: true },
    });
  });

  it('edits LaTeX source, display mode, and font size in the inspector', () => {
    reset([createLatex('e1', { x: 10, y: 20 })]);
    useUiStore.getState().setSelection(['e1']);
    render(<RightPanel />);
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: '\\\\beta + 1' } });
    fireEvent.blur(screen.getByLabelText('Source'));
    fireEvent.change(screen.getByLabelText('Font size'), { target: { value: '48' } });
    fireEvent.blur(screen.getByLabelText('Font size'));
    fireEvent.click(screen.getByLabelText('Display mode'));

    expect(useDocStore.getState().doc.slides[0].elements[0]).toMatchObject({
      type: 'latex', content: '\\\\beta + 1', fontSize: 48, displayMode: false,
    });
  });

  it('edits code source, language, theme, typography, and colours in the inspector', () => {
    reset([createCode('e1', { x: 10, y: 20 })]);
    useUiStore.getState().setSelection(['e1']);
    render(<RightPanel />);
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'print("hello")' } });
    fireEvent.blur(screen.getByLabelText('Source'));
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'python' } });
    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'light' } });
    fireEvent.change(screen.getByLabelText('Font size'), { target: { value: '20' } });
    fireEvent.blur(screen.getByLabelText('Font size'));
    fireEvent.click(screen.getByLabelText('Line numbers'));
    fireEvent.change(screen.getByLabelText('Background color'), { target: { value: '#fafafa' } });
    fireEvent.blur(screen.getAllByLabelText('Background')[1]);

    expect(useDocStore.getState().doc.slides[0].elements[0]).toMatchObject({
      type: 'code', content: 'print("hello")', language: 'python', theme: 'light', fontSize: 20,
      lineNumbers: false, background: '#fafafa',
    });
  });

  it('edits image source, fit, and corner radius in the inspector', () => {
    reset([createImage('e1', { x: 10, y: 20 })]);
    useUiStore.getState().setSelection(['e1']);
    render(<RightPanel />);
    fireEvent.change(screen.getByLabelText('Source URL'), { target: { value: 'https://example.test/image.png' } });
    fireEvent.blur(screen.getByLabelText('Source URL'));
    fireEvent.change(screen.getByLabelText('Fit'), { target: { value: 'cover' } });
    fireEvent.change(screen.getByLabelText('Corner radius'), { target: { value: '22' } });
    fireEvent.blur(screen.getByLabelText('Corner radius'));
    expect(useDocStore.getState().doc.slides[0].elements[0]).toMatchObject({
      type: 'image', src: 'https://example.test/image.png', fit: 'cover', radius: 22,
    });
  });

  it('edits pen colour, thickness, smoothing, and mode in the inspector', () => {
    const pen = createPen('e1', [
      { x: 10, y: 20, pressure: 0.5 }, { x: 50, y: 80, pressure: 0.8 },
    ]);
    reset([pen]);
    useUiStore.getState().setSelection(['e1']);
    render(<RightPanel />);
    fireEvent.change(screen.getAllByLabelText('Color')[1], { target: { value: '#335577' } });
    fireEvent.blur(screen.getAllByLabelText('Color')[1]);
    fireEvent.change(screen.getByLabelText('Width'), { target: { value: '8' } });
    fireEvent.blur(screen.getByLabelText('Width'));
    fireEvent.click(screen.getByLabelText('Smoothing'));
    fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'highlighter' } });
    expect(useDocStore.getState().doc.slides[0].elements[0]).toMatchObject({
      type: 'pen', color: '#335577', strokeWidth: 8, smoothing: false, mode: 'highlighter',
    });
  });

  it('edits connector routing, arrows, line style, colour, and label in the inspector', () => {
    const connector = createConnector('c1', {
      from: { kind: 'point', x: 10, y: 10 }, to: { kind: 'point', x: 100, y: 100 },
    });
    reset([connector]);
    useUiStore.getState().setSelection(['c1']);
    render(<RightPanel />);
    fireEvent.change(screen.getByLabelText('Routing'), { target: { value: 'curved' } });
    fireEvent.change(screen.getByLabelText('Start arrow'), { target: { value: 'diamond' } });
    fireEvent.change(screen.getByLabelText('End arrow'), { target: { value: 'open' } });
    fireEvent.change(screen.getByLabelText('Arrow size'), { target: { value: '20' } });
    fireEvent.blur(screen.getByLabelText('Arrow size'));
    fireEvent.change(screen.getByLabelText('Dash'), { target: { value: '5' } });
    fireEvent.blur(screen.getByLabelText('Dash'));
    fireEvent.change(screen.getAllByLabelText('Color')[1], { target: { value: '#0055aa' } });
    fireEvent.blur(screen.getAllByLabelText('Color')[1]);
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'connects' } });
    fireEvent.blur(screen.getByLabelText('Label'));
    expect(useDocStore.getState().doc.slides[0].elements[0]).toMatchObject({
      type: 'connector', routing: 'curved', startArrow: 'diamond', endArrow: 'open',
      arrowSize: 20, dash: 5, color: '#0055aa', label: 'connects',
    });
  });

  it('edits animation effect, trigger, timing, direction, and easing in the inspector', () => {
    const shape = createShape('rect', 'e1', { x: 0, y: 0 });
    shape.animations = [createAnimation('a1')];
    reset([shape]);
    useUiStore.getState().setSelection(['e1']);
    render(<RightPanel />);
    fireEvent.change(screen.getByLabelText('Effect'), { target: { value: 'slideIn' } });
    fireEvent.change(screen.getByLabelText('Trigger'), { target: { value: 'onClick' } });
    const numberInputs = document.querySelectorAll<HTMLInputElement>('.right-panel input[type="number"]');
    const durationInput = numberInputs[numberInputs.length - 2];
    const delayInput = numberInputs[numberInputs.length - 1];
    fireEvent.change(durationInput, { target: { value: '900' } });
    fireEvent.blur(durationInput);
    fireEvent.change(delayInput, { target: { value: '100' } });
    fireEvent.blur(delayInput);
    fireEvent.change(screen.getByLabelText('Easing'), { target: { value: 'easeIn' } });
    fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'right' } });
    expect(useDocStore.getState().doc.slides[0].elements[0].animations[0]).toMatchObject({
      effect: 'slideIn', trigger: 'onClick', duration: 900, delay: 100, easing: 'easeIn', direction: 'right',
    });
  });

  it('creates and edits each supported element kind with its model properties', () => {
    const store = useDocStore.getState();
    const rectId = store.insertElement('rect', 10, 20)!;
    const ellipseId = store.insertElement('ellipse', 40, 50)!;
    const latexId = store.insertElement('latex', 70, 80)!;
    const codeId = store.insertElement('code', 100, 110)!;
    const imageId = store.addImage('data:image/png;base64,AA==', 320, 180);
    const pen = createPen('e99', [
      { x: 20, y: 30, pressure: 0.5 }, { x: 70, y: 90, pressure: 0.8 },
    ]);
    store.addElement(pen);

    store.updateElement(rectId, { fill: '#ff0000', stroke: '#000000', strokeWidth: 2, dash: 4, radius: 12 });
    store.updateElement(ellipseId, { fill: '#00ff00', rotation: 30, opacity: 0.5 });
    store.updateElement(latexId, { content: '\\alpha', fontSize: 40, displayMode: false });
    store.updateElement(codeId, { content: 'print(1)', language: 'python', theme: 'light', lineNumbers: false });
    store.updateElement(imageId, { fit: 'cover', radius: 10 });
    store.updateElement(pen.id, { color: '#333333', strokeWidth: 6, smoothing: false, mode: 'highlighter' });

    const elements = useDocStore.getState().doc.slides[0].elements;
    expect(elements.find((element) => element.id === rectId)).toMatchObject({ fill: '#ff0000', stroke: '#000000', strokeWidth: 2, dash: 4, radius: 12 });
    expect(elements.find((element) => element.id === ellipseId)).toMatchObject({ rotation: 30, opacity: 0.5 });
    expect(elements.find((element) => element.id === latexId)).toMatchObject({ content: '\\alpha', fontSize: 40, displayMode: false });
    expect(elements.find((element) => element.id === codeId)).toMatchObject({ content: 'print(1)', language: 'python', theme: 'light', lineNumbers: false });
    expect(elements.find((element) => element.id === imageId)).toMatchObject({ src: 'data:image/png;base64,AA==', fit: 'cover', radius: 10 });
    expect(elements.find((element) => element.id === pen.id)).toMatchObject({ color: '#333333', strokeWidth: 6, smoothing: false, mode: 'highlighter' });
  });

  it('supports selection, grouping, alignment, distribution, layering, duplication, and deletion', () => {
    reset([
      createShape('rect', 'e1', { x: 10, y: 20, width: 20, height: 20 }),
      createShape('rect', 'e2', { x: 70, y: 80, width: 20, height: 20 }),
      createShape('rect', 'e3', { x: 150, y: 180, width: 20, height: 20 }),
    ]);
    const store = useDocStore.getState();
    store.align(['e1', 'e2'], 'left');
    const alignedSecond = useDocStore.getState().doc.slides[0].elements.find((element) => element.id === 'e2');
    expect(alignedSecond?.type === 'connector' ? undefined : alignedSecond?.x).toBe(10);
    store.distribute(['e1', 'e2', 'e3'], 'horizontal');
    store.groupSelection(['e1', 'e2']);
    const group = useDocStore.getState().doc.slides[0].elements.find((element) => element.id === 'e1')?.group;
    expect(group).toBeTruthy();
    expect(useDocStore.getState().doc.slides[0].elements.find((element) => element.id === 'e2')?.group).toBe(group);

    store.reorder(['e1'], 'front');
    const afterReorder = useDocStore.getState().doc.slides[0].elements;
    expect(afterReorder[afterReorder.length - 1]?.id).toBe('e1');
    store.duplicateSelection(['e1', 'e2']);
    expect(useDocStore.getState().doc.slides[0].elements).toHaveLength(5);
    expect(useUiStore.getState().selectedIds).toHaveLength(2);
    store.ungroupSelection(['e1']);
    expect(useDocStore.getState().doc.slides[0].elements.find((element) => element.id === 'e1')?.group).toBeUndefined();
    store.deleteElements(['e3']);
    expect(useDocStore.getState().doc.slides[0].elements.some((element) => element.id === 'e3')).toBe(false);
  });

  it('copies and pastes content, then restores it with undo', () => {
    reset([createShape('rect', 'e1', { x: 10, y: 20, width: 20, height: 20 })]);
    const store = useDocStore.getState();
    store.copySelection(['e1']);
    store.pasteClipboard();
    expect(useDocStore.getState().doc.slides[0].elements).toHaveLength(2);
    const pasted = useDocStore.getState().doc.slides[0].elements[1];
    expect(pasted.id).not.toBe('e1');
    store.undo();
    expect(useDocStore.getState().doc.slides[0].elements).toHaveLength(1);
    store.redo();
    expect(useDocStore.getState().doc.slides[0].elements).toHaveLength(2);
  });

  it('adds, duplicates, reorders, transitions, and deletes slides', () => {
    reset([createShape('rect', 'e1', { x: 0, y: 0 })]);
    const store = useDocStore.getState();
    store.addSlide();
    store.updateSlide(1, { name: 'Closing', background: '#111111', notes: 'Thank you' });
    store.updateTransition(1, { type: 'push', direction: 'left', duration: 600, easing: 'easeIn' });
    store.duplicateSlide(1);
    expect(useDocStore.getState().doc.slides[2]).toMatchObject({
      name: 'Closing copy', background: '#111111', notes: 'Thank you',
      transition: { type: 'push', direction: 'left', duration: 600, easing: 'easeIn' },
    });
    store.moveSlide(2, 0);
    expect(useDocStore.getState().doc.slides[0].name).toBe('Closing copy');
    store.deleteSlide(0);
    expect(useDocStore.getState().doc.slides).toHaveLength(2);
  });

  it('creates connectors between objects and can reconnect an endpoint', () => {
    reset([
      createShape('rect', 'e1', { x: 0, y: 0 }),
      createShape('rect', 'e2', { x: 400, y: 0 }),
      createShape('rect', 'e3', { x: 800, y: 0 }),
    ]);
    const connector = createConnector('c1', {
      from: { kind: 'element', elementId: 'e1', port: 'right' },
      to: { kind: 'element', elementId: 'e2', port: 'left' },
    });
    useDocStore.getState().addElement(connector);
    useDocStore.getState().updateConnectorEndpoint('c1', 'to', {
      kind: 'element', elementId: 'e3', port: 'top',
    });
    expect(useDocStore.getState().doc.slides[0].elements.find((element) => element.id === 'c1')).toMatchObject({
      type: 'connector', from: { elementId: 'e1', port: 'right' }, to: { elementId: 'e3', port: 'top' },
    });
  });

  it('adds, edits, removes, and undoes an animation', () => {
    reset([createShape('rect', 'e1', { x: 0, y: 0 })]);
    const store = useDocStore.getState();
    store.addAnimation('e1', 'fadeIn');
    const element = useDocStore.getState().doc.slides[0].elements[0];
    expect(element.animations).toHaveLength(1);
    const animationId = element.animations[0].id;
    store.updateAnimation('e1', animationId, { effect: 'slideIn', trigger: 'onClick', duration: 800, direction: 'right', repeat: 2 });
    expect(useDocStore.getState().doc.slides[0].elements[0].animations[0]).toMatchObject({ effect: 'slideIn', trigger: 'onClick', duration: 800, direction: 'right', repeat: 2 });
    store.removeAnimation('e1', animationId);
    expect(useDocStore.getState().doc.slides[0].elements[0].animations).toHaveLength(0);
    store.undo();
    expect(useDocStore.getState().doc.slides[0].elements[0].animations).toHaveLength(1);
  });

  it('preserves edits across script apply and reports invalid script without replacing the deck', () => {
    reset([createText('e1', { x: 10, y: 20, width: 300, height: 100 }, {}, { content: 'Original' })]);
    const script = `slide "Revised" {\n    background: "#eeeeee";\n    text "e1" { x: 25; y: 35; width: 500; height: 150; content: "From script"; fontSize: 56; color: "#123456"; }\n}\n`;
    const applied = useDocStore.getState().applyCode(script);
    expect(applied.ok).toBe(true);
    expect(useDocStore.getState().doc.slides[0]).toMatchObject({ name: 'Revised', background: '#eeeeee' });
    expect(useDocStore.getState().doc.slides[0].elements[0]).toMatchObject({
      x: 25, y: 35, width: 500, height: 150, type: 'text', text: { content: 'From script', fontSize: 56, color: '#123456' },
    });
    const invalid = useDocStore.getState().applyCode('slide "Broken" {');
    expect(invalid.ok).toBe(false);
    expect(useDocStore.getState().doc.slides[0].name).toBe('Revised');
  });
});
