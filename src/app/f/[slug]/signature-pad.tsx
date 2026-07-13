'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

// Plain HTML5 canvas signature pad — Pointer Events (not separate mouse/touch listeners)
// give us mouse + touch + pen drawing from one set of handlers, per specs/03: "supporting
// both mouse and touch drawing". The parent (field-input.tsx) owns what happens to the
// exported PNG blob (presign/PUT/confirm upload flow) — this component only draws and exports.

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 220;
const INK_COLOR = '#1f2a20';

interface SignaturePadProps {
  /** Called with the drawn signature as a PNG blob when the respondent confirms it. */
  onSave: (blob: Blob) => void | Promise<void>;
  /** True while the parent is uploading the exported blob — disables the pad's controls. */
  saving?: boolean;
}

export function SignaturePad({ onSave, saving = false }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasDrawing, setHasDrawing] = useState(false);

  // Paint a white background once on mount so the exported PNG isn't transparent (a
  // transparent signature can render invisible depending on where it's later viewed).
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK_COLOR;
  }, []);

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
    if (saving) return;
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
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
  }

  function handleUseSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) {
        void onSave(blob);
      }
    }, 'image/png');
  }

  return (
    <div className="signature-pad">
      <div className="signature-pad-toolbar">
        <span className="signature-pad-tab signature-pad-tab--active">Draw signature</span>
        <span className="signature-pad-divider" aria-hidden="true">
          |
        </span>
        <span
          className="signature-pad-tab signature-pad-tab--disabled"
          title="Typed signatures — coming soon"
        >
          Type signature
        </span>
        <button
          type="button"
          className="signature-pad-clear"
          onClick={handleClear}
          disabled={saving}
        >
          Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="signature-pad-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
        onPointerCancel={stopDrawing}
      />
      <div className="signature-pad-controls">
        <button
          type="button"
          className="button button--small"
          onClick={handleUseSignature}
          disabled={!hasDrawing || saving}
        >
          {saving ? 'Uploading…' : 'Use this signature'}
        </button>
      </div>
    </div>
  );
}
