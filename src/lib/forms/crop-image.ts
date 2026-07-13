/** MIME types the crop canvas can emit. SVG is skipped (uploaded as-is). */
export const CROP_OUTPUT_MIME = 'image/png';

export interface PixelCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function isCroppableImage(mimeType: string): boolean {
  return (
    mimeType === 'image/png' ||
    mimeType === 'image/jpeg' ||
    mimeType === 'image/webp' ||
    mimeType === 'image/gif'
  );
}

/**
 * Exports the selected crop from a displayed <img> to a PNG blob.
 * `crop` is in the image's *rendered* pixel space (from react-image-crop);
 * we scale up to naturalWidth/Height so the saved file keeps full resolution.
 */
export async function getCroppedImageBlob(
  image: HTMLImageElement,
  crop: PixelCropRect,
): Promise<Blob> {
  if (crop.width < 1 || crop.height < 1) {
    throw new Error('Draw a crop area before applying.');
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  const cropX = crop.x * scaleX;
  const cropY = crop.y * scaleY;
  const cropWidth = crop.width * scaleX;
  const cropHeight = crop.height * scaleY;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(cropWidth * pixelRatio));
  canvas.height = Math.max(1, Math.round(cropHeight * pixelRatio));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not crop the image.');

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not export the cropped image.'));
          return;
        }
        resolve(blob);
      },
      CROP_OUTPUT_MIME,
      0.92,
    );
  });
}

export function croppedBlobToFile(blob: Blob, originalName: string): File {
  const base = originalName.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${base}.png`, { type: CROP_OUTPUT_MIME });
}
