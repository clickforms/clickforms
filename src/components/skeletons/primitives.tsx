import type { CSSProperties, ReactNode } from 'react';
import './skeleton.css';

type Size = number | string;

/** [0, 1, … n-1] — iterate this (by value) for static placeholder lists so keys are stable. */
export function range(count: number): number[] {
  return Array.from({ length: count }, (_, value) => value);
}

function toCss(value: Size | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

interface SkProps {
  w?: Size;
  h?: Size;
  /** Border radius; defaults to a soft 6px. Use "pill" or "circle" for the common shapes. */
  r?: Size | 'pill' | 'circle';
  inline?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** One shimmering placeholder shape. Compose these inside the *real* page containers so
 * spacing, borders and backgrounds are identical to the loaded page. */
export function Sk({ w, h = '0.8rem', r, inline, className, style }: SkProps) {
  const radius = r === 'pill' ? '999px' : r === 'circle' ? '50%' : toCss(r);
  return (
    <span
      className={`sk${inline ? ' sk--inline' : ''}${className ? ` ${className}` : ''}`}
      style={{ width: toCss(w) ?? '100%', height: toCss(h), borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

/** A stack of text-line placeholders; the last line is shorter, like a real paragraph. */
export function SkLines({
  lines = 2,
  h = '0.7rem',
  gap = '0.5rem',
  lastWidth = '62%',
}: {
  lines?: number;
  h?: Size;
  gap?: Size;
  lastWidth?: Size;
}) {
  return (
    <span className="sk-lines" style={{ gap: toCss(gap) }} aria-hidden="true">
      {range(lines).map((line) => (
        <Sk key={line} h={h} w={line === lines - 1 && lines > 1 ? lastWidth : '100%'} />
      ))}
    </span>
  );
}

/** Wraps a whole page skeleton: announces loading to assistive tech once. */
export function SkRegion({
  children,
  label = 'Loading…',
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div aria-busy="true" aria-live="polite" className="sk-region">
      <span className="sk-sr">{label}</span>
      {children}
    </div>
  );
}
