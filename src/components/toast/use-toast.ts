'use client';

import { useContext } from 'react';
import { ToastContext } from '@/components/toast/toast-provider';
import type { ToastContextValue } from '@/components/toast/types';

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
