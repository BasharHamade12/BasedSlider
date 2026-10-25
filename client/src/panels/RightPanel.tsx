import { useRef, useState } from 'react';
import {
  AlignCenter,
  AlignHorizontalSpaceAround,
  AlignLeft,
  AlignRight,
  ArrowUpDown,
  ChevronsRight,
  Code2,
  Film,
  FileCode2,
  Image as ImageIcon,
  Layers,
  Move,
  Palette,
  PenTool,
  Plus,
  Sigma,
  Spline,
  Trash2,
  Type,
} from 'lucide-react';
import {
  ANIMATION_EFFECTS,
  ARROW_TYPES,
  AnimationEffect,
  AnimationSpec,
  CodeElement,
  ConnectorElement,
  DIRECTIONS,
  EASINGS,
  Element,
  FigureElement,
  FigureFunction,
  FIGURE_FUNCTIONS,
  FigureKind,
  FIGURE_KINDS,
  HtmlEmbedElement,
  IMAGE_FITS,
  ImageElement,
  LatexElement,
  PenElement,
  ROUTINGS,
  ShapeElement,
  TextBlock,
  TextElement,
  TRANSITION_TYPES,
  canvasSize,
  isShape,
} from '../model/types';
import { createShadow } from '../model/factories';
import { readImageFile } from '../canvas/imageFile';
import { useDocStore, useUiStore } from '../model/store';
import {
  ButtonRow,
  ColorField,
  NumberField,
  Section,
  Segmented,
  SelectField,
  SliderField,
  SmallButton,
  TextArea,
  TextField,
  ToggleField,
} from './controls';

/* Sorted by group, matching the <optgroup> rendering order in SelectField. */
const FONT_OPTIONS = [
  { value: 'Inter, system-ui, sans-serif', label: 'Inter', group: 'Sans', fontFamily: 'Inter, system-ui, sans-serif' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial', group: 'Sans', fontFamily: 'Arial, Helvetica, sans-serif' },
  { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica', group: 'Sans', fontFamily: 'Helvetica, Arial, sans-serif' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana', group: 'Sans', fontFamily: 'Verdana, Geneva, sans-serif' },
  { value: 'Tahoma, Geneva, sans-serif', label: 'Tahoma', group: 'Sans', fontFamily: 'Tahoma, Geneva, sans-serif' },
  { value: '"Trebuchet MS", sans-serif', label: 'Trebuchet MS', group: 'Sans', fontFamily: '"Trebuchet MS", sans-serif' },
  { value: '"Segoe UI", system-ui, sans-serif', label: 'Segoe UI', group: 'Sans', fontFamily: '"Segoe UI", system-ui, sans-serif' },
  { value: 'Calibri, "Segoe UI", sans-serif', label: 'Calibri', group: 'Sans', fontFamily: 'Calibri, "Segoe UI", sans-serif' },
  { value: '"Arial Black", Arial, sans-serif', label: 'Arial Black', group: 'Sans', fontFamily: '"Arial Black", Arial, sans-serif' },
  { value: 'Georgia, serif', label: 'Georgia', group: 'Serif', fontFamily: 'Georgia, serif' },
  { value: '"Times New Roman", Times, serif', label: 'Times New Roman', group: 'Serif', fontFamily: '"Times New Roman", Times, serif' },
  { value: 'Garamond, "Palatino Linotype", serif', label: 'Garamond', group: 'Serif', fontFamily: 'Garamond, "Palatino Linotype", serif' },
  { value: '"Palatino Linotype", Palatino, "Book Antiqua", serif', label: 'Palatino', group: 'Serif', fontFamily: '"Palatino Linotype", Palatino, "Book Antiqua", serif' },
  { value: 'Baskerville, "Palatino Linotype", serif', label: 'Baskerville', group: 'Serif', fontFamily: 'Baskerville, "Palatino Linotype", serif' },
  { value: 'ui-monospace, Menlo, Consolas, monospace', label: 'Monospace', group: 'Mono', fontFamily: 'ui-monospace, Menlo, Consolas, monospace' },
  { value: 'Consolas, "Courier New", monospace', label: 'Consolas', group: 'Mono', fontFamily: 'Consolas, "Courier New", monospace' },
  { value: '"Courier New", Courier, monospace', label: 'Courier New', group: 'Mono', fontFamily: '"Courier New", Courier, monospace' },
  { value: 'Impact, "Arial Black", sans-serif', label: 'Impact', group: 'Display', fontFamily: 'Impact, "Arial Black", sans-serif' },
  { value: '"Comic Sans MS", "Comic Sans", cursive', label: 'Comic Sans MS', group: 'Display', fontFamily: '"Comic Sans MS", "Comic Sans", cursive' },
  { value: 'Copperplate, "Copperplate Gothic Light", serif', label: 'Copperplate', group: 'Display', fontFamily: 'Copperplate, "Copperplate Gothic Light", serif' },
  { value: 'Papyrus, fantasy', label: 'Papyrus', group: 'Display', fontFamily: 'Papyrus, fantasy' },
];

const LANGUAGE_OPTIONS = [
  'typescript',
  'javascript',
  'tsx',
  'jsx',
  'python',
  'java',
  'c',
  'cpp',
  'csharp',
  'go',
  'rust',
  'sql',
  'json',
  'bash',
  'html',
  'css',
  'markdown',
  'yaml',
].map((value) => ({ value, label: value }));

const EFFECT_LABELS: Record<AnimationEffect, string> = {
  fadeIn: 'Fade in',
  slideIn: 'Slide in',
  zoomIn: 'Zoom in',
  drawLine: 'Draw line',
  fadeOut: 'Fade out',
  slideOut: 'Slide out',
  zoomOut: 'Zoom out',
  pulse: 'Pulse',
  bounce: 'Bounce',
  spin: 'Spin',
  flash: 'Flash',
};

function typeLabel(element: Element): string {
  if (element.type === 'connector') return 'Connector';
  if (element.type === 'text') return 'Text';
  if (element.type === 'latex') return 'LaTeX';
  if (element.type === 'code') return 'Code';
  if (element.type === 'html') return 'HTML embed';
  if (element.type === 'figure') return 'Figure';
  if (element.type === 'image') return 'Image';
  if (element.type === 'pen') return 'Pen stroke';
  return element.type.charAt(0).toUpperCase() + element.type.slice(1);
}

export function RightPanel() {
  const doc = useDocStore((state) => state.doc);
  const selectedIds = useUiStore((state) => state.selectedIds);
  const activeSlideIndex = useUiStore((state) => state.activeSlideIndex);
  const collapsed = useUiStore((state) => state.rightCollapsed);
  const toggleRightPanel = useUiStore((state) => state.toggleRightPanel);
  const slide = doc.slides[activeSlideIndex];
  const selected = (slide?.elements ?? []).filter((element) => selectedIds.includes(element.id));

  return (
    <aside className={`right-panel ${collapsed ? 'collapsed' : ''}`}>
      <div className="panel-head">
        <h2 className="panel-title">Properties</h2>
        <button
          className="panel-collapse"
          onClick={toggleRightPanel}
          title="Minimize properties panel"
          aria-label="Minimize properties panel"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
      {selected.length === 0 && <SlideInspector index={activeSlideIndex} />}
      {selected.length === 1 && <ElementInspector element={selected[0]} />}
      {selected.length > 1 && <MultiInspector count={selected.length} />}
    </aside>
  );
}

/* ─── slide ─── */

function SlideInspector({ index }: { index: number }) {
  const doc = useDocStore((state) => state.doc);
  const updateSlide = useDocStore((state) => state.updateSlide);
  const updateTransition = useDocStore((state) => state.updateTransition);
  const duplicateSlide = useDocStore((state) => state.duplicateSlide);
  const deleteSlide = useDocStore((state) => state.deleteSlide);
  const applyBoardSizeAll = useDocStore((state) => state.applyBoardSizeAll);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const [bgError, setBgError] = useState<string | null>(null);
  const slide = doc.slides[index];
  if (!slide) return null;

  const board = canvasSize(slide);
  const setSize = (width: number, height: number) =>
    updateSlide(index, { width: Math.max(320, Math.min(7680, Math.round(width))), height: Math.max(320, Math.min(7680, Math.round(height))) });

  const setSlideImage = async (file: File) => {
    try {
      const image = await readImageFile(file);
      updateSlide(index, { backgroundImage: image.src });
      setBgError(null);
    } catch (caught) {
      setBgError(caught instanceof Error ? caught.message : 'That image could not be loaded.');
    }
  };

  return (
    <>
      <div className="inspector-head">
        <span>Slide</span>
        <code>{slide.id}</code>
      </div>
      <Section title="Slide" icon={<Layers size={13} />}>
        <TextField label="Name" value={slide.name} onChange={(value) => updateSlide(index, { name: value })} />
        <ColorField
          label="Background"
          value={slide.background}
          onChange={(value) => updateSlide(index, { background: value })}
        />
        <p className="prop-hint">{slide.backgroundImage ? 'Background image set · shown behind every element' : 'Background image: none'}</p>
        <ButtonRow>
          <SmallButton onClick={() => bgFileRef.current?.click()}>
            {slide.backgroundImage ? 'Replace image…' : 'Choose image…'}
          </SmallButton>
          {slide.backgroundImage && (
            <SmallButton onClick={() => updateSlide(index, { backgroundImage: undefined })}>
              <Trash2 size={12} /> Clear
            </SmallButton>
          )}
        </ButtonRow>
        <input
          ref={bgFileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) await setSlideImage(file);
          }}
        />
        {bgError && <p className="prop-hint prop-error">{bgError}</p>}
        <div className="field-grid">
          <NumberField
            label="Canvas width"
            value={Math.round(board.width)}
            min={320}
            max={7680}
            step={20}
            onChange={(value) => setSize(value, board.height)}
          />
          <NumberField
            label="Canvas height"
            value={Math.round(board.height)}
            min={320}
            max={7680}
            step={20}
            onChange={(value) => setSize(board.width, value)}
          />
        </div>
        <ButtonRow>
          <SmallButton
            onClick={() => applyBoardSizeAll(Math.round(board.width), Math.round(board.height))}
            title="Set every slide to this exact canvas size"
          >
            <Move size={12} /> Apply to all slides
          </SmallButton>
        </ButtonRow>
        <TextArea
          label="Speaker notes"
          value={slide.notes}
          rows={4}
          onChange={(value) => updateSlide(index, { notes: value })}
        />
      </Section>

      <Section title="Transition" icon={<Film size={13} />}>
        <SelectField
          label="Type"
          value={slide.transition.type}
          options={TRANSITION_TYPES.map((value) => ({ value, label: value }))}
          onChange={(value) => updateTransition(index, { type: value })}
        />
        {slide.transition.type !== 'none' && (
          <>
            <SelectField
              label="Direction"
              value={slide.transition.direction}
              options={DIRECTIONS.map((value) => ({ value, label: value }))}
              onChange={(value) => updateTransition(index, { direction: value })}
            />
            <NumberField
              label="Duration"
              value={slide.transition.duration}
              min={0}
              step={50}
              suffix="ms"
              onChange={(value) => updateTransition(index, { duration: value })}
            />
            <SelectField
              label="Easing"
              value={slide.transition.easing}
              options={EASINGS.map((value) => ({ value, label: value }))}
              onChange={(value) => updateTransition(index, { easing: value })}
            />
          </>
        )}
      </Section>

      <Section title="Slide actions" icon={<CopyIcon />}>
        <ButtonRow>
          <SmallButton onClick={() => duplicateSlide(index)}>Duplicate</SmallButton>
          <SmallButton
            danger
            onClick={() => deleteSlide(index)}
            title={doc.slides.length <= 1 ? 'A deck needs at least one slide' : 'Delete slide'}
          >
            Delete
          </SmallButton>
        </ButtonRow>
      </Section>
    </>
  );
}

function CopyIcon() {
  return <Plus size={13} />;
}

/* ─── element ─── */

function ElementInspector({ element }: { element: Element }) {
  return (
    <>
      <div className="inspector-head">
        <span>{typeLabel(element)}</span>
        <code>{element.id}</code>
      </div>
      {element.type !== 'connector' && <TransformSection element={element} />}
      {isShape(element) && <ShapeSection element={element} />}
      {element.type === 'text' && <TextSection element={element} />}
      {element.type === 'latex' && <LatexSection element={element} />}
      {element.type === 'code' && <CodeSection element={element} />}
      {element.type === 'html' && <HtmlSection element={element} />}
      {element.type === 'figure' && <FigureSection element={element} />}
      {element.type === 'image' && <ImageSection element={element} />}
      {element.type === 'pen' && <PenSection element={element} />}
      {element.type === 'connector' && <ConnectorSection element={element} />}
      <ArrangeSection id={element.id} />
      <AnimationSection element={element} />
    </>
  );
}

function TransformSection({ element }: { element: Exclude<Element, ConnectorElement> }) {
  const updateElement = useDocStore((state) => state.updateElement);
  const set = (patch: Record<string, unknown>, key: string) =>
    updateElement(element.id, patch, { coalesce: `${element.id}:${key}` });

  return (
    <Section title="Transform" icon={<Move size={13} />}>
      <div className="field-grid">
        <NumberField label="X" value={Math.round(element.x)} onChange={(value) => set({ x: value }, 'x')} />
        <NumberField label="Y" value={Math.round(element.y)} onChange={(value) => set({ y: value }, 'y')} />
        {element.type !== 'pen' && (
          <>
            <NumberField
              label="W"
              value={Math.round(element.width)}
              min={0}
              onChange={(value) => set({ width: value }, 'width')}
            />
            <NumberField
              label="H"
              value={Math.round(element.height)}
              min={0}
              onChange={(value) => set({ height: value }, 'height')}
            />
          </>
        )}
      </div>
      <NumberField
        label="Rotation"
        value={Math.round(element.rotation)}
        min={-360}
        max={360}
        suffix="°"
        onChange={(value) => set({ rotation: value }, 'rotation')}
      />
      <SliderField
        label="Opacity"
        value={element.opacity}
        min={0}
        max={1}
        step={0.01}
        format={(value) => `${Math.round(value * 100)}%`}
        onChange={(value) => set({ opacity: value }, 'opacity')}
      />
      <ToggleField
        label="Locked"
        value={element.locked}
        onChange={(value) => updateElement(element.id, { locked: value })}
      />
      <ToggleField
        label="Hidden"
        value={element.hidden}
        onChange={(value) => updateElement(element.id, { hidden: value })}
      />
    </Section>
  );
}

function ShapeSection({ element }: { element: ShapeElement }) {
  const updateElement = useDocStore((state) => state.updateElement);
  const set = (patch: Record<string, unknown>, key: string) =>
    updateElement(element.id, patch, { coalesce: `${element.id}:${key}` });

  return (
    <>
      <Section title="Appearance" icon={<Palette size={13} />}>
        <ColorField label="Fill" value={element.fill} onChange={(value) => set({ fill: value }, 'fill')} />
        <ColorField label="Stroke" value={element.stroke} onChange={(value) => set({ stroke: value }, 'stroke')} />
        <NumberField
          label="Stroke width"
          value={element.strokeWidth}
          min={0}
          max={40}
          onChange={(value) => set({ strokeWidth: value }, 'strokeWidth')}
        />
        {element.type === 'rect' && (
          <NumberField
            label="Corner radius"
            value={element.radius}
            min={0}
            max={200}
            onChange={(value) => set({ radius: value }, 'radius')}
          />
        )}
        <NumberField
          label="Dash"
          value={element.dash}
          min={0}
          max={60}
          onChange={(value) => set({ dash: value }, 'dash')}
        />
        <ToggleField
          label="Shadow"
          value={element.shadow !== null}
          onChange={(value) => updateElement(element.id, { shadow: value ? createShadow() : null })}
        />
        {element.shadow && (
          <>
            <div className="field-grid">
              <NumberField
                label="Shadow X"
                value={element.shadow.x}
                onChange={(value) => updateElement(element.id, { shadow: { ...element.shadow!, x: value } }, { coalesce: `${element.id}:shadowX` })}
              />
              <NumberField
                label="Shadow Y"
                value={element.shadow.y}
                onChange={(value) => updateElement(element.id, { shadow: { ...element.shadow!, y: value } }, { coalesce: `${element.id}:shadowY` })}
              />
            </div>
            <NumberField
              label="Blur"
              value={element.shadow.blur}
              min={0}
              onChange={(value) => updateElement(element.id, { shadow: { ...element.shadow!, blur: value } })}
            />
            <ColorField
              label="Shadow color"
              value={element.shadow.color}
              onChange={(value) => updateElement(element.id, { shadow: { ...element.shadow!, color: value } })}
            />
          </>
        )}
      </Section>

      <Section title="Text in shape" icon={<Type size={13} />}>
        {element.text ? (
          <>
            <TextBlockEditor block={element.text} onChange={(patch) => updateElementText(element.id, patch, 'label')} />
            <ButtonRow>
              <SmallButton danger onClick={() => updateElement(element.id, { text: null })}>
                Remove text
              </SmallButton>
            </ButtonRow>
          </>
        ) : (
          <ButtonRow>
            <SmallButton onClick={() => updateElementText(element.id, { content: 'Label' }, 'label')}>
              Add text
            </SmallButton>
          </ButtonRow>
        )}
      </Section>
    </>
  );
}

function TextSection({ element }: { element: TextElement }) {
  return (
    <Section title="Text" icon={<Type size={13} />}>
      <TextBlockEditor block={element.text} onChange={(patch) => updateElementText(element.id, patch, 'text')} />
    </Section>
  );
}

function TextBlockEditor({ block, onChange }: { block: TextBlock; onChange: (patch: Partial<TextBlock>) => void }) {
  return (
    <>
      <TextArea label="Content" value={block.content} rows={3} onChange={(value) => onChange({ content: value })} />
      <SelectField
        label="Font"
        value={block.fontFamily}
        options={FONT_OPTIONS}
        onChange={(value) => onChange({ fontFamily: value })}
      />
      <div className="field-grid">
        <NumberField label="Size" value={block.fontSize} min={4} max={400} onChange={(value) => onChange({ fontSize: value })} />
        <SelectField
          label="Weight"
          value={String(block.fontWeight)}
          options={['300', '400', '500', '600', '700', '800'].map((value) => ({ value, label: value }))}
          onChange={(value) => onChange({ fontWeight: Number(value) })}
        />
      </div>
      <Segmented
        label="Align"
        value={block.align}
        options={[
          { value: 'left', label: <AlignLeft size={13} />, title: 'Left' },
          { value: 'center', label: <AlignCenter size={13} />, title: 'Center' },
          { value: 'right', label: <AlignRight size={13} />, title: 'Right' },
        ]}
        onChange={(value) => onChange({ align: value })}
      />
      <div className="field-grid">
        <NumberField
          label="Line height"
          value={block.lineHeight}
          min={0.5}
          max={4}
          step={0.05}
          onChange={(value) => onChange({ lineHeight: value })}
        />
        <NumberField
          label="Spacing"
          value={block.letterSpacing}
          min={-10}
          max={40}
          step={0.1}
          onChange={(value) => onChange({ letterSpacing: value })}
        />
      </div>
      <ColorField label="Color" value={block.color} onChange={(value) => onChange({ color: value })} />
      <div className="toggle-row">
        <ToggleField label="Italic" value={block.italic} onChange={(value) => onChange({ italic: value })} />
        <ToggleField label="Underline" value={block.underline} onChange={(value) => onChange({ underline: value })} />
        <ToggleField label="Shrink to fit" value={block.autofit} onChange={(value) => onChange({ autofit: value })} />
      </div>
      <ToggleField
        label="Math mode ($…$ → KaTeX)"
        value={block.math}
        onChange={(value) => onChange({ math: value })}
      />
    </>
  );
}

function updateElementText(id: string, patch: Partial<TextBlock>, target: 'text' | 'label') {
  useDocStore.getState().updateText(id, patch, target);
}

function LatexSection({ element }: { element: LatexElement }) {
  const updateElement = useDocStore((state) => state.updateElement);
  return (
    <Section title="LaTeX" icon={<Sigma size={13} />}>
      <TextArea
        label="Source"
        value={element.content}
        rows={4}
        mono
        onChange={(value) => updateElement(element.id, { content: value })}
      />
      <NumberField
        label="Font size"
        value={element.fontSize}
        min={8}
        max={200}
        onChange={(value) => updateElement(element.id, { fontSize: value })}
      />
      <ColorField
        label="Color"
        value={element.color}
        onChange={(value) => updateElement(element.id, { color: value })}
      />
      <ToggleField
        label="Display mode"
        value={element.displayMode}
        onChange={(value) => updateElement(element.id, { displayMode: value })}
      />
    </Section>
  );
}

function CodeSection({ element }: { element: CodeElement }) {
  const updateElement = useDocStore((state) => state.updateElement);
  return (
    <Section title="Code" icon={<Code2 size={13} />}>
      <TextArea
        label="Source"
        value={element.content}
        rows={8}
        mono
        onChange={(value) => updateElement(element.id, { content: value })}
      />
      <SelectField
        label="Language"
        value={element.language}
        options={LANGUAGE_OPTIONS}
        onChange={(value) => updateElement(element.id, { language: value })}
      />
      <SelectField
        label="Theme"
        value={element.theme}
        options={[
          { value: 'dark', label: 'Dark' },
          { value: 'light', label: 'Light' },
        ]}
        onChange={(value) => updateElement(element.id, { theme: value })}
      />
      <NumberField
        label="Font size"
        value={element.fontSize}
        min={6}
        max={80}
        onChange={(value) => updateElement(element.id, { fontSize: value })}
      />
      <ToggleField
        label="Line numbers"
        value={element.lineNumbers}
        onChange={(value) => updateElement(element.id, { lineNumbers: value })}
      />
      <ColorField label="Text" value={element.color} onChange={(value) => updateElement(element.id, { color: value })} />
      <ColorField
        label="Background"
        value={element.background}
        onChange={(value) => updateElement(element.id, { background: value })}
      />
    </Section>
  );
}

const FIGURE_KIND_LABELS: Record<FigureKind, string> = {
  axes: 'Axes (orthonormal)',
  plane: 'Plane (grid)',
  graph: 'Function graph',
  barchart: 'Bar chart',
};

const FIGURE_FN_LABELS: Record<FigureFunction, string> = {
  line: 'Line  f(x) = a·x + b',
  quadratic: 'Parabola  f(x) = a·x² + b·x + c',
  cubic: 'Cubic  f(x) = a·x³ + b·x² + c·x',
  sine: 'Sine  f(x) = a·sin(b·x) + c',
  exp: 'Exponential  f(x) = a·e^(b·x) + c',
};

function FigureSection({ element }: { element: FigureElement }) {
  const updateElement = useDocStore((state) => state.updateElement);
  const valuesText = element.values.join(', ');
  return (
    <Section title="Figure" icon={<Palette size={13} />}>
      <SelectField
        label="Type"
        value={element.kind}
        options={FIGURE_KINDS.map((kind) => ({ value: kind, label: FIGURE_KIND_LABELS[kind] }))}
        onChange={(kind) => updateElement(element.id, { kind })}
      />
      <TextField
        label="Title"
        value={element.title}
        onChange={(title) => updateElement(element.id, { title })}
      />
      {element.kind === 'graph' && (
        <>
          <p className="prop-hint">Change the family or coefficients below to reshape the curve — the whole figure stays one editable object.</p>
          <SelectField
            label="Curve"
            value={element.fn}
            options={FIGURE_FUNCTIONS.map((fn) => ({ value: fn, label: FIGURE_FN_LABELS[fn] }))}
            onChange={(fn) => updateElement(element.id, { fn })}
          />
          <div className="field-grid">
            <NumberField
              label="a"
              value={element.a}
              min={-20}
              max={20}
              step={0.1}
              onChange={(a) => updateElement(element.id, { a })}
            />
            <NumberField
              label="b"
              value={element.b}
              min={-20}
              max={20}
              step={0.1}
              onChange={(b) => updateElement(element.id, { b })}
            />
            <NumberField
              label="c"
              value={element.c}
              min={-20}
              max={20}
              step={0.1}
              onChange={(c) => updateElement(element.id, { c })}
            />
          </div>
          <NumberField
            label="x-domain (±)"
            value={element.domain}
            min={1}
            max={50}
            step={1}
            onChange={(domain) => updateElement(element.id, { domain })}
          />
        </>
      )}
      {element.kind === 'barchart' && (
        <TextField
          label="Bar values (comma-sep)"
          value={valuesText}
          onChange={(text) => {
            const values = text
              .split(',')
              .map((part) => Number(part.trim()))
              .filter((value) => Number.isFinite(value));
            updateElement(element.id, { values: values.length > 0 ? values : element.values });
          }}
        />
      )}
      <div className="field-grid">
        <ColorField
          label="Axis"
          value={element.axisColor}
          onChange={(axisColor) => updateElement(element.id, { axisColor })}
        />
        <ColorField
          label="Curve"
          value={element.accentColor}
          onChange={(accentColor) => updateElement(element.id, { accentColor })}
        />
      </div>
      <div className="field-grid">
        <ColorField
          label="Grid"
          value={element.gridColor}
          onChange={(gridColor) => updateElement(element.id, { gridColor })}
        />
        <ColorField
          label="Title"
          value={element.titleColor}
          onChange={(titleColor) => updateElement(element.id, { titleColor })}
        />
      </div>
    </Section>
  );
}

function HtmlSection({ element }: { element: HtmlEmbedElement }) {
  const updateElement = useDocStore((state) => state.updateElement);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const hasContent = element.content.trim() !== '';
  const hasSource = hasContent || element.src.trim() !== '';

  const loadFile = async (file: File) => {
    try {
      const text = await file.text();
      updateElement(element.id, { content: text, src: '' });
      // New file, new frame: a distinct token forces the embed to reload.
      updateElement(element.id, { reloadToken: (element.reloadToken ?? 0) + 1 });
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That file could not be read.');
    }
  };

  return (
    <Section title="HTML embed" icon={<FileCode2 size={13} />}>
      {hasContent && <p className="prop-hint">Embedded HTML · about {Math.max(1, Math.round((element.content.length * 1) / 1024))} KB</p>}
      <TextField
        label="Page URL"
        value={element.src}
        placeholder="https://…"
        onChange={(value) => updateElement(element.id, { src: value })}
      />
      <ButtonRow>
        <SmallButton onClick={() => fileRef.current?.click()}>Choose .html file…</SmallButton>
      </ButtonRow>
      <input
        ref={fileRef}
        type="file"
        accept=".html,.htm,text/html"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) await loadFile(file);
        }}
      />
      <TextArea
        label="HTML source"
        value={element.content}
        rows={8}
        mono
        onChange={(value) => updateElement(element.id, { content: value })}
      />
      {hasContent && element.src.trim() !== '' && (
        <p className="prop-hint">Both URL and source are set; the embedded source is rendered.</p>
      )}
      {hasSource && (
        <ButtonRow>
          <SmallButton
            onClick={() => updateElement(element.id, { reloadToken: (element.reloadToken ?? 0) + 1 })}
          >
            Reload
          </SmallButton>
        </ButtonRow>
      )}
      {error && <p className="prop-hint prop-error">{error}</p>}
      <NumberField
        label="Corner radius"
        value={element.radius}
        min={0}
        max={400}
        onChange={(value) => updateElement(element.id, { radius: value })}
      />
    </Section>
  );
}

function ImageSection({ element }: { element: ImageElement }) {
  const updateElement = useDocStore((state) => state.updateElement);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const embedded = element.src.startsWith('data:');
  const sizeKb = embedded ? Math.max(1, Math.round((element.src.length * 0.75) / 1024)) : 0;

  const replace = async (file: File) => {
    try {
      const image = await readImageFile(file);
      updateElement(element.id, { src: image.src });
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That image could not be loaded.');
    }
  };

  return (
    <Section title="Image" icon={<ImageIcon size={13} />}>
      {embedded ? (
        <p className="prop-hint">Embedded image · about {sizeKb} KB</p>
      ) : (
        <TextField
          label="Source URL"
          value={element.src}
          placeholder="https://…"
          onChange={(value) => updateElement(element.id, { src: value })}
        />
      )}
      <ButtonRow>
        <SmallButton onClick={() => fileRef.current?.click()}>
          {element.src ? 'Replace image…' : 'Choose image…'}
        </SmallButton>
      </ButtonRow>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) await replace(file);
        }}
      />
      {error && <p className="prop-hint prop-error">{error}</p>}
      <SelectField
        label="Fit"
        value={element.fit}
        options={IMAGE_FITS.map((value) => ({ value, label: value }))}
        onChange={(value) => updateElement(element.id, { fit: value })}
      />
      <NumberField
        label="Corner radius"
        value={element.radius}
        min={0}
        max={400}
        onChange={(value) => updateElement(element.id, { radius: value })}
      />
    </Section>
  );
}

function PenSection({ element }: { element: PenElement }) {
  const updateElement = useDocStore((state) => state.updateElement);
  return (
    <Section title="Stroke" icon={<PenTool size={13} />}>
      <ColorField label="Color" value={element.color} onChange={(value) => updateElement(element.id, { color: value })} />
      <NumberField
        label="Width"
        value={element.strokeWidth}
        min={1}
        max={60}
        onChange={(value) => updateElement(element.id, { strokeWidth: value })}
      />
      <ToggleField
        label="Smoothing"
        value={element.smoothing}
        onChange={(value) => updateElement(element.id, { smoothing: value })}
      />
      <SelectField
        label="Mode"
        value={element.mode}
        options={[
          { value: 'pen', label: 'Pen' },
          { value: 'highlighter', label: 'Highlighter' },
        ]}
        onChange={(value) => updateElement(element.id, { mode: value })}
      />
      <p className="prop-hint">{element.points.length} points</p>
    </Section>
  );
}

function ConnectorSection({ element }: { element: ConnectorElement }) {
  const updateElement = useDocStore((state) => state.updateElement);
  const set = (patch: Record<string, unknown>, key: string) =>
    updateElement(element.id, patch, { coalesce: `${element.id}:${key}` });

  const describe = (anchor: ConnectorElement['from']) =>
    anchor.kind === 'element' ? `${anchor.elementId}:${anchor.port}` : `(${Math.round(anchor.x)}, ${Math.round(anchor.y)})`;

  return (
    <Section title="Connector" icon={<Spline size={13} />}>
      <p className="prop-hint">
        from <code>{describe(element.from)}</code> to <code>{describe(element.to)}</code>
      </p>
      <SelectField
        label="Routing"
        value={element.routing}
        options={ROUTINGS.map((value) => ({ value, label: value }))}
        onChange={(value) => updateElement(element.id, { routing: value })}
      />
      <SelectField
        label="Start arrow"
        value={element.startArrow}
        options={ARROW_TYPES.map((value) => ({ value, label: value }))}
        onChange={(value) => updateElement(element.id, { startArrow: value })}
      />
      <SelectField
        label="End arrow"
        value={element.endArrow}
        options={ARROW_TYPES.map((value) => ({ value, label: value }))}
        onChange={(value) => updateElement(element.id, { endArrow: value })}
      />
      <div className="field-grid">
        <NumberField
          label="Arrow size"
          value={element.arrowSize}
          min={4}
          max={60}
          onChange={(value) => set({ arrowSize: value }, 'arrowSize')}
        />
        <NumberField
          label="Width"
          value={element.width}
          min={0.5}
          max={20}
          step={0.5}
          onChange={(value) => set({ width: value }, 'width')}
        />
      </div>
      <NumberField
        label="Dash"
        value={element.dash}
        min={0}
        max={40}
        onChange={(value) => updateElement(element.id, { dash: value })}
      />
      <ColorField label="Color" value={element.color} onChange={(value) => updateElement(element.id, { color: value })} />
      <TextField label="Label" value={element.label} onChange={(value) => updateElement(element.id, { label: value })} />
    </Section>
  );
}

function ArrangeSection({ id }: { id: string }) {
  const reorder = useDocStore((state) => state.reorder);
  const align = useDocStore((state) => state.align);
  const groupSelection = useDocStore((state) => state.groupSelection);
  const ungroupSelection = useDocStore((state) => state.ungroupSelection);
  const duplicateSelection = useDocStore((state) => state.duplicateSelection);
  const deleteElements = useDocStore((state) => state.deleteElements);
  const selectedIds = useUiStore((state) => state.selectedIds);

  return (
    <Section title="Arrange" icon={<Layers size={13} />}>
      <div className="button-row">
        <SmallButton onClick={() => reorder(selectedIds, 'front')}>Front</SmallButton>
        <SmallButton onClick={() => reorder(selectedIds, 'back')}>Back</SmallButton>
        <SmallButton onClick={() => reorder(selectedIds, 'forward')}>Forward</SmallButton>
        <SmallButton onClick={() => reorder(selectedIds, 'backward')}>Backward</SmallButton>
      </div>
      <div className="button-row">
        <SmallButton onClick={() => align(selectedIds, 'left')}>L</SmallButton>
        <SmallButton onClick={() => align(selectedIds, 'center')}>C</SmallButton>
        <SmallButton onClick={() => align(selectedIds, 'right')}>R</SmallButton>
        <SmallButton onClick={() => align(selectedIds, 'top')}>T</SmallButton>
        <SmallButton onClick={() => align(selectedIds, 'middle')}>M</SmallButton>
        <SmallButton onClick={() => align(selectedIds, 'bottom')}>B</SmallButton>
      </div>
      <div className="button-row">
        <SmallButton onClick={() => groupSelection(selectedIds)}>Group</SmallButton>
        <SmallButton onClick={() => ungroupSelection(selectedIds)}>Ungroup</SmallButton>
      </div>
      <div className="button-row">
        <SmallButton onClick={() => duplicateSelection([id])}>Duplicate</SmallButton>
        <SmallButton danger onClick={() => deleteElements([id])}>
          <Trash2 size={12} /> Delete
        </SmallButton>
      </div>
    </Section>
  );
}

function AnimationSection({ element }: { element: Element }) {
  const addAnimation = useDocStore((state) => state.addAnimation);
  const updateAnimation = useDocStore((state) => state.updateAnimation);
  const removeAnimation = useDocStore((state) => state.removeAnimation);

  return (
    <Section title="Animations" icon={<Film size={13} />}>
      {element.animations.length === 0 && <p className="prop-hint">No animations yet.</p>}
      {element.animations.map((animation) => (
        <AnimationEditor
          key={animation.id}
          animation={animation}
          onChange={(patch) => updateAnimation(element.id, animation.id, patch)}
          onRemove={() => removeAnimation(element.id, animation.id)}
        />
      ))}
      <div className="button-row">
        <SmallButton onClick={() => addAnimation(element.id, 'fadeIn')}>+ Entrance</SmallButton>
        <SmallButton onClick={() => addAnimation(element.id, 'pulse')}>+ Emphasis</SmallButton>
        <SmallButton onClick={() => addAnimation(element.id, 'fadeOut')}>+ Exit</SmallButton>
      </div>
    </Section>
  );
}

function AnimationEditor({
  animation,
  onChange,
  onRemove,
}: {
  animation: AnimationSpec;
  onChange: (patch: Partial<AnimationSpec>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="animation-card">
      <div className="animation-card-head">
        <span>{EFFECT_LABELS[animation.effect]}</span>
        <button className="icon-btn" onClick={onRemove} title="Remove animation">
          <Trash2 size={12} />
        </button>
      </div>
      <SelectField
        label="Effect"
        value={animation.effect}
        options={ANIMATION_EFFECTS.map((value) => ({ value, label: EFFECT_LABELS[value] }))}
        onChange={(value) => onChange({ effect: value })}
      />
      <SelectField
        label="Trigger"
        value={animation.trigger}
        options={[
          { value: 'onClick', label: 'On click' },
          { value: 'withPrevious', label: 'With previous' },
          { value: 'afterPrevious', label: 'After previous' },
        ]}
        onChange={(value) => onChange({ trigger: value })}
      />
      <div className="field-grid">
        <NumberField
          label="Duration"
          value={animation.duration}
          min={0}
          step={50}
          suffix="ms"
          onChange={(value) => onChange({ duration: value })}
        />
        <NumberField
          label="Delay"
          value={animation.delay}
          min={0}
          step={50}
          suffix="ms"
          onChange={(value) => onChange({ delay: value })}
        />
      </div>
      <SelectField
        label="Easing"
        value={animation.easing}
        options={EASINGS.map((value) => ({ value, label: value }))}
        onChange={(value) => onChange({ easing: value })}
      />
      {animation.effect === 'slideIn' || animation.effect === 'slideOut' ? (
        <SelectField
          label="Direction"
          value={animation.direction}
          options={DIRECTIONS.map((value) => ({ value, label: value }))}
          onChange={(value) => onChange({ direction: value })}
        />
      ) : null}
    </div>
  );
}

/* ─── multi ─── */

function MultiInspector({ count }: { count: number }) {
  const selectedIds = useUiStore((state) => state.selectedIds);
  const align = useDocStore((state) => state.align);
  const distribute = useDocStore((state) => state.distribute);
  const groupSelection = useDocStore((state) => state.groupSelection);
  const ungroupSelection = useDocStore((state) => state.ungroupSelection);
  const reorder = useDocStore((state) => state.reorder);
  const duplicateSelection = useDocStore((state) => state.duplicateSelection);
  const deleteElements = useDocStore((state) => state.deleteElements);

  return (
    <>
      <div className="inspector-head">
        <span>Selection</span>
        <code>{count} elements</code>
      </div>
      <Section title="Align" icon={<ArrowUpDown size={13} />}>
        <div className="button-row">
          <SmallButton onClick={() => align(selectedIds, 'left')}>Left</SmallButton>
          <SmallButton onClick={() => align(selectedIds, 'center')}>Center</SmallButton>
          <SmallButton onClick={() => align(selectedIds, 'right')}>Right</SmallButton>
        </div>
        <div className="button-row">
          <SmallButton onClick={() => align(selectedIds, 'top')}>Top</SmallButton>
          <SmallButton onClick={() => align(selectedIds, 'middle')}>Middle</SmallButton>
          <SmallButton onClick={() => align(selectedIds, 'bottom')}>Bottom</SmallButton>
        </div>
        <div className="button-row">
          <SmallButton onClick={() => distribute(selectedIds, 'horizontal')}>
            <AlignHorizontalSpaceAround size={12} /> Horizontal
          </SmallButton>
          <SmallButton onClick={() => distribute(selectedIds, 'vertical')}>
            <AlignHorizontalSpaceAround size={12} /> Vertical
          </SmallButton>
        </div>
      </Section>
      <Section title="Actions" icon={<Layers size={13} />}>
        <ButtonRow>
          <SmallButton onClick={() => reorder(selectedIds, 'front')}>Front</SmallButton>
          <SmallButton onClick={() => reorder(selectedIds, 'back')}>Back</SmallButton>
        </ButtonRow>
        <ButtonRow>
          <SmallButton onClick={() => groupSelection(selectedIds)}>Group</SmallButton>
          <SmallButton onClick={() => ungroupSelection(selectedIds)}>Ungroup</SmallButton>
        </ButtonRow>
        <ButtonRow>
          <SmallButton onClick={() => duplicateSelection(selectedIds)}>Duplicate</SmallButton>
          <SmallButton danger onClick={() => deleteElements(selectedIds)}>
            Delete
          </SmallButton>
        </ButtonRow>
      </Section>
    </>
  );
}
