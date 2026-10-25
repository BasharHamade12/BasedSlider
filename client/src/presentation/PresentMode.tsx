import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimate, Variants } from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ElementView } from '../canvas/ElementView';
import { canvasSize, HtmlEmbedElement, Slide } from '../model/types';
import { useDocStore, useUiStore } from '../model/store';
import { AnimStep, buildExitSchedule, buildSchedule, enterAnimatedIds, ScheduledEntry } from './schedule';
import { drawKeyframes, easeValue, keyframesFor } from './effects';

function transitionVariants(slide: Slide): Variants {
  const transition = slide.transition;
  const duration = transition.type === 'none' ? 0 : transition.duration / 1000;
  const direction = transition.direction;
  const horizontal = direction === 'left' || direction === 'right';
  const sign = direction === 'left' || direction === 'up' ? 1 : -1;
  const offset = horizontal ? { x: `${100 * sign}%` } : { y: `${100 * sign}%` };
  const exitOffset = horizontal ? { x: `${-100 * sign}%` } : { y: `${-100 * sign}%` };

  if (transition.type === 'fade' || transition.type === 'none') {
    return {
      initial: { opacity: transition.type === 'none' ? 1 : 0 },
      animate: { opacity: 1, transition: { duration, ease: easeValue(transition.easing) } },
      exit: { opacity: 0, transition: { duration, ease: easeValue(transition.easing) } },
    };
  }
  if (transition.type === 'zoom') {
    return {
      initial: { opacity: 0, scale: 0.94 },
      animate: { opacity: 1, scale: 1, transition: { duration, ease: easeValue(transition.easing) } },
      exit: { opacity: 0, scale: 1.04, transition: { duration, ease: easeValue(transition.easing) } },
    };
  }
  return {
    initial: { opacity: 1, ...offset },
    animate: { opacity: 1, x: 0, y: 0, transition: { duration, ease: easeValue(transition.easing) } },
    exit: { opacity: 1, ...exitOffset, transition: { duration, ease: easeValue(transition.easing) } },
  };
}

export function PresentMode() {
  const doc = useDocStore((state) => state.doc);
  const startIndex = useUiStore((state) => state.presentFrom);
  const stopPresenting = useUiStore((state) => state.stopPresenting);

  const [index, setIndex] = useState(() =>
    Math.min(Math.max(0, startIndex), Math.max(0, doc.slides.length - 1)),
  );
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [reduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const busyRef = useRef(false);
  const stepRef = useRef(0);
  const cancelledRef = useRef(false);
  const exitingRef = useRef(false);
  const runIdRef = useRef(0);

  const slide = doc.slides[Math.min(index, doc.slides.length - 1)];
  const schedule = useMemo(() => (slide ? buildSchedule(slide) : []), [slide]);
  const scheduleRef = useRef<AnimStep[]>(schedule);
  scheduleRef.current = schedule;
  const slideRef = useRef(slide);
  slideRef.current = slide;

  const [, animate] = useAnimate<HTMLDivElement>();

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const overlay = overlayRef.current;
    const request = overlay?.requestFullscreen?.();
    if (request) request.catch(() => undefined);
    return () => {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined);
      }
    };
  }, []);

  const markShown = useCallback((entries: ScheduledEntry[]) => {
    setShown((current) => {
      const next = new Set(current);
      for (const entry of entries) next.add(entry.elementId);
      return next;
    });
  }, []);

  const playEntry = useCallback(
    async (entry: ScheduledEntry) => {
      if (reduced) return;
      const root = overlayRef.current;
      if (!root) return;
      const targets = Array.from(
        root.querySelectorAll(`[data-anim-id="${entry.elementId}"]`),
      );
      if (targets.length === 0) return;
      const options = {
        duration: Math.max(0.01, entry.animation.duration / 1000),
        delay: Math.max(0, entry.start / 1000),
        ease: easeValue(entry.animation.easing),
      };

      try {
        if (entry.animation.effect === 'drawLine') {
          const paths = targets.flatMap((target) => Array.from(target.querySelectorAll('path')));
          if (paths.length === 0) return;
          await animate(paths, { pathLength: 0 }, { duration: 0 });
          await animate(paths, drawKeyframes(), options);
          return;
        }

        const keyframes = keyframesFor(entry.animation.effect, entry.animation.direction);
        if (keyframes) {
          await animate(targets, keyframes, options);
        }
      } catch (error) {
        // A failed animation must not strand the deck with hidden elements.
        console.warn('Presentation animation failed', error);
      }
    },
    [animate, reduced],
  );

  const playStep = useCallback(
    async (step: AnimStep) => {
      if (reduced) {
        markShown(step.entries);
        return;
      }
      await Promise.all(step.entries.map((entry) => playEntry(entry)));
      markShown(step.entries);
    },
    [markShown, playEntry, reduced],
  );

  // Play everything up to the first click-gated step whenever the slide changes.
  useEffect(() => {
    runIdRef.current += 1;
    const runId = runIdRef.current;
    cancelledRef.current = false;
    stepRef.current = 0;
    setShown(new Set());
    busyRef.current = true;

    if (reduced) {
      if (slide) setShown(new Set(slide.elements.map((element) => element.id)));
      stepRef.current = schedule.length;
      busyRef.current = false;
      return () => {
        cancelledRef.current = true;
      };
    }

    const run = async () => {
      for (const step of schedule) {
        if (cancelledRef.current || runIdRef.current !== runId) return;
        if (step.trigger === 'click') break;
        await playStep(step);
        if (runIdRef.current !== runId) return;
        stepRef.current += 1;
      }
      if (runIdRef.current === runId) busyRef.current = false;
    };
    void run();

    return () => {
      cancelledRef.current = true;
    };
  }, [index, playStep, reduced, schedule, slide]);

  const goTo = useCallback(
    async (target: number) => {
      if (target < 0 || target >= doc.slides.length || exitingRef.current) return;
      exitingRef.current = true;
      busyRef.current = true;

      const currentSlide = slideRef.current;
      if (currentSlide && !reduced) {
        const exits = buildExitSchedule(currentSlide);
        if (exits.length > 0) {
          const wait = new Promise<void>((resolve) => {
            window.setTimeout(resolve, Math.min(1200, Math.max(...exits.map((entry) => entry.end))));
          });
          await Promise.race([Promise.all(exits.map((entry) => playEntry(entry))), wait]);
        }
      }

      setIndex(target);
      exitingRef.current = false;
      busyRef.current = false;
    },
    [doc.slides.length, playEntry, reduced],
  );

  const advance = useCallback(async () => {
    if (busyRef.current || exitingRef.current) return;
    const step = scheduleRef.current[stepRef.current];
    if (step) {
      busyRef.current = true;
      await playStep(step);
      stepRef.current += 1;
      busyRef.current = false;
      return;
    }
    if (index + 1 >= doc.slides.length) {
      stopPresenting();
      return;
    }
    await goTo(index + 1);
  }, [doc.slides.length, goTo, index, playStep, stopPresenting]);

  const back = useCallback(async () => {
    if (index <= 0) return;
    await goTo(index - 1);
  }, [goTo, index]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        void advance();
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        void back();
      } else if (event.key === 'Home') {
        event.preventDefault();
        void goTo(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        void goTo(doc.slides.length - 1);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        stopPresenting();
      } else if (event.key === 'f' || event.key === 'F') {
        const overlay = overlayRef.current;
        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => undefined);
        } else if (overlay?.requestFullscreen) {
          overlay.requestFullscreen().catch(() => undefined);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [advance, back, doc.slides.length, goTo, stopPresenting]);

  if (!slide) return null;

  const board = canvasSize(slide);
  const scale = Math.min(viewport.width / board.width, viewport.height / board.height) * 0.96;
  const enterIds = enterAnimatedIds(slide);
  const variants = transitionVariants(slide);

  return (
    <div
      ref={(node) => {
        overlayRef.current = node;
      }}
      className="present-overlay"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('button')) return;
        void advance();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Presentation"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={slide.id}
          className="present-slide"
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ width: board.width * scale, height: board.height * scale }}
        >
          <svg
            width={board.width * scale}
            height={board.height * scale}
            viewBox={`0 0 ${board.width} ${board.height}`}
            preserveAspectRatio="none"
          >
            <rect x={0} y={0} width={board.width} height={board.height} fill={slide.background} />
            {slide.backgroundImage && (
              <image
                href={slide.backgroundImage}
                x={0}
                y={0}
                width={board.width}
                height={board.height}
                preserveAspectRatio="xMidYMid meet"
                pointerEvents="none"
              />
            )}
            {slide.elements.map((element) => {
              const hidden = enterIds.has(element.id) && !shown.has(element.id);
              return (
                <g
                  key={element.id}
                  data-anim-id={element.id}
                  style={{ opacity: hidden ? 0 : 1 }}
                >
                  <ElementView element={element} elements={slide.elements} />
                </g>
              );
            })}
          </svg>
          {/* Live HTML embeds can't render inside the SVG; mirror them here so
              they follow the slide's transition transform. `data-anim-id` lets
              the shared animation scheduler drive the frame like any SVG group. */}
          {slide.elements
            .filter((element): element is HtmlEmbedElement => element.type === 'html' && !element.hidden)
            .map((element) => {
              const hidden = enterIds.has(element.id) && !shown.has(element.id);
              const sandbox =
                element.content.trim() !== ''
                  ? 'allow-scripts'
                  : 'allow-scripts allow-same-origin allow-forms allow-popups';
              return (
                <div
                  key={`${element.id}:${element.reloadToken || 0}`}
                  data-anim-id={element.id}
                  style={{
                    position: 'absolute',
                    left: element.x * scale,
                    top: element.y * scale,
                    width: element.width * scale,
                    height: element.height * scale,
                    borderRadius: element.radius > 0 ? element.radius * scale : undefined,
                    overflow: 'hidden',
                    opacity: hidden ? 0 : 1,
                    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
                    pointerEvents: hidden ? 'none' : undefined,
                  }}
                >
                  <iframe
                    title={`HTML embed ${element.id}`}
                    srcDoc={element.content.trim() !== '' ? element.content : undefined}
                    src={element.content.trim() !== '' ? undefined : element.src || undefined}
                    sandbox={sandbox}
                    referrerPolicy="no-referrer"
                    style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                  />
                </div>
              );
            })}
        </motion.div>
      </AnimatePresence>

      <div className="present-hud" onClick={(event) => event.stopPropagation()}>
        <button className="present-nav" onClick={() => void back()} disabled={index === 0} title="Previous">
          <ChevronLeft size={18} />
        </button>
        <span className="present-counter">
          {index + 1} / {doc.slides.length}
        </span>
        <button
          className="present-nav"
          onClick={() => void advance()}
          disabled={index >= doc.slides.length - 1 && stepRef.current >= schedule.length}
          title="Next"
        >
          <ChevronRight size={18} />
        </button>
        <button className="present-nav" onClick={stopPresenting} title="Exit (Esc)">
          <X size={18} />
        </button>
      </div>

      <div className="present-progress">
        <span style={{ width: `${((index + 1) / doc.slides.length) * 100}%` }} />
      </div>
      <p className="present-slide-name">{slide.name}</p>
    </div>
  );
}
