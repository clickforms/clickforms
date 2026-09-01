'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

// Plain HTML5 canvas signature pad — Pointer Events (not separate mouse/touch listeners)
// give us mouse + touch + pen drawing from one set of handlers, per specs/03: "supporting
// both mouse and touch drawing". The parent (field-input.tsx) owns what happens to the
// exported PNG blob (presign/PUT/confirm upload flow) — this component only draws and exports.

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 220;
const INK_COLOR = '#1f2a20';
// Loaded via @font-face in globals.css rather than next/font in layout.tsx, so this
// component's font dependency stays self-contained — canvas text needs the font to have
// actually finished loading before fillText() is called (see the effect below), unlike
// regular DOM text which repaints itself once a webfont arrives.
const SIGNATURE_FONT_FAMILY = 'Caveat';
const SIGNATURE_CANVAS_FONT = `56px "${SIGNATURE_FONT_FAMILY}", cursive`;

type SignatureMode = 'draw' | 'type';

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
  const [mode, setMode] = useState<SignatureMode>('draw');
  const [typedName, setTypedName] = useState('');

  const paintBlankCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Paint a white background once on mount so the exported PNG isn't transparent (a
  // transparent signature can render invisible depending on where it's later viewed).
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    paintBlankCanvas();
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK_COLOR;
  }, [paintBlankCanvas]);

  function handleModeChange(nextMode: SignatureMode) {
    if (nextMode === mode) return;
    setMode(nextMode);
    setHasDrawing(false);
    setTypedName('');
    paintBlankCanvas();
  }

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
    if (saving || mode !== 'draw') return;
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
    if (mode === 'type') {
      setTypedName('');
      return;
    }
    paintBlankCanvas();
    setHasDrawing(false);
  }

  async function handleUseSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Type mode never draws to the canvas while the respondent is typing (the visible
    // "signature" then is the plain DOM <input>, not the hidden canvas) — it's only
    // rendered here, once, right before export. document.fonts.load must come first:
    // unlike DOM text, a canvas fillText() call fired before the webfont finishes
    // loading just silently draws with the fallback font and never repaints once the
    // real one arrives.
    if (mode === 'type') {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (typeof document !== 'undefined' && 'fonts' in document) {
        try {
          await document.fonts.load(SIGNATURE_CANVAS_FONT);
        } catch {
          // Font failed to load (offline, blocked request, etc.) — fall through and
          // draw with whatever the browser substitutes rather than leaving it blank.
        }
      }
      paintBlankCanvas();
      const name = typedName.trim();
      if (name) {
        ctx.fillStyle = INK_COLOR;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = SIGNATURE_CANVAS_FONT;
        ctx.fillText(name, canvas.width / 2, canvas.height / 2, canvas.width - 64);
      }
    }

    canvas.toBlob((blob) => {
      if (blob) {
        void onSave(blob);
      }
    }, 'image/png');
  }

  const hasContent = mode === 'draw' ? hasDrawing : typedName.trim().length > 0;

  return (
    <div className="signature-pad">
      <div className="signature-pad-toolbar">
        <button
          type="button"
          className={`signature-pad-tab ${mode === 'draw' ? 'signature-pad-tab--active' : ''}`}
          onClick={() => handleModeChange('draw')}
          disabled={saving}
        >
          Draw signature
        </button>
        <span className="signature-pad-divider" aria-hidden="true">
          |
        </span>
        <button
          type="button"
          className={`signature-pad-tab ${mode === 'type' ? 'signature-pad-tab--active' : ''}`}
          onClick={() => handleModeChange('type')}
          disabled={saving}
        >
          Type signature
        </button>
        <button
          type="button"
          className="signature-pad-clear"
          onClick={handleClear}
          disabled={saving}
        >
          Clear
        </button>
      </div>
      {/* One box, not two: the canvas is the drawing surface in "draw" mode and the
          input takes its exact place in "type" mode — never both on screen together.
          The canvas stays mounted (just hidden) either way since canvasRef is also the
          export target in handleUseSignature. */}
      {mode === 'type' ? (
        <input
          type="text"
          className="signature-pad-canvas signature-pad-type-input"
          value={typedName}
          onChange={(event) => setTypedName(event.target.value)}
          placeholder="Type your full name"
          disabled={saving}
          // biome-ignore lint/a11y/noAutofocus: switching into type mode is a deliberate action, focusing the field is expected
          autoFocus
        />
      ) : null}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="signature-pad-canvas"
        style={mode === 'type' ? { display: 'none' } : undefined}
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
          onClick={() => void handleUseSignature()}
          disabled={!hasContent || saving}
        >
          {saving ? 'Uploading…' : 'Use this signature'}
        </button>
      </div>
    </div>
  );
}
