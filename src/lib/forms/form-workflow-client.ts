import type { FormStatus } from '@prisma/client';
import { extractApiError } from '@/lib/error-message';

export type FormWorkflowAction = 'approve' | 'publish' | 'unpublish' | 'revert-to-draft';

export interface FormWorkflowResult {
  form: { id: string; status: string };
  version?: { id: string; versionNumber: number; publishedAt: string | Date | null };
}

export interface WorkflowStep {
  action: FormWorkflowAction;
  label: string;
  busyLabel: string;
}

/** Primary list/builder action for each form status in the draft → approved → published flow. */
export function getWorkflowStepForStatus(status: FormStatus): WorkflowStep | null {
  switch (status) {
    case 'draft':
      return { action: 'approve', label: 'Approve', busyLabel: 'Approving…' };
    case 'approved':
      return { action: 'publish', label: 'Publish', busyLabel: 'Publishing…' };
    case 'published':
      return { action: 'unpublish', label: 'Unpublish', busyLabel: 'Unpublishing…' };
    default:
      return null;
  }
}

const ACTION_PATH: Record<FormWorkflowAction, string> = {
  approve: 'approve',
  publish: 'publish',
  unpublish: 'unpublish',
  'revert-to-draft': 'revert-to-draft',
};

export async function runFormWorkflow(
  formId: string,
  action: FormWorkflowAction,
): Promise<FormWorkflowResult> {
  const response = await fetch(`/api/forms/${formId}/${ACTION_PATH[action]}`, { method: 'POST' });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractApiError(body, `Failed to ${action.replace('-', ' ')} form`));
  }
  return body as FormWorkflowResult;
}
