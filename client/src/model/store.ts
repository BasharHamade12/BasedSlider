import { create } from 'zustand';
import { compile } from '../compiler';
import {
  AnimationEffect,
  AnimationSpec,
  ConnectorElement,
  Diagnostic,
  Doc,
  Element,
  ElementType,
  FigureKind,
  SLIDE_H,
  SLIDE_W,
  Slide,
  TextBlock,
} from './types';
import { collectIds, findElement, maxId, nextElementId, nextId, nextSlideId } from './ids';
import {
  createElementOfType,
  createImage,
  createSlide,
  createTextBlock,
  duplicateElements,
  imagePlacement,
  newAnimationFor,
  normalizePen,
  resizePen,
} from './factories';
import { measureTextBlock } from '../geometry/measure';
import { createFigure } from './factories';
import { repairGroups } from './groups';
import { serializeDoc } from './serialize';
import { docEquals, validateDoc } from './validate';

export type Tool =
  | 'select'
  | ElementType
  | 'pen'
  | 'highlighter'
  | 'connector';

export type ApplyOptions = {
  history?: boolean;
  coalesce?: string;
};

export type ElementPatch = Record<string, unknown>;

export type AddElementOptions = {
  /** Select the new element after insert (default true). */
  select?: boolean;
  /** Switch back to the select tool after insert (default true). Ignored when select is false. */
  keepTool?: boolean;
};

const HISTORY_LIMIT = 100;
const COALESCE_MS = 600;

let transaction: { snapshot: Doc } | null = null;
let lastCoalesce: { key: string; time: number } = { key: '', time: 0 };
let clipboard: Element[] = [];

interface DocState {
  doc: Doc;
  past: Doc[];
  future: Doc[];

  applyDoc: (label: string, recipe: (draft: Doc) => void, opts?: ApplyOptions) => boolean;
  beginTransaction: () => void;
  commitTransaction: (label: string) => void;
  cancelTransaction: () => void;
  undo: () => void;
  redo: () => void;
  setDoc: (doc: Doc, label: string, opts?: ApplyOptions) => void;
  applyCode: (source: string) => { ok: boolean; errors: Diagnostic[] };

  addSlide: () => void;
  duplicateSlide: (index: number) => void;
  deleteSlide: (index: number) => void;
  moveSlide: (from: number, to: number) => void;
  updateSlide: (index: number, patch: Partial<Omit<Slide, 'id' | 'elements'>>) => void;
  updateTransition: (index: number, patch: Partial<Slide['transition']>) => void;
  applyBoardSizeAll: (width: number, height: number) => void;

  addElement: (element: Element, opts?: AddElementOptions) => void;
  addImage: (src: string, naturalWidth: number, naturalHeight: number) => string;
  importPdfPages: (
    pages: { src: string; width: number; height: number; pageWidth?: number; pageHeight?: number }[],
  ) => void;
  insertElement: (type: ElementType, x: number, y: number) => string | null;
  insertFigure: (kind: FigureKind) => void;
  updateElement: (id: string, patch: ElementPatch, opts?: ApplyOptions) => void;
  updateText: (id: string, patch: Partial<TextBlock>, target?: 'text' | 'label') => void;
  updateConnectorEndpoint: (
    id: string,
    which: 'from' | 'to',
    anchor: ConnectorElement['from'],
  ) => void;
  moveElements: (ids: string[], dx: number, dy: number) => void;
  nudge: (ids: string[], dx: number, dy: number) => void;
  deleteElements: (ids: string[]) => void;
  duplicateSelection: (ids: string[]) => void;
  copySelection: (ids: string[]) => void;
  pasteClipboard: () => void;
  reorder: (ids: string[], mode: 'front' | 'back' | 'forward' | 'backward') => void;
  align: (ids: string[], mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  distribute: (ids: string[], axis: 'horizontal' | 'vertical') => void;
  groupSelection: (ids: string[]) => void;
  ungroupSelection: (ids: string[]) => void;
  addAnimation: (id: string, effect?: AnimationEffect) => void;
  updateAnimation: (id: string, animationId: string, patch: Partial<AnimationSpec>) => void;
  removeAnimation: (id: string, animationId: string) => void;
}

const initialDoc = createEmptyDocSafe();

function createEmptyDocSafe(): Doc {
  const doc: Doc = {
    version: 2,
    title: 'Untitled deck',
    width: 1920,
    height: 1080,
    slides: [],
  };
  doc.slides.push(createSlide(nextSlideId(doc), 'Slide 1'));
  return doc;
}

function activeIndex(): number {
  return useUiStore.getState().activeSlideIndex;
}

function activeSlide(doc: Doc): Slide | undefined {
  return doc.slides[Math.min(activeIndex(), doc.slides.length - 1)];
}

function geometryOf(el: Element): { x: number; y: number; width: number; height: number } | null {
  if (el.type === 'connector') return null;
  return { x: el.x, y: el.y, width: el.width, height: el.height };
}

export const useDocStore = create<DocState>((set, get) => {
  const commit = (next: Doc, previous: Doc, label: string, coalesce?: string): void => {
    const { past } = get();
    let nextPast = past;
    if (!coalesce || lastCoalesce.key !== coalesce || Date.now() - lastCoalesce.time > COALESCE_MS) {
      nextPast = [...past, previous].slice(-HISTORY_LIMIT);
    }
    lastCoalesce = coalesce
      ? { key: coalesce, time: Date.now() }
      : { key: '', time: 0 };
    set({ doc: next, past: nextPast, future: [] });
    void label;
  };

  return {
    doc: initialDoc,
    past: [],
    future: [],

    applyDoc: (label, recipe, opts = {}) => {
      const previous = get().doc;
      const next = structuredClone(previous);
      recipe(next);

      const errors = validateDoc(next).filter((d) => d.severity === 'error');
      if (errors.length > 0) {
        useUiStore.getState().setCompilerErrors(errors);
        return false;
      }

      if (opts.history === false) {
        set({ doc: next });
      } else if (transaction) {
        set({ doc: next });
      } else {
        commit(next, previous, label, opts.coalesce);
      }

      useUiStore.getState().syncFromDoc(next);
      return true;
    },

    beginTransaction: () => {
      if (!transaction) {
        transaction = { snapshot: structuredClone(get().doc) };
      }
    },

    commitTransaction: (label) => {
      if (!transaction) return;
      const snapshot = transaction.snapshot;
      transaction = null;
      const current = get().doc;
      if (docEquals(snapshot, current)) return;
      set((state) => ({
        past: [...state.past, snapshot].slice(-HISTORY_LIMIT),
        future: [],
      }));
      void label;
    },

    cancelTransaction: () => {
      if (!transaction) return;
      const snapshot = transaction.snapshot;
      transaction = null;
      set({ doc: snapshot });
      useUiStore.getState().syncFromDoc(snapshot);
    },

    undo: () => {
      const { doc, past, future } = get();
      if (past.length === 0) return;
      const previous = past[past.length - 1];
      set({
        doc: previous,
        past: past.slice(0, -1),
        future: [doc, ...future].slice(0, HISTORY_LIMIT),
      });
      lastCoalesce = { key: '', time: 0 };
      useUiStore.getState().syncFromDoc(previous);
    },

    redo: () => {
      const { doc, past, future } = get();
      if (future.length === 0) return;
      const next = future[0];
      set({
        doc: next,
        past: [...past, doc].slice(-HISTORY_LIMIT),
        future: future.slice(1),
      });
      lastCoalesce = { key: '', time: 0 };
      useUiStore.getState().syncFromDoc(next);
    },

    setDoc: (doc, label, opts = {}) => {
      const previous = get().doc;
      if (opts.history === false) {
        set({ doc });
      } else {
        commit(doc, previous, label, opts.coalesce);
      }
      useUiStore.getState().syncFromDoc(doc);
    },

    applyCode: (source) => {
      const result = compile(source);
      useUiStore.getState().setCompilerErrors(result.errors);
      if (!result.doc) {
        return { ok: false, errors: result.errors };
      }
      const previous = get().doc;
      set({
        doc: result.doc,
        past: [...get().past, previous].slice(-HISTORY_LIMIT),
        future: [],
      });
      useUiStore.getState().afterCodeApplied(result.doc);
      return { ok: true, errors: result.errors };
    },

    /* ─── slides ─── */

    addSlide: () => {
      const doc = get().doc;
      const index = activeIndex();
      const slide = createSlide(nextSlideId(doc), `Slide ${doc.slides.length + 1}`);
      get().applyDoc('Add slide', (draft) => {
        draft.slides.splice(index + 1, 0, slide);
      });
      useUiStore.getState().setActiveSlide(index + 1);
    },

    duplicateSlide: (index) => {
      const doc = get().doc;
      const source = doc.slides[index];
      if (!source) return;
      const { elements } = duplicateElements(source.elements, doc, { x: 0, y: 0 });
      const slide: Slide = {
        ...structuredClone(source),
        id: nextSlideId(doc),
        name: `${source.name} copy`,
        elements,
      };
      get().applyDoc('Duplicate slide', (draft) => {
        draft.slides.splice(index + 1, 0, slide);
      });
      useUiStore.getState().setActiveSlide(index + 1);
    },

    deleteSlide: (index) => {
      const doc = get().doc;
      if (doc.slides.length <= 1) return;
      get().applyDoc('Delete slide', (draft) => {
        draft.slides.splice(index, 1);
      });
      const nextIndex = Math.max(0, Math.min(index, get().doc.slides.length - 1));
      useUiStore.getState().setActiveSlide(nextIndex);
      useUiStore.getState().clearSelection();
    },

    moveSlide: (from, to) => {
      get().applyDoc('Reorder slides', (draft) => {
        if (from < 0 || from >= draft.slides.length) return;
        const target = Math.max(0, Math.min(to, draft.slides.length - 1));
        const [slide] = draft.slides.splice(from, 1);
        draft.slides.splice(target, 0, slide);
      });
      useUiStore.getState().setActiveSlide(to);
    },

    updateSlide: (index, patch) => {
      get().applyDoc('Update slide', (draft) => {
        const slide = draft.slides[index];
        if (slide) Object.assign(slide, patch);
      });
    },

    updateTransition: (index, patch) => {
      get().applyDoc('Update transition', (draft) => {
        const slide = draft.slides[index];
        if (slide) Object.assign(slide.transition, patch);
      });
    },

    /** One undo step for “apply this canvas size to every slide”. */
    applyBoardSizeAll: (width, height) => {
      get().applyDoc('Resize all slides', (draft) => {
        for (const slide of draft.slides) {
          slide.width = width;
          slide.height = height;
        }
      });
    },

    /* ─── elements ─── */

    addElement: (element, opts) => {
      const doc = get().doc;
      const index = activeIndex();
      const slide = doc.slides[index];
      if (!slide) return;
      get().applyDoc('Add element', (draft) => {
        draft.slides[index]?.elements.push(element);
      });
      const { select = true, keepTool = true } = opts ?? {};
      if (select) {
        useUiStore.getState().setSelection([element.id]);
        if (keepTool) useUiStore.getState().setTool('select');
      }
    },

    addImage: (src, naturalWidth, naturalHeight) => {
      const doc = get().doc;
      const element = createImage(nextElementId(doc), imagePlacement(naturalWidth, naturalHeight), {
        src,
      });
      get().addElement(element);
      return element.id;
    },

    /**
     * One slide per imported PDF page. The page becomes the slide's
     * `backgroundImage` instead of an element, so it can never be selected,
     * moved or deleted by accident — annotations drawn with any tool sit
     * directly on top of the page. History, serialization and export still
     * keep working; undo removes the whole batch of slides in one step.
     *
     * The canvas takes the page's content box in points (the page minus its
     * blank margins, measured by the importer), so the slide hugs the
     * document's drawn content; the higher-res cropped raster just fills that
     * canvas (same aspect, so no letterboxing).
     */
    importPdfPages: (pages) => {
      if (pages.length === 0) return;
      const doc = get().doc;
      const index = activeIndex();
      let slideCounter = maxId(doc, 's');
      const slides: Slide[] = pages.map((page, i) => {
        slideCounter += 1;
        // Prefer the PDF page's real size over the raster scale. The UI floor
        // for a canvas is 320, so an unusually small page is scaled up on both
        // axes (never distorted) and capped at 7680 for absurdly large ones.
        let width = Math.round(page.pageWidth ?? page.width) || SLIDE_W;
        let height = Math.round(page.pageHeight ?? page.height) || SLIDE_H;
        const minEdge = Math.min(width, height);
        if (minEdge < 320) {
          const factor = 320 / minEdge;
          width = Math.round(width * factor);
          height = Math.round(height * factor);
        }
        const maxEdge = Math.max(width, height);
        if (maxEdge > 7680) {
          const factor = 7680 / maxEdge;
          width = Math.round(width * factor);
          height = Math.round(height * factor);
        }
        return createSlide(`s${slideCounter}`, `Page ${i + 1}`, {
          background: '#ffffff',
          backgroundImage: page.src,
          width,
          height,
        });
      });
      get().applyDoc('Import PDF', (draft) => {
        draft.slides.splice(index + 1, 0, ...slides);
      });
      useUiStore.getState().setActiveSlide(index + 1);
    },

    insertElement: (type, x, y) => {
      const doc = get().doc;
      const element = createElementOfType(type, doc, x, y);
      get().addElement(element);
      return element.id;
    },

    insertFigure: (kind) => {
      const doc = get().doc;
      const index = activeIndex();
      const slide = doc.slides[index];
      if (!slide) return;
      const count = slide.elements.length;
      const x = 180 + (count % 6) * 48;
      const y = 150 + (count % 5) * 44;
      const element = createFigure(nextElementId(doc), { x, y, width: 560, height: 380 }, { kind });
      get().applyDoc('Add figure', (draft) => {
        const target = draft.slides[index];
        if (target) target.elements.push(element);
      });
      useUiStore.getState().setSelection([element.id]);
      useUiStore.getState().setTool('select');
    },

    updateElement: (id, patch, opts = {}) => {
      get().applyDoc(
        'Update element',
        (draft) => {
          const el = findElement(draft, id);
          if (!el) return;

          if (el.type === 'pen') {
            // A size in the patch means a resize: scale the points onto the new
            // box, keeping the stroke thickness independent of the bounds.
            if (typeof patch.width === 'number' || typeof patch.height === 'number') {
              Object.assign(
                el,
                resizePen(el, {
                  x: typeof patch.x === 'number' ? patch.x : el.x,
                  y: typeof patch.y === 'number' ? patch.y : el.y,
                  width: typeof patch.width === 'number' ? patch.width : el.width,
                  height: typeof patch.height === 'number' ? patch.height : el.height,
                }),
              );
              const rest = { ...patch };
              delete rest.x;
              delete rest.y;
              delete rest.width;
              delete rest.height;
              Object.assign(el, rest);
              return;
            }

            if (typeof patch.x === 'number' || typeof patch.y === 'number') {
              const nextX = typeof patch.x === 'number' ? patch.x : el.x;
              const nextY = typeof patch.y === 'number' ? patch.y : el.y;
              const dx = nextX - el.x;
              const dy = nextY - el.y;
              el.points = el.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
              const normalized = normalizePen({ ...el, points: el.points });
              Object.assign(el, normalized);
              const rest = { ...patch };
              delete rest.x;
              delete rest.y;
              Object.assign(el, rest);
              return;
            }
          }

          if (el.type === 'connector' && 'width' in patch && typeof patch.width === 'number') {
            el.width = Math.max(0.5, patch.width);
            const rest = { ...patch };
            delete rest.width;
            Object.assign(el, rest);
            return;
          }

          Object.assign(el, patch);
        },
        opts,
      );
    },

    updateText: (id, patch, target = 'text') => {
      // Immediate commits from the properties panel arrive one field at a
      // time; coalesce consecutive edits of the same fields into one undo step.
      const coalesce = `${target}:${id}:${Object.keys(patch).sort().join(',')}`;
      get().applyDoc('Update text', (draft) => {
        const el = findElement(draft, id);
        if (!el) return;
        if (el.type === 'text') {
          const previousSize = el.text.fontSize;
          Object.assign(el.text, patch);
          // With "Shrink to fit" on, the renderer steps the font down until the
          // block fits the box, so raising the size would silently do nothing.
          // Grow the box instead so the requested size actually renders.
          if (
            el.text.autofit &&
            typeof patch.fontSize === 'number' &&
            patch.fontSize > previousSize
          ) {
            const measured = measureTextBlock(el.text, el.width);
            if (measured.height > el.height) el.height = measured.height;
          }
          return;
        }
        if (
          el.type === 'connector' ||
          el.type === 'pen' ||
          el.type === 'latex' ||
          el.type === 'code' ||
          el.type === 'image' ||
          el.type === 'html' ||
          el.type === 'figure'
        ) {
          return;
        }
        if (target === 'label') {
          const previousSize = el.text?.fontSize ?? 0;
          el.text = { ...(el.text ?? createTextBlock()), ...patch };
          if (
            el.text.autofit &&
            typeof patch.fontSize === 'number' &&
            patch.fontSize > previousSize
          ) {
            const pad = Math.min(24, Math.max(8, Math.min(el.width, el.height) * 0.12));
            const measured = measureTextBlock(el.text, Math.max(8, el.width - pad * 2));
            const needed = measured.height + pad * 2;
            if (needed > el.height) el.height = needed;
          }
        }
      }, { coalesce });
    },

    updateConnectorEndpoint: (id, which, anchor) => {
      get().applyDoc('Update connector', (draft) => {
        const el = findElement(draft, id);
        if (el?.type !== 'connector') return;
        if (which === 'from') el.from = anchor;
        else el.to = anchor;
      });
    },

    moveElements: (ids, dx, dy) => {
      get().applyDoc('Move', (draft) => {
        for (const id of ids) {
          const el = findElement(draft, id);
          if (!el || el.type === 'connector' || el.locked) continue;
          if (el.type === 'pen') {
            el.points = el.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
            Object.assign(el, normalizePen({ ...el, points: el.points }));
          } else {
            el.x += dx;
            el.y += dy;
          }
        }
      });
    },

    nudge: (ids, dx, dy) => {
      get().applyDoc(
        'Nudge',
        (draft) => {
          for (const id of ids) {
            const el = findElement(draft, id);
            if (!el || el.type === 'connector' || el.locked) continue;
            if (el.type === 'pen') {
              el.points = el.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
              Object.assign(el, normalizePen({ ...el, points: el.points }));
            } else {
              el.x += dx;
              el.y += dy;
            }
          }
        },
        { coalesce: 'nudge' },
      );
    },

    deleteElements: (ids) => {
      if (ids.length === 0) return;
      const victim = new Set(ids);
      get().applyDoc('Delete', (draft) => {
        for (const slide of draft.slides) {
          slide.elements = slide.elements.filter((el) => {
            if (el.type === 'connector') {
              if (victim.has(el.id)) return false;
              const fromDead = el.from.kind === 'element' && victim.has(el.from.elementId);
              const toDead = el.to.kind === 'element' && victim.has(el.to.elementId);
              // A connector with a missing endpoint is no longer attached to
              // the scene. Delete it with the removed element so undo restores
              // the complete relationship instead of leaving a broken line.
              return !fromDead && !toDead;
            }
            return !victim.has(el.id);
          });
          // Groups must survive member deletion: the remaining lowest id
          // becomes the lead and owns the surviving member list.
          repairGroups(slide);
        }
      });
      useUiStore.getState().clearSelection();
    },

    duplicateSelection: (ids) => {
      const doc = get().doc;
      const slide = activeSlide(doc);
      if (!slide) return;
      const source = slide.elements.filter((el) => ids.includes(el.id));
      if (source.length === 0) return;
      const { elements } = duplicateElements(source, doc);
      get().applyDoc('Duplicate', (draft) => {
        draft.slides[activeIndex()]?.elements.push(...elements);
      });
      useUiStore.getState().setSelection(elements.map((el) => el.id));
    },

    copySelection: (ids) => {
      const slide = activeSlide(get().doc);
      if (!slide) return;
      clipboard = structuredClone(slide.elements.filter((el) => ids.includes(el.id) && el.type !== 'connector'));
    },

    pasteClipboard: () => {
      if (clipboard.length === 0) return;
      const doc = get().doc;
      const { elements } = duplicateElements(clipboard, doc);
      if (elements.length === 0) return;
      get().applyDoc('Paste', (draft) => {
        draft.slides[activeIndex()]?.elements.push(...elements);
      });
      useUiStore.getState().setSelection(elements.map((el) => el.id));
    },

    reorder: (ids, mode) => {
      const selected = new Set(ids);
      get().applyDoc('Reorder', (draft) => {
        const slide = draft.slides[activeIndex()];
        if (!slide) return;
        if (mode === 'front' || mode === 'back') {
          const picked = slide.elements.filter((el) => selected.has(el.id));
          const rest = slide.elements.filter((el) => !selected.has(el.id));
          slide.elements = mode === 'front' ? [...rest, ...picked] : [...picked, ...rest];
          return;
        }
        const arr = slide.elements;
        if (mode === 'forward') {
          for (let i = arr.length - 2; i >= 0; i -= 1) {
            if (selected.has(arr[i].id) && !selected.has(arr[i + 1].id)) {
              [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
            }
          }
        } else {
          for (let i = 1; i < arr.length; i += 1) {
            if (selected.has(arr[i].id) && !selected.has(arr[i - 1].id)) {
              [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
            }
          }
        }
      });
    },

    align: (ids, mode) => {
      get().applyDoc('Align', (draft) => {
        const slide = draft.slides[activeIndex()];
        if (!slide) return;
        const items = slide.elements.filter((el) => ids.includes(el.id) && geometryOf(el));
        if (items.length < 2) return;
        const bounds = items.map((el) => ({ el, g: geometryOf(el)! }));
        const minX = Math.min(...bounds.map((b) => b.g.x));
        const maxX = Math.max(...bounds.map((b) => b.g.x + b.g.width));
        const minY = Math.min(...bounds.map((b) => b.g.y));
        const maxY = Math.max(...bounds.map((b) => b.g.y + b.g.height));
        for (const { el, g } of bounds) {
          if (el.type === 'connector') continue;
          if (mode === 'left') el.x = minX;
          if (mode === 'right') el.x = maxX - g.width;
          if (mode === 'center') el.x = (minX + maxX) / 2 - g.width / 2;
          if (mode === 'top') el.y = minY;
          if (mode === 'bottom') el.y = maxY - g.height;
          if (mode === 'middle') el.y = (minY + maxY) / 2 - g.height / 2;
        }
      });
    },

    distribute: (ids, axis) => {
      get().applyDoc('Distribute', (draft) => {
        const slide = draft.slides[activeIndex()];
        if (!slide) return;
        const items = slide.elements
          .filter((el) => ids.includes(el.id) && geometryOf(el))
          .sort((a, b) => {
            const ga = geometryOf(a)!;
            const gb = geometryOf(b)!;
            return axis === 'horizontal'
              ? ga.x + ga.width / 2 - (gb.x + gb.width / 2)
              : ga.y + ga.height / 2 - (gb.y + gb.height / 2);
          });
        if (items.length < 3) return;
        const first = geometryOf(items[0])!;
        const last = geometryOf(items[items.length - 1])!;
        if (axis === 'horizontal') {
          const start = first.x + first.width / 2;
          const end = last.x + last.width / 2;
          const step = (end - start) / (items.length - 1);
          items.forEach((el, i) => {
            if (el.type === 'connector' || i === 0 || i === items.length - 1) return;
            const g = geometryOf(el)!;
            el.x = start + step * i - g.width / 2;
          });
        } else {
          const start = first.y + first.height / 2;
          const end = last.y + last.height / 2;
          const step = (end - start) / (items.length - 1);
          items.forEach((el, i) => {
            if (el.type === 'connector' || i === 0 || i === items.length - 1) return;
            const g = geometryOf(el)!;
            el.y = start + step * i - g.height / 2;
          });
        }
      });
    },

    groupSelection: (ids) => {
      if (ids.length < 2) return;
      const doc = get().doc;
      const groupId = nextId(doc, 'g');
      get().applyDoc('Group', (draft) => {
        for (const slide of draft.slides) {
          let touched = false;
          for (const el of slide.elements) {
            if (ids.includes(el.id) && el.type !== 'connector') {
              el.group = groupId;
              touched = true;
            }
          }
          if (touched) repairGroups(slide);
        }
      });
    },

    ungroupSelection: (ids) => {
      get().applyDoc('Ungroup', (draft) => {
        for (const slide of draft.slides) {
          let touched = false;
          for (const el of slide.elements) {
            if (ids.includes(el.id) && el.type !== 'connector') {
              delete el.group;
              delete el.members;
              touched = true;
            }
          }
          if (touched) repairGroups(slide);
        }
      });
    },

    addAnimation: (id, effect = 'fadeIn') => {
      const doc = get().doc;
      const animation = newAnimationFor(doc, effect);
      get().applyDoc('Add animation', (draft) => {
        const el = findElement(draft, id);
        if (el) el.animations.push(animation);
      });
    },

    updateAnimation: (id, animationId, patch) => {
      get().applyDoc('Update animation', (draft) => {
        const el = findElement(draft, id);
        const animation = el?.animations.find((a) => a.id === animationId);
        if (animation) Object.assign(animation, patch);
      });
    },

    removeAnimation: (id, animationId) => {
      get().applyDoc('Remove animation', (draft) => {
        const el = findElement(draft, id);
        if (el) el.animations = el.animations.filter((a) => a.id !== animationId);
      });
    },
  };
});

/* ─── UI store ─── */

export interface ContextMenuState {
  elementId: string;
  x: number;
  y: number;
}

export interface EditingState {
  elementId: string;
  target: 'text' | 'label' | 'code';
}

export type PenTip = 'classic' | 'pencil' | 'marker' | 'highlighter';

/** Switching a tip also switches the tool and applies its preset. */
const PEN_TIP_PRESETS: Record<PenTip, { tool: Tool; opacity: number; minWidth?: number }> = {
  classic: { tool: 'pen', opacity: 1 },
  pencil: { tool: 'pen', opacity: 1 },
  marker: { tool: 'pen', opacity: 0.8, minWidth: 10 },
  highlighter: { tool: 'highlighter', opacity: 1 },
};

export type Theme = 'light' | 'dark';

/** Drag limits for the resizable side panels, in CSS pixels. */
export const PANEL_LIMITS = {
  left: { min: 260, max: 640, default: 320 },
  right: { min: 240, max: 640, default: 296 },
} as const;

export type PanelSide = keyof typeof PANEL_LIMITS;

const PANEL_WIDTHS_KEY = 'slidecraft-panel-widths';

/**
 * A panel can never grow so wide that the canvas (and the opposite panel)
 * lose their room, however narrow the window currently is.
 */
function clampPanelWidth(side: PanelSide, width: number, otherWidth: number): number {
  const { min, max, default: fallback } = PANEL_LIMITS[side];
  const requested = Number.isFinite(width) ? width : fallback;
  const viewport = typeof window === 'undefined' ? Infinity : window.innerWidth;
  const limit = Math.max(min, Math.min(max, viewport - otherWidth - 360));
  return Math.round(Math.max(min, Math.min(limit, requested)));
}

function loadPanelWidths(): { left: number; right: number } {
  const left = PANEL_LIMITS.left.default;
  const right = PANEL_LIMITS.right.default;
  if (typeof window === 'undefined') return { left, right };
  try {
    const raw = localStorage.getItem(PANEL_WIDTHS_KEY);
    if (!raw) return { left, right };
    const stored = JSON.parse(raw) as { left?: unknown; right?: unknown };
    return {
      left: clampPanelWidth('left', Number(stored.left), right),
      right: clampPanelWidth('right', Number(stored.right), left),
    };
  } catch {
    return { left, right };
  }
}

let panelWidthSaveTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced so dragging doesn't write localStorage on every pointer move. */
function persistPanelWidths(): void {
  if (typeof window === 'undefined') return;
  if (panelWidthSaveTimer) clearTimeout(panelWidthSaveTimer);
  panelWidthSaveTimer = setTimeout(() => {
    const { leftWidth, rightWidth } = useUiStore.getState();
    try {
      localStorage.setItem(PANEL_WIDTHS_KEY, JSON.stringify({ left: leftWidth, right: rightWidth }));
    } catch {
      // Storage unavailable or full: sizes simply won't persist.
    }
  }, 250);
}

const initialPanelWidths = loadPanelWidths();

interface UiState {
  activeSlideIndex: number;
  selectedIds: string[];
  tool: Tool;
  zoom: number;
  pan: { x: number; y: number };
  guides: { v: number[]; h: number[] };
  snapEnabled: boolean;
  gridEnabled: boolean;
  penColor: string;
  penWidth: number;
  highlighterColor: string;
  penTip: PenTip;
  penOpacity: number;
  editing: EditingState | null;
  presenting: boolean;
  presentFrom: number;
  /** True while the hidden PDF print layer is mounted and window.print() runs. */
  pdfPrinting: boolean;
  leftTab: 'code' | 'layers';
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  leftWidth: number;
  rightWidth: number;
  railCollapsed: boolean;
  contextMenu: ContextMenuState | null;
  showConsole: boolean;
  sourceCode: string;
  sourceOrigin: 'user' | 'gui';
  compilerErrors: Diagnostic[];
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  measurements: Record<string, { width: number; height: number }>;
  /** Registered by the inline text editor so canvas pointerdowns can commit it. */
  commitEditing: (() => void) | null;
  theme: Theme;

  setActiveSlide: (index: number) => void;
  setSelection: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  setTool: (tool: Tool) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  fit: () => void;
  setGuides: (guides: { v: number[]; h: number[] }) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setGridEnabled: (enabled: boolean) => void;
  setPenColor: (color: string) => void;
  setPenWidth: (width: number) => void;
  setHighlighterColor: (color: string) => void;
  setPenTip: (tip: PenTip) => void;
  setPenOpacity: (opacity: number) => void;
  setEditing: (editing: EditingState | null) => void;
  startPresenting: (index: number) => void;
  stopPresenting: () => void;
  startPdfExport: () => void;
  endPdfPrint: () => void;
  setLeftTab: (tab: 'code' | 'layers') => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setLeftWidth: (width: number) => void;
  setRightWidth: (width: number) => void;
  toggleRail: () => void;
  setContextMenu: (menu: ContextMenuState | null) => void;
  toggleConsole: () => void;
  setSourceCode: (code: string, origin?: 'user' | 'gui') => void;
  setCompilerErrors: (errors: Diagnostic[]) => void;
  setSaveStatus: (status: UiState['saveStatus']) => void;
  setMeasurement: (id: string, size: { width: number; height: number }) => void;
  setCommitEditing: (commit: (() => void) | null) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  syncFromDoc: (doc: Doc) => void;
  afterCodeApplied: (doc: Doc) => void;
}

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem('slidecraft-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

/** On phone-sized viewports the side panels start collapsed so the canvas is usable. */
const isNarrowScreen = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(max-width: 720px)').matches;

export const useUiStore = create<UiState>((set, get) => ({
  activeSlideIndex: 0,
  selectedIds: [],
  tool: 'select',
  zoom: 1,
  pan: { x: 0, y: 0 },
  guides: { v: [], h: [] },
  snapEnabled: true,
  gridEnabled: false,
  penColor: '#e03131',
  penWidth: 3,
  highlighterColor: '#ffd43b',
  penTip: 'classic',
  penOpacity: 1,
  editing: null,
  presenting: false,
  presentFrom: 0,
  pdfPrinting: false,
  leftTab: 'code',
  leftCollapsed: isNarrowScreen(),
  rightCollapsed: isNarrowScreen(),
  leftWidth: initialPanelWidths.left,
  rightWidth: initialPanelWidths.right,
  railCollapsed: false,
  contextMenu: null,
  showConsole: true,
  sourceCode: serializeDoc(useDocStore.getState().doc),
  sourceOrigin: 'gui',
  compilerErrors: [],
  saveStatus: 'idle',
  measurements: {},
  commitEditing: null,
  theme: getInitialTheme(),

  setActiveSlide: (index) => {
    const count = useDocStore.getState().doc.slides.length;
    set({
      activeSlideIndex: Math.max(0, Math.min(index, Math.max(0, count - 1))),
      selectedIds: [],
      editing: null,
    });
  },
  setSelection: (ids) => set({ selectedIds: [...new Set(ids)] }),
  toggleSelection: (id) => {
    const { selectedIds } = get();
    set({
      selectedIds: selectedIds.includes(id)
        ? selectedIds.filter((item) => item !== id)
        : [...selectedIds, id],
    });
  },
  clearSelection: () => set({ selectedIds: [], editing: null }),
  setTool: (tool) => set({ tool, editing: null }),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(4, zoom)) }),
  setPan: (pan) => set({ pan }),
  fit: () => set({ zoom: 1, pan: { x: 0, y: 0 } }),
  setGuides: (guides) => set({ guides }),
  setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
  setGridEnabled: (gridEnabled) => set({ gridEnabled }),
  setPenColor: (penColor) => set({ penColor }),
  setPenWidth: (penWidth) => set({ penWidth: Math.max(1, Math.min(40, penWidth)) }),
  setHighlighterColor: (highlighterColor) => set({ highlighterColor }),
  setPenTip: (tip) => set((state) => {
    const preset = PEN_TIP_PRESETS[tip];
    return {
      penTip: tip,
      tool: preset.tool,
      penOpacity: preset.opacity,
      penWidth: preset.minWidth ? Math.max(state.penWidth, preset.minWidth) : state.penWidth,
    };
  }),
  setPenOpacity: (penOpacity) => set({ penOpacity: Math.max(0.1, Math.min(1, penOpacity)) }),
  setEditing: (editing) => set({ editing }),
  startPresenting: (index) => set({ presenting: true, presentFrom: index }),
  stopPresenting: () => set({ presenting: false }),
  startPdfExport: () => set({ pdfPrinting: true }),
  endPdfPrint: () => set({ pdfPrinting: false }),
  setLeftTab: (leftTab) => set({ leftTab }),
  toggleLeftPanel: () => set((state) => ({ leftCollapsed: !state.leftCollapsed })),
  toggleRightPanel: () => set((state) => ({ rightCollapsed: !state.rightCollapsed })),
  setLeftWidth: (width) => {
    set((state) => ({ leftWidth: clampPanelWidth('left', width, state.rightWidth) }));
    persistPanelWidths();
  },
  setRightWidth: (width) => {
    set((state) => ({ rightWidth: clampPanelWidth('right', width, state.leftWidth) }));
    persistPanelWidths();
  },
  toggleRail: () => set((state) => ({ railCollapsed: !state.railCollapsed })),
  setContextMenu: (contextMenu) => set({ contextMenu }),
  toggleConsole: () => set((state) => ({ showConsole: !state.showConsole })),
  setSourceCode: (code, origin = 'user') => set({ sourceCode: code, sourceOrigin: origin }),
  setCompilerErrors: (compilerErrors) => set({ compilerErrors }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setMeasurement: (id, size) =>
    set((state) => ({ measurements: { ...state.measurements, [id]: size } })),
  setCommitEditing: (commitEditing) => set({ commitEditing }),
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('slidecraft-theme', theme);
    }
    set({ theme });
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    if (typeof window !== 'undefined') {
      localStorage.setItem('slidecraft-theme', next);
    }
    set({ theme: next });
  },

  syncFromDoc: (doc) => {
    const valid = collectIds(doc);
    const { selectedIds, activeSlideIndex, editing } = get();
    set({
      sourceCode: serializeDoc(doc),
      sourceOrigin: 'gui',
      compilerErrors: [],
      selectedIds: selectedIds.filter((id) => valid.has(id)),
      activeSlideIndex: Math.min(activeSlideIndex, Math.max(0, doc.slides.length - 1)),
      editing: editing && valid.has(editing.elementId) ? editing : null,
    });
  },

  afterCodeApplied: (doc) => {
    const valid = collectIds(doc);
    const { selectedIds, activeSlideIndex } = get();
    set({
      selectedIds: selectedIds.filter((id) => valid.has(id)),
      activeSlideIndex: Math.min(activeSlideIndex, Math.max(0, doc.slides.length - 1)),
      editing: null,
    });
  },
}));

/* ─── helpers for panels ─── */

export function selectedElements(): Element[] {
  const { doc } = useDocStore.getState();
  const index = useUiStore.getState().activeSlideIndex;
  const ids = new Set(useUiStore.getState().selectedIds);
  return (doc.slides[index]?.elements ?? []).filter((el) => ids.has(el.id));
}

export function activeSlideOf(doc: Doc): Slide | undefined {
  return doc.slides[useUiStore.getState().activeSlideIndex];
}

export function insertAtCenter(type: ElementType, x = 240, y = 200): string | null {
  return useDocStore.getState().insertElement(type, x, y);
}

export { activeSlide, geometryOf };
