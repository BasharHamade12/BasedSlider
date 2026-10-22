import { create } from 'zustand';
import {
  Slide,
  ElementId,
  CompilerError,
  ActiveStroke,
  Point,
} from './presentation.types';

interface EditorSlice {
  sourceCode: string;
  setSourceCode: (code: string) => void;
}

interface CompilerSlice {
  compilerErrors: CompilerError[];
  setCompilerErrors: (errors: CompilerError[]) => void;
  isDragging: boolean;
  setDragging: (v: boolean) => void;
}

interface PresentationSlice {
  slides: Slide[];
  activeSlideIndex: number;
  selectedElementId: ElementId | null;
  setSlides: (slides: Slide[]) => void;
  setActiveSlide: (index: number) => void;
  selectElement: (id: ElementId | null) => void;
  updateElementPosition: (id: ElementId, x: number, y: number) => void;
  updateElementProperty: (id: ElementId, key: string, value: unknown) => void;
}

interface DrawSlice {
  isDrawMode: boolean;
  toggleDrawMode: () => void;
  penColor: string;
  setPenColor: (color: string) => void;
  penWidth: number;
  setPenWidth: (width: number) => void;
  activeStroke: ActiveStroke | null;
  startStroke: (point: Point) => void;
  addPointToStroke: (point: Point) => void;
  clearStroke: () => void;
}

export type AppStore = EditorSlice & CompilerSlice & PresentationSlice & DrawSlice;

export const useStore = create<AppStore>((set, get) => ({
  sourceCode: `slide "0" {\n    background: "#201e1eff";\n\n    rect {\n        x: 100; y: 100;\n        width: 400; height: 200;\n        fill: "#ff0000";\n    }\n\n    text {\n        x: 100; y: 400;\n        content: "Hello, Basedslider!";\n        color: "#ffffff";\n        fontSize: 48;\n    }\n}\n`,
  setSourceCode: (sourceCode) => set({ sourceCode }),

  compilerErrors: [],
  setCompilerErrors: (compilerErrors) => set({ compilerErrors }),
  isDragging: false,
  setDragging: (isDragging) => set({ isDragging }),

  slides: [],
  activeSlideIndex: 0,
  selectedElementId: null,
  setSlides: (slides) =>
    set((s) => {
      let sel: string | null = null;
      for (const slide of slides) {
        for (const el of slide.elements) {
          if (el.selected) { sel = el.id; break; }
        }
        if (sel) break;
      }
      return {
        slides,
        selectedElementId: sel,
        activeSlideIndex: Math.min(s.activeSlideIndex, Math.max(0, slides.length - 1)),
      };
    }),
  setActiveSlide: (activeSlideIndex) => set({ activeSlideIndex }),
  selectElement: (selectedElementId) =>
    set((s) => ({
      selectedElementId,
      slides: s.slides.map((slide) => ({
        ...slide,
        elements: slide.elements.map((el) => ({
          ...el,
          selected: el.id === selectedElementId ? true : undefined,
        })),
      })),
    })),
  updateElementPosition: (id, x, y) =>
    set((s) => ({
      slides: s.slides.map((slide) => ({
        ...slide,
        elements: slide.elements.map((el) => {
          if (el.id !== id) return el;
          if (el.type === 'pen') {
            const dx = x - (el.x != null ? el.x : x);
            const dy = y - (el.y != null ? el.y : y);
            return {
              ...el,
              x,
              y,
              points: el.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy })),
            };
          }
          return { ...el, x, y };
        }),
      })),
    })),
  updateElementProperty: (id, key, value) =>
    set((s) => ({
      slides: s.slides.map((slide) => ({
        ...slide,
        elements: slide.elements.map((el) =>
          el.id === id ? { ...el, [key]: value } : el,
        ),
      })),
    })),

  isDrawMode: false,
  toggleDrawMode: () => set((s) => ({ isDrawMode: !s.isDrawMode })),
  penColor: '#000000',
  setPenColor: (penColor) => set({ penColor }),
  penWidth: 3,
  setPenWidth: (penWidth) => set({ penWidth }),
  activeStroke: null,
  startStroke: (point) =>
    set({
      activeStroke: {
        color: get().penColor,
        width: get().penWidth,
        points: [point],
      },
    }),
  addPointToStroke: (point) =>
    set((s) => {
      if (!s.activeStroke) return s;
      return {
        activeStroke: {
          ...s.activeStroke,
          points: [...s.activeStroke.points, point],
        },
      };
    }),
  clearStroke: () => set({ activeStroke: null }),
}));
