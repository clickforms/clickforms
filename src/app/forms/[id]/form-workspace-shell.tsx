'use client';

import type { FormStatus } from '@prisma/client';
import type { ReactNode } from 'react';
import { FormTopNav } from '@/app/forms/[id]/form-top-nav';
import { FormWorkspaceProvider } from '@/app/forms/[id]/form-workspace-context';

interface FormWorkspaceShellProps {
  formId: string;
  formName: string;
  slug: string;
  initialStatus: FormStatus;
  responseCount: number;
  children: ReactNode;
}

export function FormWorkspaceShell({
  formId,
  formName,
  slug,
  initialStatus,
  responseCount,
  children,
}: FormWorkspaceShellProps) {
  return (
    <FormWorkspaceProvider key={formId} initialStatus={initialStatus}>
      <div className="form-workspace">
        <FormTopNav formId={formId} formName={formName} slug={slug} responseCount={responseCount} />
        <div className="form-workspace-content">{children}</div>
      </div>
    </FormWorkspaceProvider>
  );
}
