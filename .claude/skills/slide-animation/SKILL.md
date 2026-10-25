---
name: slide-animation
description: Slide transitions, element animation model, sequencing, and the presentation runtime. Use when adding an effect, changing timing, fixing playback, or working with Motion.
---

# Slide animation

Animation is **presentation-only**. It never mutates the document, never enters undo history, and never affects the serialized code.

## Model

```ts
type AnimationEffect =
  | 'fadeIn' | 'slideIn' | 'zoomIn' | 'drawLine'
  | 'fadeOut' | 'slideOut' | 'zoomOut'
  | 'pulse' | 'bounce' | 'spin' | 'flash';

interface AnimationSpec {
  id: string;
  effect: AnimationEffect;
  trigger: 'onClick' | 'withPrevious' | 'afterPrevious';
  duration: number;   // ms
  delay: number;      // ms
  easing: 'linear' | 'ease' | 'easeIn' | 'easeOut' | 'easeInOut' | 'backOut';
  direction?: 'up' | 'down' | 'left' | 'right';
  repeat?: number;
}

interface SlideTransition {
  type: 'none' | 'fade' | 'slide' | 'push' | 'zoom';
  direction: 'up' | 'down' | 'left' | 'right';
  duration: number;
  easing: Easing;
}
```

## Scheduling (`presentation/schedule.ts`)

`buildSchedule(slide): AnimStep[]` is a pure function and the only place that decides ordering.

- Start a new step at each `onClick`.
- `withPrevious` joins the current step and starts with it.
- `afterPrevious` starts when the previous entry finishes (use the previous entry's `delay + duration`, not the whole step).
- Entries are sorted by element order, so the result is deterministic.
- `repeat` applies to emphasis effects only; ignore it for enter/exit.
- Elements with enter animations start hidden. Elements without animations are visible from the first frame.
- Exit animations run before leaving the slide; `buildExitSchedule(slide)` collects them.

`AnimStep { entries: ScheduledEntry[]; trigger: 'auto' | 'click' }`.

## Runtime (`motion` v14, `motion/react`)

- `PresentMode` owns a scope ref and uses `useAnimate()`.
- Each element group is `data-anim-id={element.id}`; the animation target is `[data-anim-id="e1"]`.
- Enter keyframes (element-local, inner group so the layout transform is untouched):
  - `fadeIn`: `{ opacity: [0, 1] }`
  - `slideIn`: `{ opacity: [0,1], transform: [translate(dir, 60px), none] }`
  - `zoomIn`: `{ opacity: [0,1], scale: [0.85, 1] }`
  - `drawLine`: set `strokeDasharray/offset` on paths, animate `pathLength: [0,1]`.
- Emphasis: `pulse` `scale [1,1.06,1]`, `bounce` `y [0,-18,0]`, `spin` `rotate [0,360]`, `flash` `opacity [1,0.2,1]`.
- Always pass `{ duration: ms / 1000, delay: ms / 1000, ease }`, and map `backOut` to `[0.34, 1.56, 0.64, 1]`.
- Resolve the animation promise before advancing to a click-gated step.
- Cleanup: animations created through `useAnimate` are scoped; also restore `opacity`/transform on slide exit so editor state is untouched.

## Slide transitions

- Wrap the slide in `AnimatePresence mode="wait"` keyed by `slide.id`.
- `fade`: opacity. `slide`/`push`: translate by 100% from `direction`. `zoom`: scale 0.94 → 1 with opacity.
- Duration from `slide.transition.duration`; `none` switches instantly.
- Exit animations for elements run **before** the transition starts; cap the wait at 1200 ms so a long exit cannot stall the deck.

## Presentation mode

- Fullscreen overlay (`requestFullscreen` on enter when available, ignore rejection).
- Keys: `ArrowRight`/`Space`/`PageDown` advance; `ArrowLeft`/`PageUp` back; `Home`/`End` jump; `Esc` exits; `F` toggles fullscreen.
- Click advances. A click that is part of a drag or on a control must not advance.
- Progress bar plus `slide n / m`, hidden after 2 s of inactivity.
- `prefers-reduced-motion`: skip animations, jump to final state, keep slide changes instant.

## Editor preview

"Preview from current slide" opens the same `PresentMode` at the active slide. Editor-only chrome (selection, guides, grid) is hidden in presentation.

## Rules

1. Never store animated values in the document.
2. Never animate on every React render — drive from the step controller.
3. Durations are milliseconds in the model, seconds in Motion. Convert in one helper.
4. Every effect must have a deterministic final state so a skipped or reduced-motion animation still looks correct.
