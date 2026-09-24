'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

// Canvas-based markup pad for the "Draw on Image" field type — the respondent draws
// freehand annotations directly on top of an admin-uploaded background image, then
// exports the two flattened onto one PNG. Modeled on signature-pad.tsx (Pointer Events
// drive drawing so mouse/touch/pen all work from one set of handlers), but this pad also
// has to load and paint a background image before any strokes happen, and re-paint that
// same background (instead of a blank canvas) when the respondent hits Clear.

const CANVAS_WIDTH = 600;
const DEFAULT_CANVAS_HEIGHT = 360;
const MIN_CANVAS_HEIGHT = 240;
const MAX_CANVAS_HEIGHT = 600;

interface DrawOnImagePadProps {
  /** Fetchable URL for the field's background image (its own image API route) —
   * undefined when the admin hasn't uploaded one yet, in which case the respondent draws
   * on a blank white canvas instead. */
  imageSrc?: string;
  strokeColor?: string;
  strokeWidth?: number;
  /** Called with the flattened (background + annotations) PNG blob once the respondent
   * confirms their markup. */
  onSave: (blob: Blob) => void | Promise<void>;
  /** True while the parent is uploading the exported blob — disables the pad's controls. */
  saving?: boolean;
}

export function DrawOnImagePad({
  imageSrc,
  strokeColor = '#1a1a1a',
  strokeWidth = 3,
  onSave,
  saving = false,
}: DrawOnImagePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const backgroundRef = useRef<HTMLImageElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const paintBackground = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const bg = backgroundRef.current;
    if (bg) {
      ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    }
  }, []);

  // Load the background image (if any) into an off-DOM <img>, via a fetched blob/object
  // URL rather than pointing the <img> straight at imageSrc — same trick as
  // field-image-upload.tsx's handleEditExisting, needed because the field's image API
  // route redirects to a presigned S3 URL (cross-origin from the public form), which
  // would otherwise taint the canvas and block toBlob() export.
  // biome-ignore lint/correctness/useExhaustiveDependencies: paintBackground is a stable useCallback with no reactive deps — imageSrc is the only real trigger for reloading the background
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function load() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (!imageSrc) {
        canvas.height = DEFAULT_CANVAS_HEIGHT;
        backgroundRef.current = null;
        if (!cancelled) {
          paintBackground();
          setReady(true);
        }
        return;
      }

      try {
        const res = await fetch(imageSrc);
        if (!res.ok) throw new Error('Could not load the background image.');
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);

        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Could not load the background image.'));
          img.src = objectUrl as string;
        });

        if (cancelled) return;
        const aspect = img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 0.6;
        const height = Math.min(
          MAX_CANVAS_HEIGHT,
          Math.max(MIN_CANVAS_HEIGHT, Math.round(CANVAS_WIDTH * aspect)),
        );
        canvas.height = height;
        backgroundRef.current = img;
        paintBackground();
        setReady(true);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Could not load the background image.');
          canvas.height = DEFAULT_CANVAS_HEIGHT;
          backgroundRef.current = null;
          paintBackground();
          setReady(true);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageSrc]);

  function getPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (saving || !ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    isDrawingRef.current = true;
    lastPointRef.current = getPoint(event);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const point = getPoint(event);
    const last = lastPointRef.current;
    if (last) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
    lastPointRef.current = point;
    if (!hasDrawing) setHasDrawing(true);
  }

  function stopDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    isDrawingRef.current = false;
    lastPointRef.current = null;
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  function handleClear() {
    paintBackground();
    setHasDrawing(false);
  }

  function handleUseDrawing() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) {
        void onSave(blob);
      }
    }, 'image/png');
  }

  return (
    <div className="draw-on-image-pad">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={DEFAULT_CANVAS_HEIGHT}
        className="draw-on-image-pad-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
        onPointerCancel={stopDrawing}
      />
      {loadError ? <p className="form-field-error">{loadError}</p> : null}
      <div className="draw-on-image-pad-controls">
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={handleClear}
          disabled={saving || !ready}
        >
          Clear
        </button>
        <button
          type="button"
          className="button button--small"
          onClick={handleUseDrawing}
          disabled={!hasDrawing || saving || !ready}
        >
          {saving ? 'Uploading…' : 'Use this drawing'}
        </button>
      </div>
    </div>
  );
}
