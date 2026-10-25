/**
 * Images live inside the document as data URLs so that a deck stays
 * self-contained when it is saved or exported. Large raster files are scaled
 * down on import: the whole deck is persisted to localStorage, and a single
 * untouched camera photo would blow through that quota.
 */

const MAX_DIMENSION = 1600;

export interface LoadedImage {
  src: string;
  width: number;
  height: number;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('The image file could not be read.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That file is not a readable image.'));
    image.src = src;
  });
}

function downscale(image: HTMLImageElement, type: string): LoadedImage | null {
  const largest = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, MAX_DIMENSION / largest);
  if (scale >= 1) return null;

  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(image, 0, 0, width, height);
  // JPEG has no alpha channel, so transparent sources stay PNG.
  const keepsAlpha = type === 'image/png' || type === 'image/webp';
  const src = canvas.toDataURL(keepsAlpha ? 'image/png' : 'image/jpeg', 0.9);
  return { src, width, height };
}

export async function readImageFile(file: File): Promise<LoadedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files can be added to a slide.');
  }
  const raw = await readAsDataUrl(file);
  const image = await loadImage(raw);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (width <= 0 || height <= 0) {
    throw new Error('That image has no visible size.');
  }

  // Vector and animated sources are passed through untouched.
  const resizable = file.type !== 'image/svg+xml' && file.type !== 'image/gif';
  if (!resizable) return { src: raw, width, height };
  return downscale(image, file.type) ?? { src: raw, width, height };
}
