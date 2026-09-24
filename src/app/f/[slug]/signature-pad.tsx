'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

// Plain HTML5 canvas signature pad — Pointer Events (not separate mouse/touch listeners)
// give us mouse + touch + pen drawing from one set of handlers, per specs/03: "supporting
// both mouse and touch drawing". The parent (field-input.tsx) owns what happens to the
// captured PNG blob — signing is staged locally and only uploaded at final form submit,
// so this component auto-captures (no separate confirm button) and only draws/exports.

const CANVAS_WIDTH = 600;
const DEFAULT_SURFACE_HEIGHT = 220;
const MIN_SURFACE_HEIGHT = 120;
const MAX_SURFACE_HEIGHT = 480;
const INK_COLOR = '#1f2a20';
// Loaded via @font-face in globals.css rather than next/font in layout.tsx, so this
// component's font dependency stays self-contained — canvas text needs the font to have
// actually finished loading before fillText() is called (see the effect below), unlike
// regular DOM text which repaints itself once a webfont arrives.
const SIGNATURE_FONT_FAMILY = 'Caveat';
const SIGNATURE_CANVAS_FONT = `56px "${SIGNATURE_FONT_FAMILY}", cursive`;

type SignatureMode = 'draw' | 'type';

interface SignaturePadProps {
  /** Called with the signature as a PNG blob automatically — after each completed stroke
   * in "draw" mode, or on blur in "type" mode. There's no separate confirm step: signing
   * is staged locally (see field-input.tsx's SignatureControl) rather than uploaded right
   * away, so there's nothing left for a button to trigger. */
  onCapture: (blob: Blob) => void;
  /** Called when the pad is cleared, or the Draw/Type mode is switched — either discards
   * whatever was previously captured. */
  onClear: () => void;
  /** This field's current answer, if any — restores it onto the canvas on mount so
   * navigating back to an earlier page of a multi-page form (which remounts this
   * component fresh) doesn't make an already-captured signature look like it vanished.
   * Only consulted once, at mount. */
  initialImageUrl?: string;
}

export function SignaturePad({ onCapture, onClear, initialImageUrl }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [mode, setMode] = useState<SignatureMode>('draw');
  const [typedName, setTypedName] = useState('');
  // Drives the box's visible height (both the canvas and, in "type" mode, the input that
  // takes its place) — dragged via the resize handle below. The canvas's own height
  // attribute is mutated imperatively in startResize rather than through this state
  // directly, since resizing a <canvas> clears its bitmap and needs the old content
  // copied back in; this state just needs to end up matching so the visible box and the
  // drawable area stay in lockstep (see getPoint's scale factor, which relies on that).
  const [surfaceHeight, setSurfaceHeight] = useState(DEFAULT_SURFACE_HEIGHT);

  const paintBlankCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Paint a white background once on mount so the exported PNG isn't transparent (a
  // transparent signature can render invisible depending on where it's later viewed) --
  // then, if this field was already answered before this component mounted (e.g. the
  // respondent signed, moved to another page, and came back), redraw that onto the
  // canvas so it doesn't look like the signature was lost. blob: URLs from a File this
  // same tab created are always readable here, no CORS taint.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally mount-only -- re-running this every time initialImageUrl changes (which happens on every stroke, once onCapture's result round-trips back into the value prop) would fight the respondent's in-progress drawing.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    paintBlankCanvas();
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK_COLOR;

    if (initialImageUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasDrawing(true);
      };
      img.src = initialImageUrl;
    }
  }, [paintBlankCanvas]);

  function handleModeChange(nextMode: SignatureMode) {
    if (nextMode === mode) return;
    setMode(nextMode);
    setHasDrawing(false);
    setTypedName('');
    paintBlankCanvas();
    onClear();
  }

  // Vertical-only resize (the box already stretches to its container's width) — same drag
  // pattern as field-card.tsx's DividerResizeHandles, adapted to also keep the canvas
  // bitmap in sync: changing a <canvas>'s height attribute clears whatever was drawn, so
  // we snapshot it first and paint it back afterward, anchored top-left rather than
  // stretched, so an in-progress signature keeps its proportions (growing the box just
  // reveals blank space below it; shrinking crops from the bottom).
  function startResize(event: ReactPointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = surfaceHeight;

    function handleMove(moveEvent: PointerEvent) {
      const nextHeight = Math.round(
        Math.min(
          MAX_SURFACE_HEIGHT,
          Math.max(MIN_SURFACE_HEIGHT, startHeight + (moveEvent.clientY - startY)),
        ),
      );
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx && canvas.height !== nextHeight) {
        const snapshot = document.createElement('canvas');
        snapshot.width = canvas.width;
        snapshot.height = canvas.height;
        snapshot.getContext('2d')?.drawImage(canvas, 0, 0);

        canvas.height = nextHeight;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const copyHeight = Math.min(snapshot.height, nextHeight);
        ctx.drawImage(snapshot, 0, 0, canvas.width, copyHeight, 0, 0, canvas.width, copyHeight);
        // Resizing a canvas resets all 2D context state back to defaults — restore what
        // the mount effect originally set.
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = INK_COLOR;
      }
      setSurfaceHeight(nextHeight);
    }

    function handleUp() {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
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

  function exportCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) onCapture(blob);
    }, 'image/png');
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (mode !== 'draw') return;
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
    const wasDrawing = isDrawingRef.current;
    isDrawingRef.current = false;
    lastPointRef.current = null;
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    // Auto-capture at the end of every completed stroke — there's no separate "confirm"
    // step now that signing is staged locally rather than uploaded right away. Gated on
    // wasDrawing so a stray pointerup/pointerleave without an actual drag (or one that
    // fires again after the pointer's already been released) doesn't re-export.
    if (wasDrawing && hasDrawing) exportCanvas();
  }

  function handleClear() {
    if (mode === 'type') {
      setTypedName('');
    } else {
      paintBlankCanvas();
      setHasDrawing(false);
    }
    onClear();
  }

  // Type mode never draws to the canvas while the respondent is typing (the visible
  // "signature" then is the plain DOM <input>, not the hidden canvas) — it's only
  // rendered here, on blur, which now doubles as this mode's auto-capture trigger.
  // document.fonts.load must come first: unlike DOM text, a canvas fillText() call fired
  // before the webfont finishes loading just silently draws with the fallback font and
  // never repaints once the real one arrives.
  async function captureTypedSignature() {
    const name = typedName.trim();
    if (!name) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    if (typeof document !== 'undefined' && 'fonts' in document) {
      try {
        await document.fonts.load(SIGNATURE_CANVAS_FONT);
      } catch {
        // Font failed to load (offline, blocked request, etc.) — fall through and
        // draw with whatever the browser substitutes rather than leaving it blank.
      }
    }
    paintBlankCanvas();
    ctx.fillStyle = INK_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = SIGNATURE_CANVAS_FONT;
    ctx.fillText(name, canvas.width / 2, canvas.height / 2, canvas.width - 64);
    exportCanvas();
  }

  return (
    <div className="signature-pad">
      <div className="signature-pad-toolbar">
        <button
          type="button"
          className={`signature-pad-tab ${mode === 'draw' ? 'signature-pad-tab--active' : ''}`}
          onClick={() => handleModeChange('draw')}
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
        >
          Type signature
        </button>
        <button type="button" className="signature-pad-clear" onClick={handleClear}>
          Clear
        </button>
      </div>
      <div className="signature-pad-surface">
        {/* One box, not two: the canvas is the drawing surface in "draw" mode and the
            input takes its exact place in "type" mode — never both on screen together.
            The canvas stays mounted (just hidden) either way since canvasRef is also the
            export target in captureTypedSignature. */}
        {mode === 'type' ? (
          <input
            type="text"
            className="signature-pad-canvas signature-pad-type-input"
            style={{ height: surfaceHeight }}
            value={typedName}
            onChange={(event) => setTypedName(event.target.value)}
            onBlur={() => void captureTypedSignature()}
            placeholder="Type your full name"
            // biome-ignore lint/a11y/noAutofocus: switching into type mode is a deliberate action, focusing the field is expected
            autoFocus
          />
        ) : null}
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={DEFAULT_SURFACE_HEIGHT}
          className="signature-pad-canvas"
          style={mode === 'type' ? { display: 'none' } : { height: surfaceHeight }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          onPointerCancel={stopDrawing}
        />
        <button
          type="button"
          className="signature-pad-resize-handle"
          aria-label="Drag to resize the signature box"
          title="Drag to resize"
          onPointerDown={startResize}
        />
      </div>
    </div>
  );
}
