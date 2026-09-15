import type { FormStatus } from '@prisma/client';
import { extractApiError } from '@/lib/error-message';

export type FormWorkflowAction = 'publish' | 'unpublish';

export interface FormWorkflowResult {
  form: { id: string; status: string; currentVersionId: string | null };
  version?: { id: string; versionNumber: number; publishedAt: string | Date | null };
}

export interface WorkflowStep {
  action: FormWorkflowAction;
  label: string;
  busyLabel: string;
}

/** The only forward workflow action left: a draft form can be published. Live forms have
 *  no ladder button — "Take offline" (and "Edit form", which performs the same
 *  transition) are the only ways to change a published form's state now. */
export function getWorkflowStepForStatus(status: FormStatus): WorkflowStep | null {
  if (status === 'draft') {
    return { action: 'publish', label: 'Publish', busyLabel: 'Publishing…' };
  }
  return null;
}

const ACTION_PATH: Record<FormWorkflowAction, string> = {
  publish: 'publish',
  unpublish: 'unpublish',
};

export async function runFormWorkflow(
  formId: string,
  action: FormWorkflowAction,
  body?: Record<string, unknown>,
): Promise<FormWorkflowResult> {
  const response = await fetch(`/api/forms/${formId}/${ACTION_PATH[action]}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const responseBody = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractApiError(responseBody, `Failed to ${action} form`));
  }
  return responseBody as FormWorkflowResult;
}
