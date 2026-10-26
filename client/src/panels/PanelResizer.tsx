import { useRef } from 'react';
import { PANEL_LIMITS, PanelSide } from '../model/store';

type DragState = { startX: number; startWidth: number };

type Props = {
  side: PanelSide;
  /** Current panel width in CSS pixels. */
  width: number;
  onResize: (width: number) => void;
};

/**
 * Grab strip sitting on the inner edge of a side panel. Dragging it reports a
 * new width; the store clamps and persists whatever comes back. Keyboard users
 * get the same control with arrow keys (Shift for a bigger step), and a
 * double-click restores the default width.
 */
export function PanelResizer({ side, width, onResize }: Props) {
  const drag = useRef<DragState | null>(null);
  const limits = PANEL_LIMITS[side];
  const label = side === 'left' ? 'Resize code panel' : 'Resize properties panel';

  // Pointer × key direction: dragging right grows the left panel but shrinks
  // the right one, so both axes are mirrored for the right edge.
  const direction = side === 'left' ? 1 : -1;

  const endDrag = () => {
    drag.current = null;
    document.body.classList.remove('resizing-panels');
  };

  const releaseCapture = (element: HTMLElement, pointerId: number) => {
    try {
      if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
    } catch {
      // The pointer may already be gone (cancelled, or a synthetic event).
    }
  };

  return (
    <div
      className={`panel-resizer panel-resizer-${side}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(width)}
      aria-valuemin={limits.min}
      aria-valuemax={limits.max}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        try {
          event.currentTarget.setPointerCapture?.(event.pointerId);
        } catch {
          // A synthetic event has no live pointer to capture; dragging still
          // works, it just stops tracking if the cursor leaves the strip.
        }
        drag.current = { startX: event.clientX, startWidth: width };
        document.body.classList.add('resizing-panels');
      }}
      onPointerMove={(event) => {
        const state = drag.current;
        if (!state) return;
        onResize(state.startWidth + (event.clientX - state.startX) * direction);
      }}
      onPointerUp={(event) => {
        releaseCapture(event.currentTarget, event.pointerId);
        endDrag();
      }}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onDoubleClick={() => onResize(PANEL_LIMITS[side].default)}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 48 : 16;
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          onResize(width - step * direction);
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          onResize(width + step * direction);
        }
      }}
    />
  );
}
