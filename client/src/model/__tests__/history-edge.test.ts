import { describe, expect, it, beforeEach } from 'vitest';
import {
  createConnector,
  createEmptyDoc,
  createShape,
  createText,
} from '../factories';
import { useDocStore, useUiStore } from '../store';
import { Element } from '../types';

function resetWith(elements: Element[] = []) {
  const doc = createEmptyDoc();
  doc.slides[0].elements = elements;
  useDocStore.getState().setDoc(doc, 'reset', { history: false });
  useDocStore.setState({ doc, past: [], future: [] });
  useUiStore.setState({ activeSlideIndex: 0, selectedIds: [], compilerErrors: [] });
}

describe('document history edge cases', () => {
  beforeEach(() => {
    resetWith();
  });

  it('cancels a transaction and restores the snapshot', () => {
    resetWith([createShape('rect', 'e1', { x: 0, y: 0, width: 10, height: 10 })]);
    const beforeElement = useDocStore.getState().doc.slides[0].elements[0];
    const before = beforeElement.type === 'connector' ? 0 : beforeElement.x;
    useDocStore.getState().beginTransaction();
    useDocStore.getState().updateElement('e1', { x: 99 });
    useDocStore.getState().cancelTransaction();
    const afterElement = useDocStore.getState().doc.slides[0].elements[0];
    const after = afterElement.type === 'connector' ? 0 : afterElement.x;
    expect(after).toBe(before);
    expect(useDocStore.getState().future).toHaveLength(0);
  });

  it('does not create history when history is false', () => {
    resetWith([createShape('rect', 'e1', { x: 0, y: 0, width: 10, height: 10 })]);
    useDocStore.getState().updateElement('e1', { x: 20 }, { history: false });
    expect(useDocStore.getState().past).toHaveLength(0);
    const element = useDocStore.getState().doc.slides[0].elements[0];
    expect(element.type !== 'connector' && element.x).toBe(20);
  });

  it('applies an invalid mutation without changing the document', () => {
    resetWith([createShape('rect', 'e1', { x: 0, y: 0, width: 10, height: 10 })]);
    const before = useDocStore.getState().doc.slides[0].elements[0].width;
    const ok = useDocStore.getState().applyDoc('bad', (draft) => {
      draft.slides[0].elements[0].width = -1;
    });
    expect(ok).toBe(false);
    expect(useDocStore.getState().doc.slides[0].elements[0].width).toBe(before);
    expect(useUiStore.getState().compilerErrors.length).toBeGreaterThan(0);
  });

  it('is a no-op on undo when there is no history', () => {
    resetWith();
    useDocStore.getState().undo();
    expect(useDocStore.getState().past).toHaveLength(0);
    expect(useDocStore.getState().doc.slides).toHaveLength(1);
  });

  it('is a no-op on redo when there is nothing to redo', () => {
    resetWith([createShape('rect', 'e1', { x: 0, y: 0, width: 10, height: 10 })]);
    useDocStore.getState().undo();
    useDocStore.getState().redo();
    expect(useDocStore.getState().doc.slides[0].elements).toHaveLength(1);
  });

  it('moves only unlocked non-connector elements on nudge', () => {
    resetWith([
      createShape('rect', 'e1', { x: 0, y: 0, width: 10, height: 10 }),
      createShape('rect', 'e2', { x: 20, y: 0, width: 10, height: 10 }, { locked: true }),
      createConnector('c1', {
        from: { kind: 'point', x: 0, y: 0 },
        to: { kind: 'point', x: 10, y: 10 },
      }),
    ]);
    useDocStore.getState().nudge(['e1', 'e2', 'c1'], 5, 0);
    const doc = useDocStore.getState().doc;
    const moved = doc.slides[0].elements.find((el) => el.id === 'e1');
    expect(moved?.type !== 'connector' && moved?.x).toBe(5);
    // Locked shapes are skipped by nudge; free rects move.
    const locked = doc.slides[0].elements.find((el) => el.id === 'e2');
    expect(locked?.type !== 'connector' && locked?.x).toBe(20);
  });

  it('groupSelection marks matching elements across slides', () => {
    resetWith([
      createShape('rect', 'e1', { x: 0, y: 0, width: 10, height: 10 }),
      createShape('rect', 'e2', { x: 20, y: 0, width: 10, height: 10 }),
      createShape('rect', 'e3', { x: 40, y: 0, width: 10, height: 10 }),
    ]);
    useDocStore.getState().groupSelection(['e1', 'e2']);
    const doc = useDocStore.getState().doc;
    expect(doc.slides[0].elements.find((el) => el.id === 'e1')?.group).toBeDefined();
    expect(doc.slides[0].elements.find((el) => el.id === 'e2')?.group).toBeDefined();
    expect(doc.slides[0].elements.find((el) => el.id === 'e3')?.group).toBeUndefined();
  });

  it('groupSelection writes the member list on the lead and repairs after deletion', () => {
    resetWith([
      createShape('rect', 'e2', { x: 20, y: 0, width: 10, height: 10 }),
      createShape('rect', 'e1', { x: 0, y: 0, width: 10, height: 10 }),
      createShape('rect', 'e3', { x: 40, y: 0, width: 10, height: 10 }),
    ]);
    useDocStore.getState().groupSelection(['e2', 'e1', 'e3']);
    const doc = useDocStore.getState().doc;
    // e1 is the lowest id, so it is the lead and owns the member list.
    const lead = doc.slides[0].elements.find((el) => el.id === 'e1');
    expect(lead?.group).toBe('g1');
    expect(lead?.members).toEqual(['e2', 'e3']);
    for (const id of ['e2', 'e3']) {
      const member = doc.slides[0].elements.find((el) => el.id === id);
      expect(member?.group).toBe('g1');
      expect(member?.members).toBeUndefined();
    }

    // Deleting a member keeps the group alive and repairs the lead list.
    useDocStore.getState().deleteElements(['e2']);
    const afterDelete = useDocStore.getState().doc;
    const repairedLead = afterDelete.slides[0].elements.find((el) => el.id === 'e1');
    expect(repairedLead?.group).toBe('g1');
    expect(repairedLead?.members).toEqual(['e3']);

    // Deleting the lead promotes the next-lowest id to lead.
    useDocStore.getState().deleteElements(['e1']);
    const promoted = useDocStore.getState().doc;
    const newLead = promoted.slides[0].elements.find((el) => el.id === 'e3');
    expect(newLead?.group).toBe('g1');
    expect(newLead?.members).toBeUndefined();
  });

  it('ungroupSelection clears matching group ids only on selected elements', () => {
    const groupId = 'g1';
    resetWith([
      createShape('rect', 'e1', { x: 0, y: 0, width: 10, height: 10 }),
      createShape('rect', 'e2', { x: 20, y: 0, width: 10, height: 10 }),
      createShape('rect', 'e3', { x: 40, y: 0, width: 10, height: 10 }),
    ]);
    useDocStore.getState().updateElement('e1', { group: groupId }, { history: false });
    useDocStore.getState().updateElement('e2', { group: groupId }, { history: false });
    useDocStore.getState().updateElement('e3', { group: groupId }, { history: false });
    useDocStore.getState().ungroupSelection(['e2']);
    const doc = useDocStore.getState().doc;
    expect(doc.slides[0].elements.find((el) => el.id === 'e1')?.group).toBe(groupId);
    expect(doc.slides[0].elements.find((el) => el.id === 'e2')?.group).toBeUndefined();
    expect(doc.slides[0].elements.find((el) => el.id === 'e3')?.group).toBe(groupId);
  });

  it('selects duplicated mixed elements and gives them fresh ids', () => {
    resetWith([
      createShape('rect', 'e1', { x: 10, y: 10, width: 20, height: 20 }),
      createText('e2', { x: 40, y: 40, width: 120, height: 60 }, {}, { content: 'hi' }),
    ]);
    useDocStore.getState().duplicateSelection(['e1', 'e2']);
    const selected = useUiStore.getState().selectedIds;
    expect(selected.length).toBe(2);
    expect(selected.every((id) => id.startsWith('e') || id.startsWith('c'))).toBe(true);
    expect(new Set(selected).size).toBe(2);
  });
});
