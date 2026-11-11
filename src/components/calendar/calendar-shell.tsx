'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import './calendar-shell.css';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function Chevron({ direction }: { direction: 'left' | 'right' | 'down' | 'up' }) {
  const d = {
    left: 'M11 4l-5 5 5 5',
    right: 'M7 4l5 5-5 5',
    down: 'M4 7l5 5 5-5',
    up: 'M4 11l5-5 5 5',
  }[direction];
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Shared calendar chrome: a "Month YYYY" header button that swaps the day grid for a
 * scrollable year grid (so jumping decades is two clicks), plus previous/next month arrows.
 * The day grid itself is passed as children (a react-day-picker with its own caption/nav
 * hidden), so single-date and range pickers both use it.
 */
export function CalendarShell({
  month,
  onMonthChange,
  startMonth,
  endMonth,
  children,
}: {
  month: Date;
  onMonthChange: (month: Date) => void;
  startMonth: Date;
  endMonth: Date;
  children: ReactNode;
}) {
  const [yearView, setYearView] = useState(false);
  const selectedYearRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // Size of the day grid when the year grid opens: the year grid takes exactly the same
  // space, so the popover never resizes (and never jumps) when switching views.
  const [locked, setLocked] = useState<{ width: number; height: number } | null>(null);

  const firstYear = startMonth.getFullYear();
  const lastYear = endMonth.getFullYear();
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);

  const prevDisabled =
    month.getFullYear() === firstYear && month.getMonth() <= startMonth.getMonth();
  const nextDisabled = month.getFullYear() === lastYear && month.getMonth() >= endMonth.getMonth();

  useEffect(() => {
    const grid = selectedYearRef.current?.parentElement;
    if (yearView && grid && selectedYearRef.current) {
      grid.scrollTop =
        selectedYearRef.current.offsetTop -
        grid.clientHeight / 2 +
        selectedYearRef.current.offsetHeight / 2;
    }
  }, [yearView]);

  function step(delta: number) {
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  }

  function pickYear(year: number) {
    onMonthChange(new Date(year, month.getMonth(), 1));
    setYearView(false);
  }

  return (
    <div className="calendar-shell">
      <div className="calendar-shell-header">
        <button
          type="button"
          className="calendar-shell-label"
          aria-expanded={yearView}
          aria-label={`${MONTHS[month.getMonth()]} ${month.getFullYear()}, choose year`}
          onClick={() => {
            if (!yearView && bodyRef.current) {
              setLocked({
                width: bodyRef.current.offsetWidth,
                height: bodyRef.current.offsetHeight,
              });
            }
            setYearView((current) => !current);
          }}
        >
          {MONTHS[month.getMonth()]} {month.getFullYear()}
          <Chevron direction={yearView ? 'up' : 'down'} />
        </button>
        {yearView ? null : (
          <div className="calendar-shell-arrows">
            <button
              type="button"
              className="calendar-shell-arrow"
              aria-label="Previous month"
              disabled={prevDisabled}
              onClick={() => step(-1)}
            >
              <Chevron direction="left" />
            </button>
            <button
              type="button"
              className="calendar-shell-arrow"
              aria-label="Next month"
              disabled={nextDisabled}
              onClick={() => step(1)}
            >
              <Chevron direction="right" />
            </button>
          </div>
        )}
      </div>
      <div ref={bodyRef}>
        {yearView ? (
          <div
            className="calendar-shell-years"
            role="listbox"
            aria-label="Choose year"
            style={locked ? { width: locked.width, height: locked.height } : undefined}
          >
            {years.map((year) => {
              const selected = year === month.getFullYear();
              return (
                <button
                  key={year}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  ref={selected ? selectedYearRef : undefined}
                  className={`calendar-shell-year${selected ? ' calendar-shell-year--selected' : ''}`}
                  onClick={() => pickYear(year)}
                >
                  {year}
                </button>
              );
            })}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
