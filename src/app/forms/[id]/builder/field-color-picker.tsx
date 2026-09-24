'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type HsvColor, hexToHsv, hsvToHex, normalizeHexColor } from '@/lib/forms/color';

// A full saturation/brightness square + hue slider, replacing the old fixed 12-swatch
// grid — canvas-based (same no-new-dependency approach as signature-pad.tsx and
// draw-on-image-pad.tsx) rather than pulling in a color-picker library for this one
// control. Every call site (field-color-settings.tsx, the Design panel, per-field-type
// color extras, etc.) keeps working unchanged: the {label, value, defaultColor, canEdit,
// onChange} contract and the "onChange(undefined) means equals defaultColor" convention
// are both preserved exactly.

const SV_WIDTH = 220;
const SV_HEIGHT = 130;
const HUE_WIDTH = 220;
const HUE_HEIGHT = 14;

interface FieldColorPickerProps {
  label: string;
  value: string | undefined;
  defaultColor: string;
  canEdit: boolean;
  onChange: (color: string | undefined) => void;
}

function drawSaturationValueSquare(canvas: HTMLCanvasElement, hue: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvas;

  ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
  ctx.fillRect(0, 0, width, height);

  const whiteGradient = ctx.createLinearGradient(0, 0, width, 0);
  whiteGradient.addColorStop(0, 'rgba(255,255,255,1)');
  whiteGradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = whiteGradient;
  ctx.fillRect(0, 0, width, height);

  const blackGradient = ctx.createLinearGradient(0, 0, 0, height);
  blackGradient.addColorStop(0, 'rgba(0,0,0,0)');
  blackGradient.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = blackGradient;
  ctx.fillRect(0, 0, width, height);
}

function drawHueSlider(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvas;
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  const stops = ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'];
  stops.forEach((color, index) => {
    gradient.addColorStop(index / (stops.length - 1), color);
  });
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

export function FieldColorPicker({
  label,
  value,
  defaultColor,
  canEdit,
  onChange,
}: FieldColorPickerProps) {
  const activeColor = value ?? defaultColor;
  const [hsv, setHsv] = useState<HsvColor>(
    () => hexToHsv(normalizeHexColor(activeColor) ?? defaultColor) ?? { h: 0, s: 0, v: 0 },
  );
  const [hexInput, setHexInput] = useState(activeColor);
  const [hexError, setHexError] = useState<string | null>(null);
  // Tracks the hex our own hsv state would currently produce, so the effect below only
  // re-derives hsv from an *externally*-changed activeColor (a different field selected,
  // a Reset click elsewhere) rather than every render — round-tripping hex -> hsv -> hex
  // on our own updates would visibly reset the hue whenever saturation/value hits 0
  // (pure white/black has no defined hue), jerking the hue slider back to red mid-drag.
  const lastAppliedHexRef = useRef(hsvToHex(hsv));
  const svCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hueCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const svDraggingRef = useRef(false);
  const hueDraggingRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: lastAppliedHexRef is a ref (not reactive) and defaultColor is stable per field — only activeColor should re-trigger this sync
  useEffect(() => {
    const normalized = normalizeHexColor(activeColor) ?? defaultColor;
    if (normalized.toLowerCase() !== lastAppliedHexRef.current.toLowerCase()) {
      const next = hexToHsv(normalized);
      if (next) {
        setHsv(next);
        lastAppliedHexRef.current = normalized;
      }
    }
    setHexInput(normalized);
    setHexError(null);
  }, [activeColor]);

  useEffect(() => {
    if (svCanvasRef.current) drawSaturationValueSquare(svCanvasRef.current, hsv.h);
  }, [hsv.h]);

  useEffect(() => {
    if (hueCanvasRef.current) drawHueSlider(hueCanvasRef.current);
  }, []);

  const commit = useCallback(
    (nextHsv: HsvColor) => {
      const hex = hsvToHex(nextHsv);
      lastAppliedHexRef.current = hex;
      setHexInput(hex);
      setHexError(null);
      const nextValue = hex === defaultColor.toLowerCase() ? undefined : hex;
      const currentValue = (value?.toLowerCase() ?? defaultColor.toLowerCase()) as string;
      if (hex === currentValue) return;
      onChange(nextValue);
    },
    [defaultColor, value, onChange],
  );

  function pointFromEvent(canvas: HTMLCanvasElement, event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.min(canvas.width, Math.max(0, (event.clientX - rect.left) * scaleX));
    const y = Math.min(canvas.height, Math.max(0, (event.clientY - rect.top) * scaleY));
    return { x, y };
  }

  function handleSvPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!canEdit) return;
    const canvas = svCanvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    svDraggingRef.current = true;
    updateFromSvPoint(canvas, event);
  }

  function handleSvPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!svDraggingRef.current) return;
    const canvas = svCanvasRef.current;
    if (!canvas) return;
    updateFromSvPoint(canvas, event);
  }

  function updateFromSvPoint(
    canvas: HTMLCanvasElement,
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) {
    const { x, y } = pointFromEvent(canvas, event);
    const s = x / canvas.width;
    const v = 1 - y / canvas.height;
    const nextHsv = { h: hsv.h, s, v };
    setHsv(nextHsv);
    commit(nextHsv);
  }

  function stopSvDragging(event: ReactPointerEvent<HTMLCanvasElement>) {
    svDraggingRef.current = false;
    const canvas = svCanvasRef.current;
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  function handleHuePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!canEdit) return;
    const canvas = hueCanvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    hueDraggingRef.current = true;
    updateFromHuePoint(canvas, event);
  }

  function handleHuePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!hueDraggingRef.current) return;
    const canvas = hueCanvasRef.current;
    if (!canvas) return;
    updateFromHuePoint(canvas, event);
  }

  function updateFromHuePoint(
    canvas: HTMLCanvasElement,
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) {
    const { x } = pointFromEvent(canvas, event);
    const h = Math.min(359.99, (x / canvas.width) * 360);
    const nextHsv = { h, s: hsv.s, v: hsv.v };
    setHsv(nextHsv);
    commit(nextHsv);
  }

  function stopHueDragging(event: ReactPointerEvent<HTMLCanvasElement>) {
    hueDraggingRef.current = false;
    const canvas = hueCanvasRef.current;
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  function commitHexInput() {
    const normalized = normalizeHexColor(hexInput);
    if (!normalized) {
      setHexError('Enter a hex color like #55ea8c');
      setHexInput(activeColor);
      return;
    }
    const next = hexToHsv(normalized);
    if (next) setHsv(next);
    commit(next ?? hsv);
  }

  const svCursorX = hsv.s * 100;
  const svCursorY = (1 - hsv.v) * 100;
  const hueCursorX = (hsv.h / 360) * 100;

  return (
    <div className="field-color-picker">
      <p className="field-color-picker-label">{label}</p>
      <div className="field-color-spectrum">
        <div className="field-color-sv-wrap">
          <canvas
            ref={svCanvasRef}
            width={SV_WIDTH}
            height={SV_HEIGHT}
            className={`field-color-sv-canvas ${!canEdit ? 'field-color-sv-canvas--disabled' : ''}`}
            onPointerDown={handleSvPointerDown}
            onPointerMove={handleSvPointerMove}
            onPointerUp={stopSvDragging}
            onPointerLeave={stopSvDragging}
            onPointerCancel={stopSvDragging}
          />
          <span
            className="field-color-sv-cursor"
            style={{ left: `${svCursorX}%`, top: `${svCursorY}%` }}
            aria-hidden
          />
        </div>
        <div className="field-color-hue-wrap">
          <canvas
            ref={hueCanvasRef}
            width={HUE_WIDTH}
            height={HUE_HEIGHT}
            className={`field-color-hue-canvas ${!canEdit ? 'field-color-hue-canvas--disabled' : ''}`}
            onPointerDown={handleHuePointerDown}
            onPointerMove={handleHuePointerMove}
            onPointerUp={stopHueDragging}
            onPointerLeave={stopHueDragging}
            onPointerCancel={stopHueDragging}
          />
          <span className="field-color-hue-cursor" style={{ left: `${hueCursorX}%` }} aria-hidden />
        </div>
      </div>
      <div className="field-color-custom">
        <label className="field-color-custom-label">
          <span className="settings-label">Custom hex</span>
          <span
            className="field-color-preview"
            style={{ backgroundColor: activeColor }}
            aria-hidden
          />
          <input
            type="text"
            className="text-input field-color-hex-input"
            value={hexInput}
            placeholder="#55ea8c"
            spellCheck={false}
            autoComplete="off"
            disabled={!canEdit}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onChange={(event) => {
              setHexInput(event.target.value);
              setHexError(null);
            }}
            onPaste={(event) => {
              event.stopPropagation();
              const text = event.clipboardData?.getData('text');
              if (text == null || text.trim() === '') return;
              event.preventDefault();
              const normalized = normalizeHexColor(text);
              if (!normalized) {
                setHexInput(text.trim());
                setHexError('Enter a hex color like #55ea8c');
                return;
              }
              setHexInput(normalized);
              const next = hexToHsv(normalized);
              if (next) setHsv(next);
              commit(next ?? hsv);
            }}
            onBlur={commitHexInput}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter') {
                event.preventDefault();
                commitHexInput();
              }
            }}
          />
        </label>
        {value ? (
          <button
            type="button"
            className="button button--ghost button--small"
            disabled={!canEdit}
            onClick={() => {
              onChange(undefined);
              const next = hexToHsv(defaultColor);
              if (next) {
                setHsv(next);
                lastAppliedHexRef.current = defaultColor.toLowerCase();
              }
            }}
          >
            Reset
          </button>
        ) : null}
      </div>
      {hexError ? <p className="field-color-hex-error">{hexError}</p> : null}
    </div>
  );
}
