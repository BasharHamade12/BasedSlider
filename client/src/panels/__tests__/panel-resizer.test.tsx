import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { PanelResizer } from '../PanelResizer';
import { PANEL_LIMITS, useUiStore } from '../../model/store';

afterEach(() => {
  cleanup();
  useUiStore.setState({
    leftWidth: PANEL_LIMITS.left.default,
    rightWidth: PANEL_LIMITS.right.default,
  });
});

describe('panel resizer', () => {
  it('reports a wider left panel when dragged right', () => {
    const onResize = vi.fn();
    const { container } = render(<PanelResizer side="left" width={320} onResize={onResize} />);
    const handle = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(handle, { button: 0, clientX: 320, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 380, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 380, pointerId: 1 });

    expect(onResize).toHaveBeenLastCalledWith(380);
  });

  it('shrinks the right panel when the handle is dragged right', () => {
    const onResize = vi.fn();
    const { container } = render(<PanelResizer side="right" width={296} onResize={onResize} />);
    const handle = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(handle, { button: 0, clientX: 900, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 860, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 860, pointerId: 1 });

    expect(onResize).toHaveBeenLastCalledWith(336);
  });

  it('stops resizing once the pointer is released', () => {
    const onResize = vi.fn();
    const { container } = render(<PanelResizer side="left" width={320} onResize={onResize} />);
    const handle = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(handle, { button: 0, clientX: 320, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 320, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 500, pointerId: 1 });

    expect(onResize).not.toHaveBeenCalled();
    expect(document.body.classList.contains('resizing-panels')).toBe(false);
  });

  it('nudges the width with arrow keys', () => {
    const onResize = vi.fn();
    const { container } = render(<PanelResizer side="right" width={300} onResize={onResize} />);
    const handle = container.firstElementChild as HTMLElement;

    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onResize).toHaveBeenLastCalledWith(284);

    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true });
    expect(onResize).toHaveBeenLastCalledWith(348);
  });

  it('restores the default width on double click', () => {
    const onResize = vi.fn();
    const { container } = render(<PanelResizer side="left" width={520} onResize={onResize} />);
    fireEvent.doubleClick(container.firstElementChild as HTMLElement);
    expect(onResize).toHaveBeenCalledWith(PANEL_LIMITS.left.default);
  });
});

describe('panel width state', () => {
  it('clamps a dragged width into the allowed range', () => {
    useUiStore.getState().setLeftWidth(5000);
    expect(useUiStore.getState().leftWidth).toBeLessThanOrEqual(PANEL_LIMITS.left.max);
    expect(useUiStore.getState().leftWidth).toBeGreaterThanOrEqual(PANEL_LIMITS.left.min);

    useUiStore.getState().setRightWidth(10);
    expect(useUiStore.getState().rightWidth).toBe(PANEL_LIMITS.right.min);
  });

  it('keeps the canvas some room by tightening the cap on narrow windows', () => {
    const original = window.innerWidth;
    window.innerWidth = 1000;
    try {
      useUiStore.getState().setLeftWidth(PANEL_LIMITS.left.max);
      expect(useUiStore.getState().leftWidth).toBeLessThanOrEqual(1000 - 296 - 360);
    } finally {
      window.innerWidth = original;
    }
  });
});
