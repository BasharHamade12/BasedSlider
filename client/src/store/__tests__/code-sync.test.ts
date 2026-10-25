import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createEmptyDoc, createShape } from '../../model/factories';
import { useDocStore, useUiStore } from '../../model/store';
import { useCodeSync } from '../../hooks/useCodeSync';
import { act, renderHook } from '@testing-library/react';

describe('useCodeSync', () => {
  beforeEach(() => {
    const doc = createEmptyDoc();
    doc.slides[0].elements = [createShape('rect', 'e1', { x: 0, y: 0, width: 10, height: 10 })];
    useDocStore.getState().setDoc(doc, 'reset', { history: false });
    useDocStore.setState({ doc, past: [], future: [] });
    useUiStore.setState({
      sourceCode: '',
      sourceOrigin: 'user',
      compilerErrors: [],
      activeSlideIndex: 0,
      selectedIds: [],
    });
  });

  it('applies a valid script after the debounce window', async () => {
    const applyCodeSpy = vi.spyOn(useDocStore.getState(), 'applyCode');

    renderHook(() => useCodeSync());

    act(() => {
      useUiStore.getState().setSourceCode('slide "T" { rect "e9" { x: 0; y: 0; width: 1; height: 1; } }', 'user');
    });

    expect(applyCodeSpy).not.toHaveBeenCalled();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    expect(applyCodeSpy).toHaveBeenCalled();
    expect(useDocStore.getState().doc.slides[0].elements.some((el) => el.id === 'e9')).toBe(true);
  });

  it('does not apply code when the source origin is the GUI', async () => {
    const applyCodeSpy = vi.spyOn(useDocStore.getState(), 'applyCode');

    renderHook(() => useCodeSync());

    act(() => {
      useUiStore.getState().setSourceCode('garbage', 'gui');
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    expect(applyCodeSpy).not.toHaveBeenCalled();
  });
});
