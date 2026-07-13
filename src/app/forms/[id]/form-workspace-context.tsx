'use client';

import type { FormStatus } from '@prisma/client';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

interface FormWorkspaceContextValue {
  status: FormStatus;
  setStatus: (status: FormStatus) => void;
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

  const setStatus = useCallback((next: FormStatus) => {
    setStatusState(next);
  }, []);

  const value = useMemo(() => ({ status, setStatus }), [status, setStatus]);

  return <FormWorkspaceContext.Provider value={value}>{children}</FormWorkspaceContext.Provider>;
}

export function useFormWorkspaceStatus(): FormWorkspaceContextValue {
  const context = useContext(FormWorkspaceContext);
  if (!context) {
    throw new Error('useFormWorkspaceStatus must be used within FormWorkspaceProvider');
  }
  return context;
}
