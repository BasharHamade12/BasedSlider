import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronsRight,
  Circle,
  Code2,
  Copy,
  MessageCircle,
  Download,
  FileCode2,
  FileUp,
  Highlighter,
  Image as ImageIcon,
  Minus,
  Moon,
  MousePointer2,
  Pen,
  Play,
  Plus,
  Pi,
  Printer,
  Redo2,
  Sigma,
  Spline,
  Square,
  Star,
  Sun,
  Trash2,
  Triangle,
  Type,
  Undo2,
  Upload,
} from 'lucide-react';
import { ElementType, FigureKind, ShapeKind } from '../model/types';
import { serializeDoc } from '../model/serialize';
import { useDocStore, useUiStore } from '../model/store';
import type { PenTip } from '../model/store';
import { ColorField, SliderField } from './controls';
import { readImageFile } from '../canvas/imageFile';
import { importPdfFile } from '../canvas/importPdf';

const FIGURE_ITEMS: { kind: FigureKind; label: string }[] = [
  { kind: 'axes', label: 'Orthonormal system' },
  { kind: 'graph', label: 'Graph' },
  { kind: 'barchart', label: 'Bar chart' },
  { kind: 'plane', label: 'Plane' },
];

const SHAPE_ITEMS: { kind: ShapeKind; label: string; icon: React.ReactNode }[] = [
  { kind: 'rect', label: 'Rectangle', icon: <Square size={16} /> },
  { kind: 'ellipse', label: 'Ellipse', icon: <Circle size={16} /> },
  { kind: 'triangle', label: 'Triangle', icon: <Triangle size={16} /> },
  { kind: 'line', label: 'Line', icon: <Minus size={16} /> },
  { kind: 'polygon', label: 'Polygon', icon: <Square size={16} transform="rotate(45 12 12)" /> },
  { kind: 'star', label: 'Star', icon: <Star size={16} /> },
  { kind: 'arrow', label: 'Arrow', icon: <ArrowRight size={16} /> },
  { kind: 'chevron', label: 'Chevron', icon: <ChevronsRight size={16} /> },
  { kind: 'parallelogram', label: 'Parallelogram', icon: <svg width={16} height={16} viewBox="0 0 24 24"><path d="M7 6h14l-4 12H3Z" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" /></svg> },
  { kind: 'trapezoid', label: 'Trapezoid', icon: <svg width={16} height={16} viewBox="0 0 24 24"><path d="M6 6h12l4 12H2Z" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" /></svg> },
  { kind: 'speech', label: 'Speech bubble', icon: <MessageCircle size={16} /> },
];

const PEN_TIPS: { id: PenTip; label: string }[] = [
  { id: 'classic', label: 'Classic pen' },
  { id: 'pencil', label: 'Pencil' },
  { id: 'marker', label: 'Wide marker' },
  { id: 'highlighter', label: 'Highlighter' },
];

export function TopToolbar() {
  const doc = useDocStore((state) => state.doc);
  const pastLength = useDocStore((state) => state.past.length);
  const futureLength = useDocStore((state) => state.future.length);
  const undo = useDocStore((state) => state.undo);
  const redo = useDocStore((state) => state.redo);
  const insertElement = useDocStore((state) => state.insertElement);
  const insertFigure = useDocStore((state) => state.insertFigure);
  const addSlide = useDocStore((state) => state.addSlide);
  const duplicateSlide = useDocStore((state) => state.duplicateSlide);
  const deleteSlide = useDocStore((state) => state.deleteSlide);
  const applyCode = useDocStore((state) => state.applyCode);
  const addImage = useDocStore((state) => state.addImage);

  const activeSlideIndex = useUiStore((state) => state.activeSlideIndex);
  const tool = useUiStore((state) => state.tool);
  const setTool = useUiStore((state) => state.setTool);
  const penTip = useUiStore((state) => state.penTip);
  const setPenTip = useUiStore((state) => state.setPenTip);
  const penColor = useUiStore((state) => state.penColor);
  const setPenColor = useUiStore((state) => state.setPenColor);
  const penWidth = useUiStore((state) => state.penWidth);
  const setPenWidth = useUiStore((state) => state.setPenWidth);
  const penOpacity = useUiStore((state) => state.penOpacity);
  const setPenOpacity = useUiStore((state) => state.setPenOpacity);
  const highlighterColor = useUiStore((state) => state.highlighterColor);
  const setHighlighterColor = useUiStore((state) => state.setHighlighterColor);
  const setEditing = useUiStore((state) => state.setEditing);
  const setSourceCode = useUiStore((state) => state.setSourceCode);
  const startPresenting = useUiStore((state) => state.startPresenting);
  const startPdfExport = useUiStore((state) => state.startPdfExport);
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);

  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const [mathMenuOpen, setMathMenuOpen] = useState(false);
  const [penMenuOpen, setPenMenuOpen] = useState(false);
  const [htmlMenuOpen, setHtmlMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const shapeMenuRef = useRef<HTMLDivElement>(null);
  const mathMenuRef = useRef<HTMLDivElement>(null);
  const penMenuRef = useRef<HTMLDivElement>(null);
  const htmlMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const htmlFileRef = useRef<HTMLInputElement>(null);
  const slide = doc.slides[activeSlideIndex];

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (shapeMenuRef.current && !shapeMenuRef.current.contains(event.target as Node)) {
        setShapeMenuOpen(false);
      }
      if (mathMenuRef.current && !mathMenuRef.current.contains(event.target as Node)) {
        setMathMenuOpen(false);
      }
      if (penMenuRef.current && !penMenuRef.current.contains(event.target as Node)) {
        setPenMenuOpen(false);
      }
      if (htmlMenuRef.current && !htmlMenuRef.current.contains(event.target as Node)) {
        setHtmlMenuOpen(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShapeMenuOpen(false);
        setMathMenuOpen(false);
        setPenMenuOpen(false);
        setHtmlMenuOpen(false);
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // Transient import/export feedback: dismisses itself so it never lingers.
  useEffect(() => {
    if (!feedback) return;
    const handle = window.setTimeout(() => setFeedback(null), 4500);
    return () => window.clearTimeout(handle);
  }, [feedback]);

  const insert = (type: ElementType): string | null => {
    const count = slide?.elements.length ?? 0;
    const x = 180 + (count % 6) * 48;
    const y = 150 + (count % 5) * 44;
    const id = insertElement(type, x, y);      setShapeMenuOpen(false);
    if (type === 'text' && id) {
      setEditing({ elementId: id, target: 'text' });
    }
    return id;
  };

  const showFeedback = (kind: 'ok' | 'error', text: string) => setFeedback({ kind, text });

  const insertImageFile = async (file: File) => {
    try {
      const image = await readImageFile(file);
      addImage(image.src, image.width, image.height);
    } catch (error) {
      console.warn('Could not add the image', error);
      showFeedback('error', "Couldn't add that image — try a PNG, JPG or WebP file");
    }
  };

  /** Import a local .html/.htm file as a ready-to-render embed. */
  const insertHtmlFile = async (file: File) => {
    try {
      const text = await file.text();
      const id = insert('html');
      if (!id) return;
      useDocStore.getState().updateElement(id, {
        content: text,
        src: '',
        name: file.name,
        reloadToken: 1,
      });
    } catch (error) {
      console.warn('Could not add the HTML file', error);
      showFeedback('error', `Couldn't load "${file.name}" as an HTML embed`);
    }
  };

  const toolButton = (value: typeof tool, label: string, icon: React.ReactNode) => (
    <button
      className={`toolbar-icon-btn ${tool === value ? 'active' : ''}`}
      onClick={() => setTool(tool === value ? 'select' : value)}
      title={label}
      aria-label={label}
      aria-pressed={tool === value}
    >
      {icon}
    </button>
  );

  return (
    <header className="top-toolbar">
      <button
        className="toolbar-icon-btn"
        onClick={undo}
        disabled={pastLength === 0}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        <Undo2 size={16} />
      </button>
      <button
        className="toolbar-icon-btn"
        onClick={redo}
        disabled={futureLength === 0}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
      >
        <Redo2 size={16} />
      </button>

      <span className="toolbar-separator" />

      {toolButton('select', 'Select (V)', <MousePointer2 size={16} />)}

      <div className="toolbar-menu" ref={shapeMenuRef}>
        <button
          className={`toolbar-icon-btn ${SHAPE_ITEMS.some((item) => item.kind === tool) ? 'active' : ''}`}
          onClick={() => setShapeMenuOpen((open) => !open)}
          title="Shapes"
          aria-label="Shapes"
          aria-haspopup="menu"
          aria-expanded={shapeMenuOpen}
        >
          <Square size={16} />
          <ChevronDown size={10} className="toolbar-caret" />
        </button>
        {shapeMenuOpen && (
          <div className="toolbar-dropdown" role="menu">
            {SHAPE_ITEMS.map((item) => (
              <button key={item.kind} onClick={() => insert(item.kind)} role="menuitem">
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="toolbar-menu" ref={mathMenuRef}>
        <button
          className="toolbar-icon-btn"
          onClick={() => setMathMenuOpen((open) => !open)}
          title="Math figures"
          aria-label="Math figures"
          aria-haspopup="menu"
          aria-expanded={mathMenuOpen}
        >
          <Sigma size={16} />
          <ChevronDown size={10} className="toolbar-caret" />
        </button>
        {mathMenuOpen && (
          <div className="toolbar-dropdown" role="menu">
            {FIGURE_ITEMS.map((item) => (
              <button key={item.kind} onClick={() => { insertFigure(item.kind); setMathMenuOpen(false); }} role="menuitem">
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="toolbar-icon-btn" onClick={() => insert('text')} title="Text (T)" aria-label="Text">
        <Type size={16} />
      </button>
      <button className="toolbar-icon-btn" onClick={() => insert('latex')} title="LaTeX (L)" aria-label="LaTeX">
        <Pi size={16} />
      </button>
      <button className="toolbar-icon-btn" onClick={() => insert('code')} title="Code block (C)" aria-label="Code block">
        <Code2 size={16} />
      </button>
      <div className="toolbar-menu" ref={htmlMenuRef}>
        <button
          className="toolbar-icon-btn"
          onClick={() => htmlFileRef.current?.click()}
          title="Import HTML file"
          aria-label="Import HTML file"
        >
          <FileCode2 size={16} />
        </button>
        <button
          className="toolbar-icon-btn toolbar-caret-btn"
          onClick={() => setHtmlMenuOpen((open) => !open)}
          title="HTML embed options"
          aria-label="HTML embed options"
          aria-haspopup="menu"
          aria-expanded={htmlMenuOpen}
        >
          <ChevronDown size={10} className="toolbar-caret" />
        </button>
        {htmlMenuOpen && (
          <div className="toolbar-dropdown" role="menu">
            <button
              onClick={() => {
                htmlFileRef.current?.click();
                setHtmlMenuOpen(false);
              }}
              role="menuitem"
            >
              <span>Import HTML file…</span>
            </button>
            <button
              onClick={() => {
                insert('html');
                setHtmlMenuOpen(false);
              }}
              role="menuitem"
            >
              <span>Blank embed</span>
            </button>
          </div>
        )}
      </div>
      <input
        ref={htmlFileRef}
        type="file"
        accept=".html,.htm,text/html"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) await insertHtmlFile(file);
        }}
      />
      <button
        className="toolbar-icon-btn"
        onClick={() => imageRef.current?.click()}
        title="Image"
        aria-label="Add image"
      >
        <ImageIcon size={16} />
      </button>
      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) await insertImageFile(file);
        }}
      />
      <button
        className="toolbar-icon-btn"
        onClick={() => pdfRef.current?.click()}
        title="Import PDF — one slide per page, drawn on the canvas ready for annotation"
        aria-label="Import PDF"
      >
        <FileUp size={16} />
      </button>
      {pdfProgress && (
        <span className="toolbar-status" role="status">
          Importing {pdfProgress.done}/{pdfProgress.total}…
        </span>
      )}
      <input
        ref={pdfRef}
        type="file"
        accept=".pdf,application/pdf"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          try {
            setPdfProgress({ done: 0, total: 0 });
            const result = await importPdfFile(file, (done, total) => setPdfProgress({ done, total }));
            useDocStore.getState().importPdfPages(result.pages);
          } catch (error) {
            console.warn('Could not import the PDF', error);
            showFeedback('error', "Couldn't import that PDF — check it isn't encrypted");
          } finally {
            setPdfProgress(null);
          }
        }}
      />

      <span className="toolbar-separator" />

      <div className="toolbar-menu" ref={penMenuRef}>
        <button
          className={`toolbar-icon-btn ${tool === 'pen' || tool === 'highlighter' ? 'active' : ''}`}
          onClick={() => setPenMenuOpen((open) => !open)}
          title="Pen / Highlighter (P) — options in the menu"
          aria-label="Pen and highlighter"
          aria-haspopup="menu"
          aria-expanded={penMenuOpen}
        >
          {tool === 'highlighter' ? <Highlighter size={16} /> : <Pen size={16} />}
          <ChevronDown size={10} className="toolbar-caret" />
        </button>
        {penMenuOpen && (
          <div className="toolbar-dropdown toolbar-pen-menu" role="menu">
            <div className="pen-menu-title">Type</div>
            {PEN_TIPS.map((tip) => (
              <button
                key={tip.id}
                className={penTip === tip.id ? 'active' : ''}
                onClick={() => setPenTip(tip.id)}
                role="menuitemradio"
                aria-checked={penTip === tip.id}
              >
                {tip.id === 'highlighter' ? <Highlighter size={14} /> : <Pen size={14} />}
                <span>{tip.label}</span>
              </button>
            ))}
            <div className="pen-menu-title">Color</div>
            <ColorField
              label={tool === 'highlighter' ? 'Highlighter color' : 'Pen color'}
              value={tool === 'highlighter' ? highlighterColor : penColor}
              onChange={tool === 'highlighter' ? setHighlighterColor : setPenColor}
            />
            <SliderField
              label="Thickness"
              min={1}
              max={30}
              value={penWidth}
              onChange={setPenWidth}
            />
            <SliderField
              label="Opacity"
              min={10}
              max={100}
              value={Math.round(penOpacity * 100)}
              format={(v) => `${v}%`}
              onChange={(v) => setPenOpacity(v / 100)}
            />
          </div>
        )}
      </div>
      {toolButton('connector', 'Connector', <Spline size={16} />)}

      <div className="toolbar-spacer" />

      <button className="toolbar-icon-btn" onClick={addSlide} title="New slide" aria-label="New slide">
        <Plus size={16} />
      </button>
      <button
        className="toolbar-icon-btn"
        onClick={() => duplicateSlide(activeSlideIndex)}
        title="Duplicate slide"
        aria-label="Duplicate slide"
      >
        <Copy size={16} />
      </button>
      <button
        className="toolbar-icon-btn"
        onClick={() => deleteSlide(activeSlideIndex)}
        disabled={doc.slides.length <= 1}
        title="Delete slide"
        aria-label="Delete slide"
      >
        <Trash2 size={16} />
      </button>

      <span className="toolbar-separator" />

      <button
        className="toolbar-text-btn"
        onClick={() => fileRef.current?.click()}
        title="Open a .slide script and present it here"
        aria-label="Open presentation file"
      >
        <Upload size={16} />
        <span>Open</span>
      </button>
      <div className="toolbar-menu" ref={exportMenuRef}>
        <button
          className="toolbar-text-btn"
          onClick={() => setExportMenuOpen((open) => !open)}
          title="Download this presentation"
          aria-label="Export"
          aria-haspopup="menu"
          aria-expanded={exportMenuOpen}
        >
          <Download size={16} />
          <span>Export</span>
          <ChevronDown size={10} className="toolbar-caret" />
        </button>
        {exportMenuOpen && (
          <div className="toolbar-dropdown toolbar-export-menu" role="menu">
            <button
              role="menuitem"
              onClick={() => {
                setExportMenuOpen(false);
                const blob = new Blob([serializeDoc(doc)], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${doc.title.replace(/[^\w-]+/g, '-') || 'deck'}.slide`;
                link.click();
                URL.revokeObjectURL(url);
                showFeedback('ok', `Saved "${doc.title || 'deck'}.slide" to your downloads`);
              }}
            >
              <Download size={15} />
              <span className="menu-item-text">
                <span className="menu-item-title">Presentation script (.slide)</span>
                <span className="menu-item-desc">Editable source — reopen it here later</span>
              </span>
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setExportMenuOpen(false);
                startPdfExport();
              }}
            >
              <Printer size={15} />
              <span className="menu-item-text">
                <span className="menu-item-title">PDF</span>
                <span className="menu-item-desc">Opens the print dialog — choose “Save as PDF”</span>
              </span>
            </button>
          </div>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".slide,.txt,text/plain"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          const text = await file.text();
          const result = applyCode(text);
          if (result.ok) {
            setSourceCode(text, 'gui');
            startPresenting(0);
          } else {
            showFeedback(
              'error',
              `Couldn't open "${file.name}" — it isn't a valid .slide script (details in the Console)`,
            );
          }
        }}
      />
      {feedback && (
        <span
          className={`toolbar-status ${feedback.kind === 'error' ? 'error' : 'ok'}`}
          role="status"
          aria-live="polite"
        >
          {feedback.text}
        </span>
      )}

      <button
        className="toolbar-icon-btn"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <button
        className="toolbar-primary-btn"
        onClick={() => startPresenting(activeSlideIndex)}
        title="Present from this slide (F5)"
      >
        <Play size={14} /> Present
      </button>
    </header>
  );
}
