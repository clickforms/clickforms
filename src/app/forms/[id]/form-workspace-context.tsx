'use client';

import type { FormStatus } from '@prisma/client';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

interface FormWorkspaceContextValue {
  status: FormStatus;
  setStatus: (status: FormStatus) => void;
  /** Whether the form currently has a live, publicly-reachable version — kept here
   *  (rather than only inside the builder) so FormTopNav can show the Live/Draft badge
   *  in the top row without the builder page being the one to render it. The builder
   *  is still the sole writer, via syncLiveState below; every other consumer just reads. */
  isLive: boolean;
  /** True while the builder's canvas has local schema edits that haven't been saved yet
   *  (see builder-client.tsx's Edit/Save/Cancel flow — there's no autosave). FormTopNav
   *  reads this to warn before switching to Responses/Settings mid-edit. */
  hasUnsavedChanges: boolean;
  syncLiveState: (next: { isLive: boolean; hasUnsavedChanges: boolean }) => void;
}

const FormWorkspaceContext = createContext<FormWorkspaceContextValue | null>(null);

export function FormWorkspaceProvider({
  initialStatus,
  children,
}: {
  initialStatus: FormStatus;
  children: ReactNode;
}) {
  const [status, setStatusState] = useState(initialStatus);
  const [liveState, setLiveState] = useState({ isLive: false, hasUnsavedChanges: false });

  const setStatus = useCallback((next: FormStatus) => {
    setStatusState(next);
  }, []);

  const syncLiveState = useCallback((next: { isLive: boolean; hasUnsavedChanges: boolean }) => {
    setLiveState((prev) =>
      prev.isLive === next.isLive && prev.hasUnsavedChanges === next.hasUnsavedChanges
        ? prev
        : next,
    );
  }, []);

  const value = useMemo(
    () => ({ status, setStatus, ...liveState, syncLiveState }),
    [status, setStatus, liveState, syncLiveState],
  );

  return <FormWorkspaceContext.Provider value={value}>{children}</FormWorkspaceContext.Provider>;
}

export function useFormWorkspaceStatus(): FormWorkspaceContextValue {
  const context = useContext(FormWorkspaceContext);
  if (!context) {
    throw new Error('useFormWorkspaceStatus must be used within FormWorkspaceProvider');
  }
  return context;
}
