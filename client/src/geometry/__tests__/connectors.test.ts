import { describe, expect, it } from 'vitest';
import { createConnector, createShape } from '../../model/factories';
import { ArrowType } from '../../model/types';
import { arrowPath, resolveAnchor, resolveConnector } from '../connectors';
import { choosePort, elementBounds } from '../shapes';

const e1 = createShape('rect', 'e1', { x: 0, y: 0, width: 100, height: 60 });
const e2 = createShape('rect', 'e2', { x: 400, y: 200, width: 100, height: 60 });

describe('connector geometry', () => {
  it('resolves every port to the edge midpoint', () => {
    const elements = [e1];
    expect(resolveAnchor({ kind: 'element', elementId: 'e1', port: 'top' }, elements, { x: 0, y: 0 }).point).toEqual({ x: 50, y: 0 });
    expect(resolveAnchor({ kind: 'element', elementId: 'e1', port: 'bottom' }, elements, { x: 0, y: 0 }).point).toEqual({ x: 50, y: 60 });
    expect(resolveAnchor({ kind: 'element', elementId: 'e1', port: 'left' }, elements, { x: 0, y: 0 }).point).toEqual({ x: 0, y: 30 });
    expect(resolveAnchor({ kind: 'element', elementId: 'e1', port: 'right' }, elements, { x: 0, y: 0 }).point).toEqual({ x: 100, y: 30 });
  });

  it('chooses the auto port facing the target', () => {
    expect(
      resolveAnchor({ kind: 'element', elementId: 'e1', port: 'auto' }, [e1], { x: 900, y: 30 }).point,
    ).toEqual({ x: 100, y: 30 });
    expect(
      resolveAnchor({ kind: 'element', elementId: 'e1', port: 'auto' }, [e1], { x: 50, y: 500 }).point,
    ).toEqual({ x: 50, y: 60 });
  });

  it('puts port anchors on the rotated visual edge', () => {
    const rotated = createShape(
      'rect',
      'r1',
      { x: 0, y: 0, width: 100, height: 60 },
      { rotation: 90 },
    );
    const right = resolveAnchor(
      { kind: 'element', elementId: 'r1', port: 'right' },
      [rotated],
      { x: 0, y: 0 },
    );
    // Centre (50,30); the right edge midpoint swings to the bottom of the box.
    expect(right.point.x).toBeCloseTo(50, 5);
    expect(right.point.y).toBeCloseTo(80, 5);
    expect(right.normal.x).toBeCloseTo(0, 5);
    expect(right.normal.y).toBeCloseTo(1, 5);

    const top = resolveAnchor(
      { kind: 'element', elementId: 'r1', port: 'top' },
      [rotated],
      { x: 0, y: 0 },
    );
    // Top edge midpoint is (0,-30) from the centre, rotated to (30,0).
    expect(top.point.x).toBeCloseTo(80, 5);
    expect(top.point.y).toBeCloseTo(30, 5);
  });

  it('chooses the auto port on the visually facing side of a rotated element', () => {
    const rotated = createShape(
      'rect',
      'r1',
      { x: 0, y: 0, width: 100, height: 60 },
      { rotation: 90 },
    );
    const bounds = elementBounds(rotated);
    // Rotated 90°, the element's local top edge faces world +x.
    expect(choosePort(bounds, { x: 300, y: 30 }, 90)).toBe('top');
    expect(choosePort(bounds, { x: -200, y: 30 }, 90)).toBe('bottom');
    expect(choosePort(bounds, { x: 50, y: 400 }, 90)).toBe('right');
    expect(choosePort(bounds, { x: 300, y: 30 })).toBe('right');
  });

  it('starts connectors on the rotated edge instead of the unrotated box', () => {
    const rotated = createShape(
      'rect',
      'r2',
      { x: 0, y: 0, width: 100, height: 60 },
      { rotation: 90 },
    );
    const connector = createConnector(
      'c5',
      {
        from: { kind: 'element', elementId: 'r2', port: 'right' },
        to: { kind: 'element', elementId: 'e2', port: 'left' },
      },
      { routing: 'straight' },
    );
    const resolved = resolveConnector(connector, [rotated, e2]);
    expect(resolved.start.x).toBeCloseTo(50, 5);
    expect(resolved.start.y).toBeCloseTo(80, 5);
    expect(resolved.path.startsWith(`M${resolved.start.x},${resolved.start.y}`)).toBe(true);
  });

  it('routes elbows with axis-aligned corners and correct end angle', () => {
    const connector = createConnector('c1', {
      from: { kind: 'element', elementId: 'e1', port: 'right' },
      to: { kind: 'element', elementId: 'e2', port: 'left' },
    });
    const resolved = resolveConnector(connector, [e1, e2]);
    expect(resolved.start).toEqual({ x: 100, y: 30 });
    expect(resolved.end).toEqual({ x: 400, y: 230 });
    expect(resolved.path.startsWith('M100,30')).toBe(true);
    expect(resolved.path.endsWith('L400,230')).toBe(true);
    expect(resolved.path).toContain('L');
    expect(resolved.endAngle).toBeCloseTo(0, 5);
  });

  it('builds straight and curved paths', () => {
    const straight = createConnector(
      'c2',
      {
        from: { kind: 'element', elementId: 'e1', port: 'right' },
        to: { kind: 'element', elementId: 'e2', port: 'left' },
      },
      { routing: 'straight', endArrow: 'none', startArrow: 'none' },
    );
    expect(resolveConnector(straight, [e1, e2]).path).toBe('M100,30 L400,230');

    const curved = createConnector(
      'c3',
      {
        from: { kind: 'element', elementId: 'e1', port: 'right' },
        to: { kind: 'element', elementId: 'e2', port: 'left' },
      },
      { routing: 'curved' },
    );
    expect(resolveConnector(curved, [e1, e2]).path).toContain('C');
  });

  it('places arrowhead tips exactly at the endpoint', () => {
    const types: ArrowType[] = ['triangle', 'open', 'diamond', 'circle', 'bar'];
    for (const type of types) {
      const shape = arrowPath(type, { x: 100, y: 50 }, 0, 10);
      expect(shape, type).not.toBeNull();
      if (type === 'triangle') {
        expect(shape!.d.startsWith('M100,50')).toBe(true);
      }
      if (type === 'open') {
        expect(shape!.d).toContain('L100,50');
      }
    }
    expect(arrowPath('none', { x: 0, y: 0 }, 0, 10)).toBeNull();
    expect(arrowPath('triangle', { x: 100, y: 50 }, 0, 10)!.filled).toBe(true);
    expect(arrowPath('open', { x: 100, y: 50 }, 0, 10)!.filled).toBe(false);
  });

  it('does not throw for dangling element references', () => {
    const connector = createConnector('c4', {
      from: { kind: 'element', elementId: 'missing', port: 'auto' },
      to: { kind: 'element', elementId: 'e1', port: 'auto' },
    });
    expect(() => resolveConnector(connector, [e1])).not.toThrow();
    expect(resolveConnector(connector, [e1]).start).toEqual({ x: 0, y: 0 });
  });
});
