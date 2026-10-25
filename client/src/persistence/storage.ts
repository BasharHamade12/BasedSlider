import { useEffect } from 'react';
import { DOC_VERSION, Doc } from '../model/types';
import { hasErrors, normalizeDoc, validateDoc } from '../model/validate';
import { useDocStore, useUiStore } from '../model/store';
import { createDemoDeck } from '../samples/demoDeck';

const KEY = 'basedslider:doc:v2';

export function loadDeck(): Doc | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Doc;
    if (!parsed || parsed.version !== DOC_VERSION) return null;
    if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) return null;
    const normalized = normalizeDoc(parsed);
    if (hasErrors(validateDoc(normalized.doc))) return null;
    return normalized.doc;
  } catch {
    return null;
  }
}

export function saveDeck(doc: Doc): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(KEY, JSON.stringify(doc));
    return true;
  } catch {
    // Storage can be unavailable (private mode, quota).
    return false;
  }
}

export function clearDeck(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
}

export function loadInitialDeck(): Doc {
  return loadDeck() ?? createDemoDeck();
}

export function useAutosave(): void {
  const doc = useDocStore((state) => state.doc);
  useEffect(() => {
    useUiStore.getState().setSaveStatus('saving');
    const handle = window.setTimeout(() => {
      useUiStore.getState().setSaveStatus(saveDeck(doc) ? 'saved' : 'error');
    }, 600);
    return () => window.clearTimeout(handle);
  }, [doc]);
}
