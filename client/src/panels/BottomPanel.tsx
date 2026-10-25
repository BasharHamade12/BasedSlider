import { Check, ChevronDown, ChevronUp, CloudOff, LoaderCircle } from 'lucide-react';
import { useUiStore } from '../model/store';

export function BottomPanel() {
  const diagnostics = useUiStore((state) => state.compilerErrors);
  const showConsole = useUiStore((state) => state.showConsole);
  const toggleConsole = useUiStore((state) => state.toggleConsole);
  const errors = diagnostics.filter((item) => item.severity === 'error').length;
  const warnings = diagnostics.filter((item) => item.severity === 'warning').length;
  const saveStatus = useUiStore((state) => state.saveStatus);

  return (
    <footer className={`bottom-panel ${showConsole ? 'open' : 'collapsed'}`}>
      <div className="console-header">
        <button className="console-toggle" onClick={toggleConsole} type="button">
          {showConsole ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          <span className="console-title">Console</span>
        </button>
        <span className="console-counts">
          {errors > 0 && <span className="console-err-count">{errors} error(s)</span>}
          {warnings > 0 && <span className="console-warn-count">{warnings} warning(s)</span>}
          {errors === 0 && warnings === 0 && <span className="console-ok">✓ No errors</span>}
        </span>
        <span className="save-status" role="status" aria-live="polite" title="Decks are saved in this browser">
          {saveStatus === 'saving' ? (
            <><LoaderCircle size={12} className="save-status-spin" /> Saving…</>
          ) : saveStatus === 'saved' ? (
            <><Check size={12} /> Saved locally</>
          ) : saveStatus === 'error' ? (
            <><CloudOff size={12} /> Couldn't save</>
          ) : (
            'Local autosave'
          )}
        </span>
        <span className="console-source">script → document</span>
      </div>
      {showConsole && (
        <div className="console-output">
          {diagnostics.length === 0 && (
            <div className="console-line console-ok-line">
              The generated script parses cleanly and matches the deck.
            </div>
          )}
          {diagnostics.map((item, index) => (
            <div key={`${item.message}-${index}`} className={`console-line console-${item.severity}`}>
              <span className="console-severity">{item.severity === 'error' ? 'error' : 'warn'}</span>
              <span className="console-phase">[{item.phase}]</span>
              {typeof item.line === 'number' && (
                <span className="console-loc">
                  Line {item.line}:{item.column ?? 1}
                </span>
              )}
              {item.elementId && <span className="console-element">{item.elementId}</span>}
              <span className="console-msg">{item.message}</span>
            </div>
          ))}
        </div>
      )}
    </footer>
  );
}
