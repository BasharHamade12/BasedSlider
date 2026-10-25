import { useEffect, useRef } from 'react';
import { useDocStore, useUiStore } from '../model/store';

const DEBOUNCE_MS = 250;

/**
 * Code edits are applied on pause. Invalid code leaves the document untouched;
 * GUI edits regenerate the source in the store, so this effect ignores those.
 */
export function useCodeSync(): void {
  const sourceCode = useUiStore((state) => state.sourceCode);
  const origin = useUiStore((state) => state.sourceOrigin);
  const applyCode = useDocStore((state) => state.applyCode);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (origin !== 'user') return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      applyCode(sourceCode);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer.current);
  }, [sourceCode, origin, applyCode]);
}
