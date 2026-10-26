import { RefObject, useEffect, useState } from 'react';
import { SLIDE_H, SLIDE_W } from '../model/types';
import { useUiStore } from '../model/store';

export interface CanvasMetrics {
  scale: number;
  width: number;
  height: number;
  containerWidth: number;
  containerHeight: number;
}

/**
 * Board metrics for the *active* slide's canvas size. Slides override width
 * and height in the model; editing and zoom math scale from those values
 * instead of the deck defaults.
 */
export function useCanvasSize(
  ref: RefObject<HTMLDivElement | null>,
  boardWidth: number = SLIDE_W,
  boardHeight: number = SLIDE_H,
): CanvasMetrics {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const zoom = useUiStore((state) => state.zoom);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      setSize({ width: element.clientWidth, height: element.clientHeight });
    };
    update();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  // Tighter padding on narrow (phone-sized) viewports so the slide keeps
  // every available pixel.
  const padding = size.width > 0 && size.width < 720 ? 8 : 24;
  const availableW = Math.max(0, size.width - padding * 2);
  const availableH = Math.max(0, size.height - padding * 2);
  const fit =
    availableW > 0 && availableH > 0
      ? Math.min(availableW / boardWidth, availableH / boardHeight)
      : 0;
  const scale = fit * zoom;

  return {
    scale,
    width: boardWidth * scale,
    height: boardHeight * scale,
    containerWidth: size.width,
    containerHeight: size.height,
  };
}
