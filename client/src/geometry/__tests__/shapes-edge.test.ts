import { describe, expect, it } from 'vitest';
import {
  centerOf,
  elementBounds,
  portPoint,
  rotateVector,
  shapePath,
  choosePort,
  starPoints,
} from '../shapes';
import { createShape } from '../../model/factories';

describe('geometry edge cases', () => {
  it('computes port points on a zero-area element without throwing', () => {
    const el = createShape('rect', 'e1', { x: 0, y: 0, width: 0, height: 0 });
    expect(portPoint(el, 'top')).toEqual({ x: 0, y: 0 });
    expect(portPoint(el, 'bottom')).toEqual({ x: 0, y: 0 });
    expect(portPoint(el, 'left')).toEqual({ x: 0, y: 0 });
    expect(portPoint(el, 'right')).toEqual({ x: 0, y: 0 });
  });

  it('returns no rotation transform for an element with zero rotation', () => {
    const el = createShape('rect', 'e1', { x: 0, y: 0, width: 100, height: 100 });
    expect(elementBounds(el)).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    expect(centerOf(elementBounds(el))).toEqual({ x: 50, y: 50 });
  });

  it('rotates a vector by zero without changing it', () => {
    expect(rotateVector({ x: 10, y: -4 }, 0)).toEqual({ x: 10, y: -4 });
  });

  it('rotates a vector 180 degrees to its opposite', () => {
    const rotated = rotateVector({ x: 3, y: 4 }, 180);
    expect(rotated.x).toBeCloseTo(-3, 6);
    expect(rotated.y).toBeCloseTo(-4, 6);
  });

  it('chooses left/right on exact axis ties', () => {
    const bounds = { x: 0, y: 0, width: 100, height: 60 };
    expect(choosePort(bounds, { x: -200, y: 30 })).toBe('left');
    expect(choosePort(bounds, { x: 200, y: 30 })).toBe('right');
  });

  it('chooses top/bottom on exact vertical ties', () => {
    const bounds = { x: 0, y: 0, width: 100, height: 60 };
    expect(choosePort(bounds, { x: 50, y: -200 })).toBe('top');
    expect(choosePort(bounds, { x: 50, y: 200 })).toBe('bottom');
  });

  it('builds a zero-length line path', () => {
    const el = createShape('line', 'l1', { x: 50, y: 50, width: 0, height: 0 });
    expect(shapePath(el)).toBe('M50,50 L50,50');
  });

  it('builds a star with a predictable number of points', () => {
    const points = starPoints(50, 50, 50, 50);
    expect(points).toHaveLength(10);
    const star = createShape('star', 's1', { x: 0, y: 0, width: 100, height: 100 });
    const path = shapePath(star);
    expect(path.startsWith('M')).toBe(true);
    expect(path.endsWith(' Z')).toBe(true);
  });
});
