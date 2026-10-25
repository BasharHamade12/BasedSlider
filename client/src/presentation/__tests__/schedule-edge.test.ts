import { describe, expect, it } from 'vitest';
import {
  buildSchedule,
  buildExitSchedule,
  enterAnimatedIds,
  slideHasAnimations,
} from '../schedule';
import { createAnimation, createEmptyDoc, createShape, createPen } from '../../model/factories';

describe('presentation scheduling edge cases', () => {
  it('returns an empty schedule for a slide with no animations', () => {
    const doc = createEmptyDoc();
    doc.slides[0].elements = [createShape('rect', 'e1', { x: 0, y: 0, width: 100, height: 60 })];
    expect(buildSchedule(doc.slides[0])).toHaveLength(0);
    expect(enterAnimatedIds(doc.slides[0])).toHaveLength(0);
    expect(slideHasAnimations(doc.slides[0])).toBe(false);
  });

  it('groups only onClick triggers as separate steps', () => {
    const slide = createEmptyDoc().slides[0];
    const rect = createShape('rect', 'e1', { x: 0, y: 0, width: 100, height: 60 });
    rect.animations = [
      createAnimation('a1', { effect: 'fadeIn', trigger: 'onClick', duration: 100 }),
      createAnimation('a2', { effect: 'fadeIn', trigger: 'onClick', duration: 100 }),
    ];
    slide.elements = [rect];
    const steps = buildSchedule(slide);
    expect(steps).toHaveLength(2);
    expect(steps.map((step) => step.trigger)).toEqual(['click', 'click']);
  });

  it('chains withPrevious animations onto the previous start', () => {
    const slide = createEmptyDoc().slides[0];
    const rect = createShape('rect', 'e1', { x: 0, y: 0, width: 100, height: 60 });
    rect.animations = [
      createAnimation('a1', { effect: 'fadeIn', trigger: 'afterPrevious', delay: 10, duration: 200 }),
      createAnimation('a2', { effect: 'fadeIn', trigger: 'withPrevious', delay: 0, duration: 100 }),
    ];
    slide.elements = [rect];
    const steps = buildSchedule(slide);
    expect(steps).toHaveLength(1);
    expect(steps[0].entries.map((entry) => entry.start)).toEqual([10, 10]);
  });

  it('includes emphasis animations in the schedule', () => {
    const slide = createEmptyDoc().slides[0];
    const rect = createShape('rect', 'e1', { x: 0, y: 0, width: 100, height: 60 });
    rect.animations = [
      createAnimation('a1', { effect: 'fadeIn', trigger: 'afterPrevious', duration: 100 }),
      createAnimation('a2', { effect: 'pulse', trigger: 'afterPrevious', duration: 300 }),
    ];
    slide.elements = [rect];
    const steps = buildSchedule(slide);
    expect(steps[0].entries.map((entry) => entry.animation.effect)).toEqual(['fadeIn', 'pulse']);
  });

  it('marks every element with any enter effect as initially hidden', () => {
    const slide = createEmptyDoc().slides[0];
    const rect = createShape('rect', 'e1', { x: 0, y: 0, width: 100, height: 60 });
    rect.animations = [createAnimation('a1', { effect: 'zoomIn', trigger: 'afterPrevious', duration: 100 })];
    slide.elements = [rect];
    expect(enterAnimatedIds(slide)).toEqual(new Set(['e1']));
  });

  it('builds an exit schedule only for exit effects', () => {
    const slide = createEmptyDoc().slides[0];
    const rect = createShape('rect', 'e1', { x: 0, y: 0, width: 100, height: 60 });
    rect.animations = [
      createAnimation('a1', { effect: 'fadeOut', trigger: 'afterPrevious', delay: 50, duration: 200 }),
      createAnimation('a2', { effect: 'fadeIn', trigger: 'afterPrevious', duration: 100 }),
    ];
    slide.elements = [rect];
    const exits = buildExitSchedule(slide);
    expect(exits).toHaveLength(1);
    expect(exits[0].animation.effect).toBe('fadeOut');
  });

  it('handles a pen element with only exit animations', () => {
    const slide = createEmptyDoc().slides[0];
    const pen = createPen('e1', [
      { x: 0, y: 0, pressure: 0.5 },
      { x: 100, y: 100, pressure: 0.5 },
    ]);
    pen.animations = [createAnimation('a1', { effect: 'fadeOut', trigger: 'afterPrevious', duration: 200 })];
    slide.elements = [pen];
    const exits = buildExitSchedule(slide);
    expect(exits).toHaveLength(1);
    expect(exits[0].elementId).toBe('e1');
  });
});
