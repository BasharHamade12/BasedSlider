import { beforeEach, describe, expect, it } from 'vitest';
import {
  createConnector,
  createEmptyDoc,
  createPen,
  createShape,
} from '../factories';
import { Element } from '../types';
import { useDocStore, useUiStore } from '../store';

function resetWith(elements: Element[] = []) {
  const doc = createEmptyDoc();
  doc.slides[0].elements = elements;
  useDocStore.getState().setDoc(doc, 'reset', { history: false });
  useDocStore.setState({ doc, past: [], future: [] });
  useUiStore.setState({ activeSlideIndex: 0, selectedIds: [], compilerErrors: [] });
}

describe('document history', () => {
  beforeEach(() => {
    resetWith();
  });

  it('undoes and redoes element creation', () => {
    useDocStore.getState().addElement(createShape('rect', 'e1', { x: 10, y: 10 }));
    expect(useDocStore.getState().doc.slides[0].elements).toHaveLength(1);
    expect(useDocStore.getState().past).toHaveLength(1);

    useDocStore.getState().undo();
    expect(useDocStore.getState().doc.slides[0].elements).toHaveLength(0);

    useDocStore.getState().redo();
    expect(useDocStore.getState().doc.slides[0].elements).toHaveLength(1);
  });

  it('coalesces a drag transaction into one undo step', () => {
    resetWith([createShape('rect', 'e1', { x: 0, y: 0 })]);
    const before = useDocStore.getState().past.length;

    useDocStore.getState().beginTransaction();
    useDocStore.getState().updateElement('e1', { x: 20 });
    useDocStore.getState().updateElement('e1', { x: 40 });
    useDocStore.getState().updateElement('e1', { x: 100 });
    useDocStore.getState().commitTransaction('Drag');

    expect(useDocStore.getState().past).toHaveLength(before + 1);
    const element = useDocStore.getState().doc.slides[0].elements[0];
    expect(element.type !== 'connector' && element.x).toBe(100);

    useDocStore.getState().undo();
    const restored = useDocStore.getState().doc.slides[0].elements[0];
    expect(restored.type !== 'connector' && restored.x).toBe(0);
  });

  it('resizes a pen stroke by scaling its points', () => {
    resetWith([
      createPen('e1', [
        { x: 100, y: 100, pressure: 0.5 },
        { x: 200, y: 200, pressure: 0.5 },
      ]),
    ]);

    useDocStore.getState().updateElement('e1', { x: 100, y: 100, width: 200, height: 200 });

    const resized = useDocStore.getState().doc.slides[0].elements[0];
    expect(resized.type).toBe('pen');
    if (resized.type === 'pen') {
      expect({ x: resized.x, y: resized.y, width: resized.width, height: resized.height }).toEqual({
        x: 100,
        y: 100,
        width: 200,
        height: 200,
      });
      expect(resized.strokeWidth).toBe(3);
      expect(resized.points[1]).toMatchObject({ x: 300, y: 300 });
    }

    useDocStore.getState().undo();
    const restored = useDocStore.getState().doc.slides[0].elements[0];
    expect(restored.type === 'pen' && restored.width).toBe(100);
  });

  it('resizes a flat pen stroke without producing NaN bounds', () => {
    resetWith([
      createPen('e1', [
        { x: 100, y: 100, pressure: 0.5 },
        { x: 300, y: 100, pressure: 0.5 },
      ]),
    ]);

    useDocStore.getState().updateElement('e1', { x: 100, y: 160, width: 400, height: 0 });

    const resized = useDocStore.getState().doc.slides[0].elements[0];
    expect(resized.type).toBe('pen');
    if (resized.type === 'pen') {
      expect(resized.y).toBe(160);
      expect(resized.width).toBe(400);
      expect(resized.height).toBe(0);
      expect(resized.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(
        true,
      );
    }
  });

  it('coalesces rapid nudges', () => {
    resetWith([createShape('rect', 'e1', { x: 0, y: 0 })]);
    const before = useDocStore.getState().past.length;

    useDocStore.getState().nudge(['e1'], 1, 0);
    useDocStore.getState().nudge(['e1'], 1, 0);
    useDocStore.getState().nudge(['e1'], 1, 0);

    expect(useDocStore.getState().past).toHaveLength(before + 1);
    const element = useDocStore.getState().doc.slides[0].elements[0];
    expect(element.type !== 'connector' && element.x).toBe(3);
  });

  it('deletes attached connectors in the same undo step', () => {
    const connector = createConnector('c1', {
      from: { kind: 'element', elementId: 'e1', port: 'auto' },
      to: { kind: 'element', elementId: 'e2', port: 'auto' },
    });
    resetWith([
      createShape('rect', 'e1', { x: 0, y: 0 }),
      createShape('rect', 'e2', { x: 400, y: 0 }),
      connector,
    ]);

    useDocStore.getState().deleteElements(['e1']);
    const remaining = useDocStore.getState().doc.slides[0].elements;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('e2');

    useDocStore.getState().undo();
    expect(useDocStore.getState().doc.slides[0].elements).toHaveLength(3);

    useDocStore.getState().deleteElements(['c1']);
    expect(useDocStore.getState().doc.slides[0].elements.map((element) => element.id)).toEqual(['e1', 'e2']);
  });

  it('rejects mutations that produce an invalid document', () => {
    resetWith([createShape('rect', 'e1', { x: 0, y: 0 })]);
    const before = JSON.stringify(useDocStore.getState().doc);

    const ok = useDocStore.getState().applyDoc('bad', (draft) => {
      const element = draft.slides[0].elements[0];
      if (element.type !== 'connector') element.width = -10;
    });

    expect(ok).toBe(false);
    expect(JSON.stringify(useDocStore.getState().doc)).toBe(before);
    expect(useUiStore.getState().compilerErrors.length).toBeGreaterThan(0);
  });

  it('keeps the last good document when code is invalid', () => {
    resetWith([createShape('rect', 'e1', { x: 0, y: 0 })]);
    const before = JSON.stringify(useDocStore.getState().doc);

    const result = useDocStore.getState().applyCode('slide "Broken" {');

    expect(result.ok).toBe(false);
    expect(JSON.stringify(useDocStore.getState().doc)).toBe(before);
    expect(useUiStore.getState().compilerErrors.some((item) => item.severity === 'error')).toBe(true);
  });

  it('applies valid code as one undo step', () => {
    resetWith();
    const before = useDocStore.getState().past.length;
    const source = `slide "Imported" {
    id: "s9";
    background: "#ffffff";

    text "e9" {
        x: 10;
        y: 20;
        width: 500;
        height: 100;
        content: "Hello";
        fontSize: 40;
    }
}
`;
    const result = useDocStore.getState().applyCode(source);
    expect(result.ok).toBe(true);
    expect(useDocStore.getState().past).toHaveLength(before + 1);
    expect(useDocStore.getState().doc.slides[0].id).toBe('s9');

    useDocStore.getState().undo();
    expect(useDocStore.getState().doc.slides[0].id).toBe('s1');
  });
});
