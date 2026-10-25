import { RefObject, useEffect, useRef, useState } from 'react';
import { useDocStore, useUiStore } from '../model/store';
import { isShape } from '../model/types';

interface InlineTextEditorProps {
  containerRef: RefObject<HTMLDivElement | null>;
  svgRef: RefObject<SVGSVGElement | null>;
  scale: number;
}

/** True when the text colour is light enough to need a dark editor backdrop. */
function needsDarkBackdrop(color: string): boolean {
  const hex = color.trim().replace('#', '');
  const full = hex.length === 3 || hex.length === 4
    ? hex.slice(0, 3).split('').map((part) => part + part).join('')
    : hex.slice(0, 6);
  if (full.length !== 6 || !/^[0-9a-f]{6}$/i.test(full)) return false;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55;
}

export function InlineTextEditor({ containerRef, svgRef, scale }: InlineTextEditorProps) {
  const editing = useUiStore((state) => state.editing);
  const doc = useDocStore((state) => state.doc);
  const slideIndex = useUiStore((state) => state.activeSlideIndex);
  const setEditing = useUiStore((state) => state.setEditing);
  const updateText = useDocStore((state) => state.updateText);
  const updateElement = useDocStore((state) => state.updateElement);
  const [value, setValue] = useState('');
  const doneRef = useRef(false);
  const valueRef = useRef(value);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const slide = doc.slides[slideIndex];
  const element = slide?.elements.find((candidate) => candidate.id === editing?.elementId);
  const isCode = editing?.target === 'code' && element?.type === 'code';
  const block = !isCode
    ? element?.type === 'text'
      ? element.text
      : element && isShape(element)
        ? element.text
        : null
    : null;
  const source = isCode ? element.content : (block?.content ?? '');

  useEffect(() => {
    if (!editing) return;
    doneRef.current = false;
    const initialValue = source;
    valueRef.current = initialValue;
    setValue(initialValue);
    const handle = window.setTimeout(() => {
      editorRef.current?.focus();
      editorRef.current?.select();
    }, 0);
    return () => window.clearTimeout(handle);
    // Only reset when switching targets, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.elementId, editing?.target]);

  // Keep the commit logic in a ref so the registered callback (below) never
  // goes stale between renders; it is invoked from handlers that run outside
  // React's render flow.
  const commitStateRef = useRef({ editing, element, isCode, updateText, updateElement, setEditing });
  commitStateRef.current = { editing, element, isCode, updateText, updateElement, setEditing };

  const commit = useRef(() => {
    const { editing: active, element: target, isCode: code, updateText: saveText, updateElement: save, setEditing: close } =
      commitStateRef.current;
    if (doneRef.current || !active || !target) return;
    if (code) {
      save(target.id, { content: valueRef.current });
    } else {
      const text =
        target.type === 'text'
          ? target.text
          : 'text' in target
            ? target.text
            : null;
      if (!text) return;
      saveText(target.id, { content: valueRef.current }, active.target === 'text' ? 'text' : 'label');
    }
    close(null);
  }).current;

  const cancel = () => {
    doneRef.current = true;
    setEditing(null);
  };

  // Canvas pointerdowns call preventDefault for drag handling, which suppresses
  // the native blur; expose the commit so useInteraction can flush pending text.
  useEffect(() => {
    useUiStore.getState().setCommitEditing(commit);
    return () => useUiStore.getState().setCommitEditing(null);
  }, [commit]);

  if (!editing || !element || (!isCode && !block) || !svgRef.current || !containerRef.current) {
    return null;
  }

  const svgRect = svgRef.current.getBoundingClientRect();
  const containerRect = containerRef.current.getBoundingClientRect();
  const isText = element.type === 'text';
  const x = element.type === 'connector' ? 0 : element.x;
  const y = element.type === 'connector' ? 0 : element.y;
  const width = element.type === 'connector' ? 240 : element.width;
  const height = element.type === 'connector' ? 60 : element.height;
  const pad = isCode ? 14 : isText ? 0 : 8;

  const codeStyle = isCode && element.type === 'code'
    ? {
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: Math.max(10, element.fontSize * scale),
        color: element.color,
        background: element.background,
      }
    : null;
  const blockStyle = block
    ? {
        fontFamily: block.fontFamily,
        fontSize: Math.max(10, block.fontSize * scale),
        color: block.color,
        background: needsDarkBackdrop(block.color)
          ? 'rgba(17,18,22,0.92)'
          : 'rgba(255,255,255,0.94)',
      }
    : null;

  return (
    <textarea
      ref={editorRef}
      className="inline-text-editor"
      value={value}
      onChange={(event) => {
        valueRef.current = event.target.value;
        setValue(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          cancel();
        }
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          commit();
        }
      }}
      spellCheck={false}
      style={{
        position: 'absolute',
        left: svgRect.left - containerRect.left + (x + pad) * scale,
        top: svgRect.top - containerRect.top + (y + pad) * scale,
        width: Math.max(80, (width - pad * 2) * scale),
        height: Math.max(36, (height - pad * 2) * scale),
        lineHeight: 1.5,
        fontWeight: codeStyle ? 400 : (block?.fontWeight ?? 400),
        fontStyle: !codeStyle && block?.italic ? 'italic' : 'normal',
        textAlign: codeStyle ? 'left' : (block?.align ?? 'left'),
        letterSpacing: !codeStyle && block ? block.letterSpacing * scale : 0,
        caretColor: '#0a7',
        border: '2px solid #0a7',
        borderRadius: 4,
        padding: 2,
        margin: 0,
        resize: 'none',
        overflow: 'hidden',
        outline: 'none',
        zIndex: 20,
        whiteSpace: codeStyle ? 'pre' : undefined,
        ...(codeStyle ?? blockStyle ?? {}),
      }}
    />
  );
}
