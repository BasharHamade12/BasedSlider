import { AnimationEffect, Direction, Easing } from '../model/types';

export type EaseValue = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | [number, number, number, number];

export function easeValue(easing: Easing): EaseValue {
  switch (easing) {
    case 'linear':
      return 'linear';
    case 'easeIn':
      return 'easeIn';
    case 'easeInOut':
      return 'easeInOut';
    case 'backOut':
      return [0.34, 1.56, 0.64, 1];
    case 'ease':
    case 'easeOut':
    default:
      return 'easeOut';
  }
}

export interface MotionKeyframes {
  [key: string]: number | number[];
}

function axisFor(direction: Direction, incoming: boolean): MotionKeyframes {
  const sign = incoming ? 1 : -1;
  switch (direction) {
    case 'left':
      return { x: [80 * sign, 0] };
    case 'right':
      return { x: [-80 * sign, 0] };
    case 'up':
      return { y: [80 * sign, 0] };
    case 'down':
      return { y: [-80 * sign, 0] };
  }
}

/** Keyframes for transform/opacity effects. drawLine is handled separately. */
export function keyframesFor(effect: AnimationEffect, direction: Direction = 'up'): MotionKeyframes | null {
  switch (effect) {
    case 'fadeIn':
      return { opacity: [0, 1] };
    case 'slideIn':
      return { opacity: [0, 1], ...axisFor(direction, true) };
    case 'zoomIn':
      return { opacity: [0, 1], scale: [0.85, 1] };
    case 'drawLine':
      return null;
    case 'fadeOut':
      return { opacity: [1, 0] };
    case 'slideOut':
      return { opacity: [1, 0], ...axisFor(direction, false) };
    case 'zoomOut':
      return { opacity: [1, 0], scale: [1, 0.85] };
    case 'pulse':
      return { scale: [1, 1.06, 1] };
    case 'bounce':
      return { y: [0, -18, 0] };
    case 'spin':
      return { rotate: [0, 360] };
    case 'flash':
      return { opacity: [1, 0.2, 1, 0.2, 1] };
  }
}

export function drawKeyframes(): MotionKeyframes {
  return { pathLength: [0, 1], opacity: [0, 1] };
}

export function finalOpacity(effect: AnimationEffect): number {
  return effect === 'fadeOut' || effect === 'slideOut' || effect === 'zoomOut' ? 0 : 1;
}

export function effectDurationMs(effect: AnimationEffect, duration: number): number {
  switch (effect) {
    case 'pulse':
    case 'bounce':
    case 'flash':
      return duration;
    default:
      return duration;
  }
}
