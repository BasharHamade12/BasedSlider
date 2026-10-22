import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { SlideElement } from '../../store/presentation.types';
import { serialize } from '../../utils/serialize';
import { Square, Type, Sigma, Pen, PaintBucket, Move, Ruler, Bold, Italic, LetterText, Code } from 'lucide-react';

interface ContextMenuProps {
  element: SlideElement;
  x: number;
  y: number;
  onClose: () => void;
}

export function ContextMenu({ element, x, y, onClose }: ContextMenuProps) {
  const updateElementProperty = useStore(s => s.updateElementProperty);
  const setSourceCode = useStore(s => s.setSourceCode);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keydown);
    };
  }, [onClose]);

  const commit = useCallback((key: string, value: unknown) => {
    updateElementProperty(element.id, key, value);
    const slides = useStore.getState().slides;
    setSourceCode(serialize(slides));
  }, [element.id, updateElementProperty, setSourceCode]);

  const typeIcon = () => {
    switch (element.type) {
      case 'rect':  return <Square size={14} />;
      case 'text':  return <Type size={14} />;
      case 'latex': return <Sigma size={14} />;
      case 'pen':   return <Pen size={14} />;
      case 'code':  return <Code size={14} />;
    }
  };

  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 320),
    top: Math.min(y, window.innerHeight - 400),
    zIndex: 1000,
    background: '#2c2e33',
    border: '1px solid #444',
    borderRadius: 10,
    padding: 14,
    minWidth: 280,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 13,
    color: '#c1c2c5',
  };

  return (
    <div ref={menuRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #444' }}>
        {typeIcon()}
        <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 }}>{element.type}</span>
        <span style={{ color: '#666', fontSize: 11, fontFamily: 'monospace' }}>{element.id}</span>
      </div>

      <Section icon={<Move size={13} />} title="Position">
        <Row label="X" value={element.x} onChange={v => commit('x', Number(v))} />
        <Row label="Y" value={element.y} onChange={v => commit('y', Number(v))} />
      </Section>

      {'width' in element && element.type !== 'pen' && (
        <Section icon={<Ruler size={13} />} title="Size">
          {'width' in element && <Row label="W" value={(element as any).width} onChange={v => commit('width', Number(v))} />}
          {'height' in element && <Row label="H" value={(element as any).height} onChange={v => commit('height', Number(v))} />}
        </Section>
      )}

      {element.type === 'rect' && (
        <Section icon={<PaintBucket size={13} />} title="Appearance">
          <Row label="Fill" value={element.fill} onChange={v => commit('fill', v)} color />
          <Row label="Stroke" value={element.stroke ?? ''} onChange={v => commit('stroke', v || undefined)} color />
          <Row label="StrokeW" value={element.strokeWidth ?? 0} onChange={v => commit('strokeWidth', Number(v) || undefined)} />
          <Row label="Rx" value={element.rx ?? 0} onChange={v => commit('rx', Number(v) || undefined)} />
        </Section>
      )}

      {element.type === 'text' && (
        <Section icon={<LetterText size={13} />} title="Text">
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Content (Enter = new line, or \n in code)</div>
            <textarea
              value={element.content}
              onChange={e => commit('content', e.target.value)}
              rows={4}
              style={inputStyle('textarea')}
            />
          </div>
          <Row label="Size" value={element.fontSize ?? 32} onChange={v => commit('fontSize', Number(v))} />
          <Row label="Color" value={element.color ?? '#000000'} onChange={v => commit('color', v)} color />
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <ToggleBtn
              icon={<Bold size={13} />}
              active={!!element.bold}
              onClick={() => commit('bold', !element.bold)}
            />
            <ToggleBtn
              icon={<Italic size={13} />}
              active={!!element.italic}
              onClick={() => commit('italic', !element.italic)}
            />
          </div>
        </Section>
      )}

      {element.type === 'latex' && (
        <Section icon={<Sigma size={13} />} title="LaTeX">
          <textarea
            value={element.content}
            onChange={e => commit('content', e.target.value)}
            rows={3}
            style={inputStyle('textarea')}
          />
        </Section>
      )}

      {element.type === 'pen' && (
        <Section icon={<Pen size={13} />} title="Stroke">
          <Row label="Color" value={element.color} onChange={v => commit('color', v)} color />
          <Row label="Width" value={element.width} onChange={v => commit('width', Number(v))} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 11, color: '#888' }}>Smooth</span>
            <input
              type="checkbox"
              checked={element.smoothing}
              onChange={e => commit('smoothing', e.target.checked)}
              style={{ accentColor: '#4c9aff' }}
            />
          </div>
        </Section>
      )}

      {element.type === 'code' && (
        <Section icon={<Code size={13} />} title="Code block">
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Content (Enter = new line)</div>
            <textarea
              value={element.content}
              onChange={e => commit('content', e.target.value)}
              rows={6}
              spellCheck={false}
              style={{ ...inputStyle('textarea'), whiteSpace: 'pre' }}
            />
          </div>
          <Row label="Lang" value={element.language ?? ''} onChange={v => commit('language', v || undefined)} />
          <Row label="Size" value={element.fontSize ?? 16} onChange={v => commit('fontSize', Number(v) || undefined)} />
          <Row label="Color" value={element.color ?? '#e6e6e6'} onChange={v => commit('color', v)} color />
          <Row label="Bg" value={element.background ?? '#1e1e1e'} onChange={v => commit('background', v)} color />
        </Section>
      )}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: '#999', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, onChange, color: isColor }: { label: string; value: string | number; onChange: (v: string) => void; color?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <span style={{ width: 48, fontSize: 11, color: '#888', flexShrink: 0 }}>{label}</span>
      {isColor ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
          <input
            type="color"
            value={String(value)}
            onChange={e => onChange(e.target.value)}
            style={{ width: 28, height: 22, padding: 0, border: 'none', borderRadius: 3, cursor: 'pointer', background: 'none' }}
          />
          <input
            type="text"
            value={String(value)}
            onChange={e => onChange(e.target.value)}
            style={inputStyle()}
          />
        </div>
      ) : (
        <input
          type="text"
          value={String(value)}
          onChange={e => onChange(e.target.value)}
          style={inputStyle()}
        />
      )}
    </div>
  );
}

function ToggleBtn({ icon, active, onClick }: { icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 26,
        border: active ? '1px solid #4c9aff' : '1px solid #555',
        borderRadius: 5,
        background: active ? '#4c9aff22' : '#3c3c3c',
        color: active ? '#4c9aff' : '#999',
        cursor: 'pointer',
      }}
    >
      {icon}
    </button>
  );
}

function inputStyle(type?: 'textarea'): React.CSSProperties {
  if (type === 'textarea') {
    return {
      width: '100%',
      padding: '4px 8px',
      fontSize: 12,
      background: '#1e1f22',
      border: '1px solid #444',
      borderRadius: 5,
      color: '#c1c2c5',
      fontFamily: 'monospace',
      resize: 'vertical',
      outline: 'none',
    };
  }
  return {
    flex: 1,
    padding: '3px 8px',
    fontSize: 12,
    background: '#1e1f22',
    border: '1px solid #444',
    borderRadius: 5,
    color: '#c1c2c5',
    fontFamily: 'monospace',
    outline: 'none',
  };
}
