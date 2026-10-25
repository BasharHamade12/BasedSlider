import { useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  ChevronsLeft,
  Code2,
  Eye,
  EyeOff,
  FileCode2,
  HelpCircle,
  Image as ImageIcon,
  Lock,
  PenTool,
  Sigma,
  Spline,
  Square,
  Type,
  Unlock,
} from 'lucide-react';
import { Element } from '../model/types';
import { useDocStore, useUiStore } from '../model/store';
import { isShape } from '../model/types';
import { CodeHelp } from './CodeHelp';

function elementIcon(element: Element) {
  if (element.type === 'text') return <Type size={13} />;
  if (element.type === 'latex') return <Sigma size={13} />;
  if (element.type === 'code') return <Code2 size={13} />;
  if (element.type === 'html') return <FileCode2 size={13} />;
  if (element.type === 'image') return <ImageIcon size={13} />;
  if (element.type === 'pen') return <PenTool size={13} />;
  if (element.type === 'connector') return <Spline size={13} />;
  if (isShape(element)) return <Square size={13} />;
  return <Square size={13} />;
}

function elementName(element: Element): string {
  if (element.name) return element.name;
  if (element.type === 'connector') {
    const from = element.from.kind === 'element' ? element.from.elementId : 'point';
    const to = element.to.kind === 'element' ? element.to.elementId : 'point';
    return `connector ${from} → ${to}`;
  }
  if (isShape(element) && element.text?.content) {
    const label = element.text.content.split('\n')[0];
    return label.length > 24 ? `${label.slice(0, 24)}…` : label;
  }
  return `${element.type} ${element.id}`;
}

export function LeftPanel() {
  const leftTab = useUiStore((state) => state.leftTab);
  const setLeftTab = useUiStore((state) => state.setLeftTab);
  const sourceCode = useUiStore((state) => state.sourceCode);
  const setSourceCode = useUiStore((state) => state.setSourceCode);
  const collapsed = useUiStore((state) => state.leftCollapsed);
  const toggleLeftPanel = useUiStore((state) => state.toggleLeftPanel);
  const theme = useUiStore((state) => state.theme);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpButtonRef = useRef<HTMLButtonElement>(null);

  const closeHelp = () => {
    setHelpOpen(false);
    helpButtonRef.current?.focus();
  };

  return (
    <>
    <aside className={`left-panel ${collapsed ? 'collapsed' : ''}`}>
      <div className="panel-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={leftTab === 'code'}
          className={leftTab === 'code' ? 'active' : ''}
          onClick={() => setLeftTab('code')}
        >
          Code
        </button>
        <button
          role="tab"
          aria-selected={leftTab === 'layers'}
          className={leftTab === 'layers' ? 'active' : ''}
          onClick={() => setLeftTab('layers')}
        >
          Layers
        </button>
        {leftTab === 'code' && (
          <button
            ref={helpButtonRef}
            className="panel-tab-help"
            onClick={() => setHelpOpen(true)}
            title="Script reference — every element, property and value"
            aria-label="Open script reference"
            aria-haspopup="dialog"
            aria-expanded={helpOpen}
          >
            <HelpCircle size={14} />
          </button>
        )}
        <button
          className="panel-collapse"
          onClick={toggleLeftPanel}
          title="Minimize code panel"
          aria-label="Minimize code panel"
        >
          <ChevronsLeft size={14} />
        </button>
      </div>

      {leftTab === 'code' ? (
        <div className="code-wrap">
          <div className="code-editor">
            <Editor
              height="100%"
              defaultLanguage="plaintext"
              theme={theme === 'dark' ? 'vs-dark' : 'vs'}
              value={sourceCode}
              onChange={(value) => setSourceCode(value ?? '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                wordWrap: 'off',
                renderWhitespace: 'selection',
              }}
            />
          </div>
          <p className="code-hint">
            Code edits apply when you pause — invalid ones keep the current deck.
            <button className="code-hint-link" onClick={() => setHelpOpen(true)} type="button">
              ? Full reference
            </button>
          </p>
        </div>
      ) : (
        <LayersPanel />
      )}
    </aside>
    {helpOpen && <CodeHelp onClose={closeHelp} />}
    </>
  );
}

function LayersPanel() {
  const doc = useDocStore((state) => state.doc);
  const updateElement = useDocStore((state) => state.updateElement);
  const selectedIds = useUiStore((state) => state.selectedIds);
  const setSelection = useUiStore((state) => state.setSelection);
  const activeSlideIndex = useUiStore((state) => state.activeSlideIndex);
  const slide = doc.slides[activeSlideIndex];
  const elements = [...(slide?.elements ?? [])].reverse();

  if (elements.length === 0) {
    return <p className="layers-empty">No elements on this slide yet.</p>;
  }

  return (
    <ul className="layers-list">
      {elements.map((element) => (
        <li
          key={element.id}
          className={`layer-row ${selectedIds.includes(element.id) ? 'active' : ''}`}
          onClick={() => setSelection([element.id])}
        >
          <span className="layer-icon">{elementIcon(element)}</span>
          <span className="layer-name">{elementName(element)}</span>
          <button
            className="layer-btn"
            title={element.locked ? 'Unlock' : 'Lock'}
            onClick={(event) => {
              event.stopPropagation();
              updateElement(element.id, { locked: !element.locked });
            }}
          >
            {element.locked ? <Lock size={12} /> : <Unlock size={12} />}
          </button>
          <button
            className="layer-btn"
            title={element.hidden ? 'Show' : 'Hide'}
            onClick={(event) => {
              event.stopPropagation();
              updateElement(element.id, { hidden: !element.hidden });
            }}
          >
            {element.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        </li>
      ))}
    </ul>
  );
}
