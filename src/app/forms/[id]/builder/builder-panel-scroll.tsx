'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';

// Native OS scrollbars (especially macOS overlay) ignore CSS width, which is why
// styling ::-webkit-scrollbar never made the Fields panel thumb thinner. This wraps
// the panel body, hides the native bar entirely, and draws a 4px thumb we fully control.

const MIN_THUMB_PX = 24;

export function BuilderPanelScroll({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startScroll: number } | null>(null);
  const [thumb, setThumb] = useState({ top: 0, height: 0, visible: false });

  const updateThumb = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = viewport;
    const overflow = scrollHeight - clientHeight;
    if (overflow <= 1) {
      setThumb({ top: 0, height: 0, visible: false });
      return;
    }

    const height = Math.max(MIN_THUMB_PX, (clientHeight / scrollHeight) * clientHeight);
    const top = (scrollTop / overflow) * (clientHeight - height);
    setThumb({ top, height, visible: true });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport) {
      return;
    }

    updateThumb();
    viewport.addEventListener('scroll', updateThumb, { passive: true });
    const observer = new ResizeObserver(updateThumb);
    observer.observe(viewport);
    if (content) {
      observer.observe(content);
    }

    return () => {
      viewport.removeEventListener('scroll', updateThumb);
      observer.disconnect();
    };
  }, [updateThumb]);

  function handleThumbPointerDown(event: PointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startY: event.clientY, startScroll: viewport.scrollTop };
  }

  function handleThumbPointerMove(event: PointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    const drag = dragRef.current;
    if (!viewport || !drag) {
      return;
    }

    const overflow = viewport.scrollHeight - viewport.clientHeight;
    const moveRange = viewport.clientHeight - thumb.height;
    if (moveRange <= 0) {
      return;
    }

    viewport.scrollTop = drag.startScroll + ((event.clientY - drag.startY) / moveRange) * overflow;
  }

  function handleThumbPointerUp(event: PointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div className="builder-panel-scroll">
      <div className="builder-panel-scroll-viewport" ref={viewportRef}>
        <div className="builder-panel-scroll-content" ref={contentRef}>
          {children}
        </div>
      </div>
      {thumb.visible ? (
        <div className="builder-panel-scroll-track" aria-hidden="true">
          <div
            className="builder-panel-scroll-thumb"
            style={{ height: thumb.height, transform: `translateY(${thumb.top}px)` }}
            onPointerDown={handleThumbPointerDown}
            onPointerMove={handleThumbPointerMove}
            onPointerUp={handleThumbPointerUp}
            onPointerCancel={handleThumbPointerUp}
          />
        </div>
      ) : null}
    </div>
  );
}
