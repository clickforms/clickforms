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
  /** Absolute public URL on the org's subdomain (e.g. https://acme.clickforms.com.au/f/slug)
   *  — used by FormTopNav's Share button, which lives here rather than per-tab since it's
   *  the same link regardless of which tab (Builder/Responses/Settings) is active. */
  publicUrl: string;
  /** Display name of the signed-in builder — used only for the Share panel's
   *  send-via-email/SMS preview text (see FormTopNav). */
  senderName: string;
  children: ReactNode;
}

export function FormWorkspaceShell({
  formId,
  formName,
  slug,
  initialStatus,
  responseCount,
  publicUrl,
  senderName,
  children,
}: FormWorkspaceShellProps) {
  return (
    <FormWorkspaceProvider key={formId} initialStatus={initialStatus}>
      <div className="form-workspace">
        <FormTopNav
          formId={formId}
          formName={formName}
          slug={slug}
          responseCount={responseCount}
          publicUrl={publicUrl}
          senderName={senderName}
        />
        <div className="form-workspace-content">{children}</div>
      </div>
    </FormWorkspaceProvider>
  );
}
