import { useRef, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useStore } from '../../store/useStore';

export function LeftPanel() {
  const sourceCode = useStore(s => s.sourceCode);
  const setSourceCode = useStore(s => s.setSourceCode);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const ignoreChangeRef = useRef(false);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
    setSourceCode(editor.getValue());

    editor.onDidChangeModelContent(() => {
      if (ignoreChangeRef.current) return;
      setSourceCode(editor.getValue());
    });
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const current = editor.getValue();
    if (current !== sourceCode) {
      ignoreChangeRef.current = true;
      editor.setValue(sourceCode);
      ignoreChangeRef.current = false;
    }
  }, [sourceCode]);

  return (
    <aside className="left-panel">
      <Editor
        height="100%"
        defaultLanguage="plaintext"
        theme="vs-dark"
        value={sourceCode}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />
    </aside>
  );
}
