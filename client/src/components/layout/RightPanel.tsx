import { useStore } from '../../store/useStore';
import { SlideElement } from '../../store/presentation.types';

export function RightPanel() {
  const slides = useStore(s => s.slides);
  const activeSlideIndex = useStore(s => s.activeSlideIndex);
  const selectedElementId = useStore(s => s.selectedElementId);
  const penColor = useStore(s => s.penColor);
  const setPenColor = useStore(s => s.setPenColor);
  const penWidth = useStore(s => s.penWidth);
  const setPenWidth = useStore(s => s.setPenWidth);
  const isDrawMode = useStore(s => s.isDrawMode);

  const slide = slides[activeSlideIndex];
  const selectedElement = slide?.elements.find(e => e.id === selectedElementId) ?? null;

  return (
    <aside className="right-panel">
      <h3>Properties</h3>

      {isDrawMode && (
        <section className="prop-section">
          <h4>Pen Settings</h4>
          <label>
            Color
            <input
              type="color"
              value={penColor}
              onChange={e => setPenColor(e.target.value)}
            />
          </label>
          <label>
            Width
            <input
              type="range"
              min={1}
              max={20}
              value={penWidth}
              onChange={e => setPenWidth(Number(e.target.value))}
            />
            <span>{penWidth}px</span>
          </label>
        </section>
      )}

      {selectedElement && !isDrawMode && (
        <section className="prop-section">
          <h4>{selectedElement.type}</h4>
          <PropertiesInspector element={selectedElement} />
        </section>
      )}

      {!selectedElement && !isDrawMode && (
        <p className="prop-hint">Select an element in the code to inspect its properties.</p>
      )}
    </aside>
  );
}

function PropertiesInspector({ element }: { element: SlideElement }) {
  const entries: [string, string][] = [['id', element.id]];
  entries.push(['x', String(element.x)], ['y', String(element.y)]);
  if (element.width !== undefined) entries.push(['width', String(element.width)]);
  if (element.height !== undefined) entries.push(['height', String(element.height)]);

  switch (element.type) {
    case 'rect':
      entries.push(['fill', element.fill]);
      if (element.stroke) entries.push(['stroke', element.stroke]);
      if (element.rx) entries.push(['rx', String(element.rx)]);
      break;
    case 'text':
      entries.push(['content', element.content]);
      if (element.fontSize) entries.push(['fontSize', String(element.fontSize)]);
      if (element.color) entries.push(['color', element.color]);
      break;
    case 'latex':
      entries.push(['content', element.content.substring(0, 40) + '...']);
      break;
    case 'pen':
      entries.push(['color', element.color]);
      entries.push(['width', String(element.width)]);
      entries.push(['points', String(element.points.length)]);
      entries.push(['smoothing', String(element.smoothing)]);
      break;
    case 'code':
      entries.push(['lines', String(element.content.split('\n').length)]);
      if (element.language) entries.push(['language', element.language]);
      if (element.fontSize) entries.push(['fontSize', String(element.fontSize)]);
      if (element.color) entries.push(['color', element.color]);
      if (element.background) entries.push(['background', element.background]);
      entries.push(['content', element.content.substring(0, 40) + (element.content.length > 40 ? '...' : '')]);
      break;
  }

  return (
    <dl className="prop-list">
      {entries.map(([key, val]) => (
        <div key={key} className="prop-row">
          <dt>{key}</dt>
          <dd>{val}</dd>
        </div>
      ))}
    </dl>
  );
}
