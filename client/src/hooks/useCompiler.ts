import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { compile } from '../compiler';

export function useCompiler() {
  const sourceCode = useStore(s => s.sourceCode);
  const isDragging = useStore(s => s.isDragging);
  const setSlides = useStore(s => s.setSlides);
  const setCompilerErrors = useStore(s => s.setCompilerErrors);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const firstRender = useRef(true);

  useEffect(() => {
    if (isDragging) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const run = () => {
      const result = compile(sourceCode);
      setSlides(result.slides);
      setCompilerErrors(result.errors);
    };

    if (firstRender.current) {
      firstRender.current = false;
      run();
    } else {
      debounceRef.current = setTimeout(run, 200);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [sourceCode, isDragging, setSlides, setCompilerErrors]);
}
