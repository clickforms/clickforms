'use client';

import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import ReactCrop, {
  type Crop,
  centerCrop,
  convertToPixelCrop,
  makeAspectCrop,
  type PercentCrop,
  type PixelCrop,
} from 'react-image-crop';
import { croppedBlobToFile, getCroppedImageBlob } from '@/lib/forms/crop-image';
import 'react-image-crop/dist/ReactCrop.css';

export type CropAspectOption = 'free' | '1:1' | '4:3' | '16:9' | '3:1';

const ASPECT_OPTIONS: { id: CropAspectOption; label: string; value: number | undefined }[] = [
  { id: 'free', label: 'Free', value: undefined },
  { id: '1:1', label: '1:1', value: 1 },
  { id: '4:3', label: '4:3', value: 4 / 3 },
  { id: '16:9', label: '16:9', value: 16 / 9 },
  { id: '3:1', label: '3:1', value: 3 },
];

function initialCrop(width: number, height: number, aspect?: number): PercentCrop {
  if (aspect === undefined) {
    return centerCrop({ unit: '%', width: 85, height: 85, x: 0, y: 0 }, width, height);
  }
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90, x: 0, y: 0 }, aspect, width, height),
    width,
    height,
  );
}

/** Bake a 90° clockwise rotation into a new object URL so the crop box stays aligned. */
async function rotateImageSrcClockwise(src: string): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', () => reject(new Error('Could not rotate the image.')));
    if (!src.startsWith('blob:') && !src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.src = src;
  });

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalHeight;
  canvas.height = image.naturalWidth;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not rotate the image.');

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Could not rotate the image.'))),
      'image/png',
      0.92,
    );
  });
  return URL.createObjectURL(blob);
}

interface ImageCropEditorProps {
  imageSrc: string;
  fileName: string;
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onApply: (file: File) => void | Promise<void>;
}

export function ImageCropEditor({
  imageSrc,
  fileName,
  open,
  busy = false,
  onCancel,
  onApply,
}: ImageCropEditorProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [workingSrc, setWorkingSrc] = useState(imageSrc);
  const [ownedSrc, setOwnedSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [aspectOption, setAspectOption] = useState<CropAspectOption>('free');
  const [applying, setApplying] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setWorkingSrc(imageSrc);
    setOwnedSrc(null);
    setCrop(undefined);
    setCompletedCrop(null);
    setAspectOption('free');
    setApplying(false);
    setRotating(false);
    setError(null);
  }, [open, imageSrc]);

  useEffect(() => {
    return () => {
      if (ownedSrc) URL.revokeObjectURL(ownedSrc);
    };
  }, [ownedSrc]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy && !applying && !rotating) onCancel();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, busy, applying, rotating, onCancel]);

  const aspect = ASPECT_OPTIONS.find((option) => option.id === aspectOption)?.value;

  function handleImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    const { width, height } = event.currentTarget;
    const next = initialCrop(width, height, aspect);
    setCrop(next);
    setCompletedCrop(convertToPixelCrop(next, width, height));
  }

  function handleAspectChange(nextOption: CropAspectOption) {
    setAspectOption(nextOption);
    const img = imgRef.current;
    if (!img) return;
    const nextAspect = ASPECT_OPTIONS.find((option) => option.id === nextOption)?.value;
    const next = initialCrop(img.width, img.height, nextAspect);
    setCrop(next);
    setCompletedCrop(convertToPixelCrop(next, img.width, img.height));
  }

  async function handleRotate() {
    if (busy || applying || rotating) return;
    setRotating(true);
    setError(null);
    try {
      const nextSrc = await rotateImageSrcClockwise(workingSrc);
      setOwnedSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextSrc;
      });
      setWorkingSrc(nextSrc);
      setCrop(undefined);
      setCompletedCrop(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rotate the image.');
    } finally {
      setRotating(false);
    }
  }

  async function handleApply() {
    const img = imgRef.current;
    if (!img || !completedCrop || busy || applying || rotating) return;
    setApplying(true);
    setError(null);
    try {
      const blob = await getCroppedImageBlob(img, completedCrop);
      await onApply(croppedBlobToFile(blob, fileName));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not crop the image.');
    } finally {
      setApplying(false);
    }
  }

  if (!open) return null;

  const disabled = busy || applying || rotating;
  const hasCrop = Boolean(completedCrop && completedCrop.width >= 1 && completedCrop.height >= 1);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; Escape key and Cancel are also wired up
    <div className="modal-overlay image-crop-overlay" onMouseDown={() => !disabled && onCancel()}>
      <div
        className="modal-card modal-card--wide image-crop-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-crop-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="image-crop-editor-title">
            Crop image
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={onCancel}
            disabled={disabled}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="image-crop-hint">
          Drag the corners or edges to resize. Drag inside the box to move it.
        </p>

        <div className="image-crop-stage">
          <ReactCrop
            crop={crop}
            aspect={aspect}
            keepSelection
            ruleOfThirds
            disabled={disabled}
            minWidth={20}
            minHeight={20}
            onChange={(nextCrop) => setCrop(nextCrop)}
            onComplete={(nextCrop) => setCompletedCrop(nextCrop)}
          >
            {/* biome-ignore lint/performance/noImgElement: crop library requires a plain img ref for pixel math */}
            <img
              ref={imgRef}
              src={workingSrc}
              alt=""
              className="image-crop-source"
              onLoad={handleImageLoad}
            />
          </ReactCrop>
        </div>

        <div className="image-crop-controls">
          <fieldset className="image-crop-aspects">
            <legend>Aspect ratio</legend>
            {ASPECT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`image-crop-aspect ${aspectOption === option.id ? 'image-crop-aspect--active' : ''}`}
                onClick={() => handleAspectChange(option.id)}
                disabled={disabled}
              >
                {option.label}
              </button>
            ))}
          </fieldset>

          <div className="image-crop-rotate-row">
            <span className="image-crop-rotate-label">Rotate</span>
            <button
              type="button"
              className="button button--ghost button--small"
              disabled={disabled}
              onClick={() => void handleRotate()}
            >
              {rotating ? 'Rotating…' : 'Rotate 90°'}
            </button>
          </div>
        </div>

        {error ? <p className="image-crop-error">{error}</p> : null}

        <div className="modal-footer">
          <button
            type="button"
            className="button button--ghost"
            onClick={onCancel}
            disabled={disabled}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button"
            onClick={() => void handleApply()}
            disabled={disabled || !hasCrop}
          >
            {applying || busy ? 'Saving…' : 'Apply & upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
