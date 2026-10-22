import { useStore } from '../../store/useStore';

export function BottomPanel() {
  const compilerErrors = useStore(s => s.compilerErrors);

  return (
    <footer className="bottom-panel">
      <div className="console-header">
        <span className="console-title">Console</span>
        {compilerErrors.length > 0 && (
          <span className="console-err-count">{compilerErrors.length} error(s)</span>
        )}
      </div>
      <div className="console-output">
        {compilerErrors.length === 0 && (
          <span className="console-ok">✓ No errors</span>
        )}
        {compilerErrors.map((err, i) => (
          <div key={i} className={`console-line console-${err.severity}`}>
            <span className="console-phase">[{err.phase}]</span>
            <span className="console-loc">Line {err.line}:{err.column}</span>
            <span className="console-msg">{err.message}</span>
          </div>
        ))}
      </div>
    </footer>
  );
}
