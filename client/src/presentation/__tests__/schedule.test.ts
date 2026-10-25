import { describe, expect, it } from 'vitest';
import { createAnimation, createShape, createSlide } from '../../model/factories';
import {
  buildExitSchedule,
  buildSchedule,
  enterAnimatedIds,
  totalDuration,
} from '../schedule';

function buildSlide() {
  return createSlide('s1', 'Animated', {
    elements: [
      createShape('rect', 'e1', { x: 0, y: 0 }, {
        animations: [
          createAnimation('a1', {
            effect: 'fadeIn',
            trigger: 'afterPrevious',
            duration: 500,
            delay: 100,
          }),
        ],
      }),
      createShape('rect', 'e2', { x: 100, y: 0 }, {
        animations: [
          createAnimation('a2', {
            effect: 'zoomIn',
            trigger: 'withPrevious',
            duration: 300,
          }),
        ],
      }),
      createShape('rect', 'e3', { x: 200, y: 0 }, {
        animations: [
          createAnimation('a3', {
            effect: 'slideIn',
            trigger: 'onClick',
            duration: 400,
            delay: 50,
            direction: 'left',
          }),
        ],
      }),
      createShape('rect', 'e4', { x: 300, y: 0 }, {
        animations: [
          createAnimation('a4', {
            effect: 'fadeIn',
            trigger: 'afterPrevious',
            duration: 200,
            delay: 100,
          }),
        ],
      }),
      createShape('rect', 'e5', { x: 400, y: 0 }, {
        animations: [
          createAnimation('a5', {
            effect: 'fadeOut',
            trigger: 'afterPrevious',
            duration: 300,
          }),
        ],
      }),
    ],
  });
}

describe('animation schedule', () => {
  it('groups automatic and click-gated steps', () => {
    const steps = buildSchedule(buildSlide());
    expect(steps).toHaveLength(2);
    expect(steps[0].trigger).toBe('auto');
    expect(steps[0].entries.map((entry) => entry.elementId)).toEqual(['e1', 'e2']);
    expect(steps[1].trigger).toBe('click');
    expect(steps[1].entries.map((entry) => entry.elementId)).toEqual(['e3', 'e4']);
  });

  it('computes withPrevious and afterPrevious timing inside a step', () => {
    const [auto, click] = buildSchedule(buildSlide());
    expect(auto.entries[0].start).toBe(100);
    expect(auto.entries[1].start).toBe(100);
    expect(auto.duration).toBe(600);

    expect(click.entries[0].start).toBe(50);
    expect(click.entries[0].end).toBe(450);
    expect(click.entries[1].start).toBe(550);
    expect(click.entries[1].end).toBe(750);
    expect(click.duration).toBe(750);
  });

  it('keeps exit animations out of the enter schedule', () => {
    const schedule = buildSchedule(buildSlide());
    const ids = schedule.flatMap((step) => step.entries.map((entry) => entry.elementId));
    expect(ids).not.toContain('e5');
  });

  it('builds an exit schedule for exit effects only', () => {
    const exits = buildExitSchedule(buildSlide());
    expect(exits).toHaveLength(1);
    expect(exits[0].elementId).toBe('e5');
    expect(totalDuration(exits)).toBe(300);
  });

  it('marks only enter-animated elements as initially hidden', () => {
    const ids = enterAnimatedIds(buildSlide());
    expect([...ids].sort()).toEqual(['e1', 'e2', 'e3', 'e4']);
  });

  it('returns no steps for a slide without animations', () => {
    const slide = createSlide('s2', 'Still', {
      elements: [createShape('rect', 'e1', { x: 0, y: 0 })],
    });
    expect(buildSchedule(slide)).toEqual([]);
    expect(enterAnimatedIds(slide).size).toBe(0);
    expect(buildExitSchedule(slide)).toEqual([]);
  });
});
