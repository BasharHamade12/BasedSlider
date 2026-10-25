import { useCallback, useEffect } from 'react';
import { canvasSize, HtmlEmbedElement, Slide } from '../model/types';
import { ElementView } from '../canvas/ElementView';
import { useDocStore, useUiStore } from '../model/store';

/**
 * Renders every slide at natural size for the print dialog. A uniform
 * 1280×720 (16:9) sheet keeps the numeric @page rule valid; slides with a
 * custom canvas size are scaled contain-fit and centered on that sheet.
 */

/** Uniform print sheet (px at 96 dpi); non-16:9 slides letterbox onto it. */
const PAGE_W = 1280;
const PAGE_H = 720;

function SlidePage({ slide }: { slide: Slide }) {
  const embeds = slide.elements.filter(
    (element): element is HtmlEmbedElement => element.type === 'html' && !element.hidden,
  );
  const board = canvasSize(slide);
  const scale = Math.min(PAGE_W / board.width, PAGE_H / board.height);
  const offsetX = (PAGE_W - board.width * scale) / 2;
  const offsetY = (PAGE_H - board.height * scale) / 2;

  return (
    <div className="pdf-page" data-slide-id={slide.id}>
      <svg
        width={board.width * scale}
        height={board.height * scale}
        viewBox={`0 0 ${board.width} ${board.height}`}
        preserveAspectRatio="none"
        style={{ marginLeft: offsetX, marginTop: offsetY }}
      >
        <rect x={0} y={0} width={board.width} height={board.height} fill={slide.background} />
        {slide.backgroundImage && (
          <image
            href={slide.backgroundImage}
            x={0}
            y={0}
            width={board.width}
            height={board.height}
            preserveAspectRatio="xMidYMid meet"
          />
        )}
        {slide.elements.map((element) => (
          <ElementView key={element.id} element={element} elements={slide.elements} />
        ))}
      </svg>
      {/* Live HTML embeds can't live inside the SVG; mirror them like PresentMode. */}
      {embeds.map((element) => (          <div
            key={element.id}
            style={{
              position: 'absolute',
              left: offsetX + element.x * scale,
              top: offsetY + element.y * scale,
              width: element.width * scale,
              height: element.height * scale,
              borderRadius: element.radius > 0 ? element.radius * scale : undefined,
              overflow: 'hidden',
              transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
            }}
          >
          <iframe
            title={`PDF HTML embed ${element.id}`}
            srcDoc={element.content.trim() !== '' ? element.content : undefined}
            src={element.content.trim() !== '' ? undefined : element.src || undefined}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          />
        </div>
      ))}
    </div>
  );
}

export function PdfExportLayer() {
  const doc = useDocStore((state) => state.doc);
  const printing = useUiStore((state) => state.pdfPrinting);
  const endPdfPrint = useUiStore((state) => state.endPdfPrint);

  const finish = useCallback(() => endPdfPrint(), [endPdfPrint]);

  useEffect(() => {
    if (!printing) return;
    // Two animated frames let KaTeX/foreignObject/iframes paint before the
    // print snapshot is taken.
    let frame = 0;
    const tick = () => {
      frame += 1;
      if (frame < 2) {
        window.requestAnimationFrame(tick);
        return;
      }
      window.print();
      finish();
    };
    const handle = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printing]);

  if (!printing) return null;

  return (
    <div className="pdf-print-root" aria-hidden="true">
      {doc.slides.map((slide) => (
        <SlidePage key={slide.id} slide={slide} />
      ))}
    </div>
  );
}
