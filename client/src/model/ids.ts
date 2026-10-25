import { Doc, Element, Slide } from './types';

export type IdPrefix = 's' | 'e' | 'c' | 'g' | 'a';

const PREFIX_RE = /^([a-z]+)(\d+)$/;

function bump(map: Map<string, number>, id: string): void {
  const match = PREFIX_RE.exec(id);
  if (!match) return;
  const prefix = match[1];
  const value = Number(match[2]);
  if (!Number.isFinite(value)) return;
  map.set(prefix, Math.max(map.get(prefix) ?? 0, value));
}

function countersForDoc(doc: Doc): Map<string, number> {
  const counters = new Map<string, number>();
  bump(counters, 's0');
  bump(counters, 'e0');
  bump(counters, 'c0');
  bump(counters, 'g0');
  bump(counters, 'a0');

  for (const slide of doc.slides) {
    bump(counters, slide.id);
    for (const element of slide.elements) {
      bump(counters, element.id);
      if (element.group) bump(counters, element.group);
      for (const animation of element.animations) bump(counters, animation.id);
    }
  }
  return counters;
}

/** Highest numeric suffix already used with this prefix, across the whole document. */
export function maxId(doc: Doc, prefix: IdPrefix): number {
  return countersForDoc(doc).get(prefix) ?? 0;
}

/** Deterministic next id: never random, never time-based. */
export function nextId(doc: Doc, prefix: IdPrefix): string {
  return `${prefix}${maxId(doc, prefix) + 1}`;
}

/** Fresh ids for a list of elements, preserving nothing. */
export function nextElementId(doc: Doc): string {
  return nextId(doc, 'e');
}

export function nextAnimationId(doc: Doc): string {
  return nextId(doc, 'a');
}

export function nextConnectorId(doc: Doc): string {
  return nextId(doc, 'c');
}

export function nextSlideId(doc: Doc): string {
  return nextId(doc, 's');
}

/** Collect every element id and group id in the document. */
export function collectIds(doc: Doc): Set<string> {
  const ids = new Set<string>();
  for (const slide of doc.slides) {
    ids.add(slide.id);
    for (const element of slide.elements) {
      ids.add(element.id);
      if (element.group) ids.add(element.group);
    }
  }
  return ids;
}

export function findSlideOfElement(doc: Doc, elementId: string): Slide | undefined {
  return doc.slides.find((slide) => slide.elements.some((el) => el.id === elementId));
}

export function findElement(doc: Doc, elementId: string): Element | undefined {
  for (const slide of doc.slides) {
    const found = slide.elements.find((el) => el.id === elementId);
    if (found) return found;
  }
  return undefined;
}

export function findElementInSlide(slide: Slide, elementId: string): Element | undefined {
  return slide.elements.find((el) => el.id === elementId);
}
