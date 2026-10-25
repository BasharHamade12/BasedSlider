import {
  AnimationSpec,
  EXIT_EFFECTS,
  Slide,
  ENTER_EFFECTS,
  EMPHASIS_EFFECTS,
} from '../model/types';

export interface ScheduledEntry {
  elementId: string;
  animation: AnimationSpec;
  start: number;
  end: number;
}

export interface AnimStep {
  trigger: 'auto' | 'click';
  entries: ScheduledEntry[];
  duration: number;
}

/**
 * Group enter animations into playback steps.
 * A new step begins at every onClick trigger; everything until the next click
 * plays as part of that click. Leading withPrevious/afterPrevious entries form
 * an automatic step when the slide appears.
 */
export function buildSchedule(slide: Slide): AnimStep[] {
  const steps: AnimStep[] = [];
  let current: AnimStep | null = null;
  let cursor = 0;

  for (const element of slide.elements) {
    for (const animation of element.animations) {
      if (!ENTER_EFFECTS.includes(animation.effect) && !EMPHASIS_EFFECTS.includes(animation.effect)) {
        continue;
      }

      if (animation.trigger === 'onClick') {
        if (current && current.entries.length > 0) steps.push(current);
        current = { trigger: 'click', entries: [], duration: 0 };
        cursor = 0;
      } else if (!current) {
        current = { trigger: 'auto', entries: [], duration: 0 };
        cursor = 0;
      }

      const lastEntry = current.entries[current.entries.length - 1];
      const start =
        animation.trigger === 'withPrevious' && lastEntry
          ? lastEntry.start
          : cursor + animation.delay;
      const end = start + animation.duration;

      current.entries.push({
        elementId: element.id,
        animation,
        start,
        end,
      });
      cursor = Math.max(cursor, end);
      current.duration = Math.max(current.duration, end);
    }
  }

  if (current && current.entries.length > 0) steps.push(current);
  return steps;
}

/** Exit animations for the whole slide, ordered by delay. */
export function buildExitSchedule(slide: Slide): ScheduledEntry[] {
  const entries: ScheduledEntry[] = [];
  let cursor = 0;

  for (const element of slide.elements) {
    for (const animation of element.animations) {
      if (!EXIT_EFFECTS.includes(animation.effect)) continue;
      const last = entries[entries.length - 1];
      const start =
        animation.trigger === 'withPrevious' && last
          ? last.start
          : cursor + animation.delay;
      const end = start + animation.duration;
      entries.push({ elementId: element.id, animation, start, end });
      cursor = Math.max(cursor, end);
    }
  }

  return entries;
}

/** Elements that should start hidden because they have an entrance animation. */
export function enterAnimatedIds(slide: Slide): Set<string> {
  const ids = new Set<string>();
  for (const element of slide.elements) {
    if (element.animations.some((animation) => ENTER_EFFECTS.includes(animation.effect))) {
      ids.add(element.id);
    }
  }
  return ids;
}

export function totalDuration(entries: ScheduledEntry[]): number {
  return entries.reduce((max, entry) => Math.max(max, entry.end), 0);
}

export function slideHasAnimations(slide: Slide): boolean {
  return slide.elements.some((element) => element.animations.length > 0);
}
