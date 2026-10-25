/**
 * PDF import: each page becomes its own slide, with the page rasterized as the
 * slide's background image. The canvas draws slide content as SVG, so the page
 * sits underneath as a background and the user can draw/annotate on top of it;
 * serialization, undo and PDF export keep working.
 *
 * The blank margins of the page's sheet are trimmed away (see the import loop),
 * so the canvas is the page's content box, not the full sheet.
 *
 * pdf.js rasterizes pages on a canvas with its bundled worker (bundled at
 * v5.4 — the 6.x line requires the very new `Uint8Array.prototype.toHex` and
 * parses fail on older browsers), which yields a `data:` URL inside the image element. Pages render
 * at the deck's native slide width so they stay crisp when presenting,
 * printing or exporting to PDF.
 */
import { SLIDE_W } from '../model/types';
import { computeContentBounds, expandBounds } from './contentBounds';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

declare global {
  // Util methods new enough that TS 5.6's DOM lib does not know them yet.
  interface Uint8Array {
    toHex?(): string;
    toBase64?(): string;
  }
  interface Uint8ArrayConstructor {
    fromHex?(input: string): Uint8Array;
    fromBase64?(input: string): Uint8Array;
  }
}

export interface PdfPageImage {
  src: string;
  /** Raster pixel size of the rendered page (what `src` actually contains). */
  width: number;
  height: number;
  /** The PDF page's content box in points — its own size minus the blank
   *  margins, i.e. exactly what the slide canvas should be. */
  pageWidth: number;
  pageHeight: number;
}

export interface PdfImportResult {
  fileName: string;
  pages: PdfPageImage[];
}

/**
 * pdf.js ships fallbacks for these in 5.x and dropped them in 6.x, where a
 * missing method aborts every parse with a cryptic `TypeError` instead of a
 * recoverable error. Keeping 5.x + these shims covers runtimes that predate
 * the APIs (the app's embedded Chromium among them).
 */
function polyfillTypedArrayCodecs(): void {
  if (!Uint8Array.prototype.toHex) {
    Uint8Array.prototype.toHex = function toHex(this: Uint8Array): string {
      let out = '';
      for (let i = 0; i < this.length; i += 1) out += this[i].toString(16).padStart(2, '0');
      return out;
    };
  }
  if (!Uint8Array.fromHex) {
    Uint8Array.fromHex = function fromHex(input: string): Uint8Array {
      const hex = String(input);
      if (hex.length % 2 !== 0 || /[^0-9a-fA-F]/.test(hex)) {
        throw new TypeError('Invalid hex string');
      }
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      return out;
    } as unknown as Uint8ArrayConstructor['fromHex'];
  }
  if (!Uint8Array.prototype.toBase64) {
    Uint8Array.prototype.toBase64 = function toBase64(this: Uint8Array): string {
      let binary = '';
      for (let i = 0; i < this.length; i += 1) binary += String.fromCharCode(this[i]);
      return btoa(binary);
    };
  }
  if (!Uint8Array.fromBase64) {
    Uint8Array.fromBase64 = function fromBase64(input: string): Uint8Array {
      const clean = String(input).replace(/[\t\n\f\r ]/g, '');
      const binary = atob(clean);
      const out = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
      return out;
    } as unknown as Uint8ArrayConstructor['fromBase64'];
  }
}

/** Loaded lazily so the multi-MB pdf.js bundle is not part of first paint. */
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

function loadPdfjs(): Promise<typeof import('pdfjs-dist')> {
  if (!pdfjsPromise) {
    polyfillTypedArrayCodecs();
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/** Blank-margin trim: fraction of the content box kept as breathing room on
 *  each side of the detected content, so text is not flush against the edge. */
const CONTENT_PAD_FRACTION = 0.02;

/**
 * Raster bounds. The longest page edge is capped rather than always rendering
 * 1920 wide: a portrait page rendered at 1920 wide is 2485 tall (~0.75 MB of
 * JPEG), so a 20-page script would allocate ~17 MB of base64, blow through the
 * localStorage budget and make every undo snapshot take hundreds of ms. 1600
 * on the long edge stays crisp when zoomed and keeps a deck in the low MBs.
 */
const MAX_PAGE_EDGE = 1600;

/** WebP roughly halves the bytes of an equivalent JPEG for text pages; keep
 *  JPEG as the fallback for engines that refuse to encode it. */
function encodePage(canvas: HTMLCanvasElement): string {
  const webp = canvas.toDataURL('image/webp', 0.82);
  if (webp.startsWith('data:image/webp')) return webp;
  return canvas.toDataURL('image/jpeg', 0.86);
}

export async function importPdfFile(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<PdfImportResult> {
  const pdfjs = await loadPdfjs();
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

  const pages: PdfPageImage[] = [];
  const total = doc.numPages;
  for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const longest = Math.max(base.width, base.height) || SLIDE_W;
    const viewport = page.getViewport({ scale: MAX_PAGE_EDGE / longest });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create a 2D canvas to render the PDF page.');
    // White backdrop: PDF pages assume a viewer's white sheet behind them.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;

    // Trim the sheet's blank margins: real documents (a LaTeX Letter page,
    // for example) are mostly whitespace, and a canvas of the full sheet
    // surrounds the content the user actually works with. The raster is
    // cropped to the bounding box of the drawn content — padded so a thin
    // border of breathing room survives — and the page size is that region
    // measured in points. Pages that already fill the sheet (or an all-white
    // page) come through untouched. Reading pixels requires an untainted
    // canvas; if that fails we fall back to the full page rather than losing
    // the import.
    const renderScale = MAX_PAGE_EDGE / (longest || 1);
    let region = { x: 0, y: 0, width: canvas.width, height: canvas.height };
    try {
      const bounds = computeContentBounds(
        context.getImageData(0, 0, canvas.width, canvas.height).data,
        canvas.width,
        canvas.height,
      );
      if (bounds && (bounds.x > 0 || bounds.y > 0 || bounds.width < canvas.width || bounds.height < canvas.height)) {
        // A small margin (2% of the content box per side) so the text is not
        // flush against the canvas edge, clamped to the sheet itself.
        region = expandBounds(bounds, CONTENT_PAD_FRACTION, canvas.width, canvas.height);
      }
    } catch {
      // Keep the full page.
    }
    let srcCanvas = canvas;
    if (region.width !== canvas.width || region.height !== canvas.height) {
      srcCanvas = document.createElement('canvas');
      srcCanvas.width = region.width;
      srcCanvas.height = region.height;
      srcCanvas
        .getContext('2d')
        ?.drawImage(canvas, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height);
    }
    pages.push({
      src: encodePage(srcCanvas),
      width: srcCanvas.width,
      height: srcCanvas.height,
      pageWidth: region.width / renderScale,
      pageHeight: region.height / renderScale,
    });
    // Release the page's worker-side caches before the next (possibly large)
    // page renders; without this long scripts hold every page in memory.
    page.cleanup();
    onProgress?.(pageNumber, total);
  }
  doc.cleanup();
  return { fileName: file.name, pages };
}
