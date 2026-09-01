'use client';

import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

/** Positions the panel below (or above, if it wouldn't fit) the trigger, escaping any
 * overflow:hidden ancestor via the portal this is paired with — copied from
 * src/app/forms/form-actions-menu.tsx's computePanelStyle, generalized with `align`. */
function computePanelStyle(
  trigger: HTMLElement,
  panel: HTMLElement,
  align: 'start' | 'end',
): CSSProperties {
  const triggerRect = trigger.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const gap = 6;
  const viewportPadding = 8;

  let top = triggerRect.bottom + gap;
  if (top + panelRect.height > window.innerHeight - viewportPadding) {
    const aboveTop = triggerRect.top - panelRect.height - gap;
    top = aboveTop >= viewportPadding ? aboveTop : viewportPadding;
  }

  let left = align === 'end' ? triggerRect.right - panelRect.width : triggerRect.left;
  left = Math.max(
    viewportPadding,
    Math.min(left, window.innerWidth - panelRect.width - viewportPadding),
  );

  return { position: 'fixed', top, left };
}

interface DropdownMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  /** Reuses the forms-list actions menu's panel styling (.actions-menu-panel) by
   *  default — pass a different className to opt out. */
  panelClassName?: string;
  align?: 'start' | 'end';
  children: ReactNode;
}

/** Portal-rendered dropdown panel, positioned relative to an externally-owned trigger
 * button (pass its ref in) — lets callers render whatever trigger markup they need
 * while sharing the positioning/outside-click/escape plumbing. See page-tabs.tsx and
 * builder-more-menu.tsx for the two current callers. */
export function DropdownMenu({
  open,
  onOpenChange,
  triggerRef,
  panelClassName,
  align = 'start',
  children,
}: DropdownMenuProps) {
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const menuId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !panelRef.current) return;
    setPanelStyle(computePanelStyle(triggerRef.current, panelRef.current, align));
  }, [open, align, triggerRef]);

  useEffect(() => {
    if (!open) return;

    function reposition() {
      if (!triggerRef.current || !panelRef.current) return;
      setPanelStyle(computePanelStyle(triggerRef.current, panelRef.current, align));
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      onOpenChange(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    }

    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, align, onOpenChange, triggerRef]);

  useEffect(() => {
    if (open) {
      triggerRef.current?.setAttribute('aria-controls', menuId);
      triggerRef.current?.setAttribute('aria-expanded', 'true');
    } else {
      triggerRef.current?.setAttribute('aria-expanded', 'false');
    }
  }, [open, menuId, triggerRef]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={panelRef}
      id={menuId}
      className={panelClassName ?? 'actions-menu-panel'}
      style={{ ...panelStyle, visibility: panelStyle ? 'visible' : 'hidden' }}
    >
      {children}
    </div>,
    document.body,
  );
}
