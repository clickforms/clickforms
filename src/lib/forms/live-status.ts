import type { FormStatus } from '@prisma/client';

export type FormLiveTone = 'live' | 'pending' | 'draft' | 'approved' | 'archived';

export interface FormLiveDescriptor {
  tone: FormLiveTone;
  label: string;
}

export interface FormLiveInput {
  status: FormStatus;
  /** Whether a version is currently reachable by respondents — driven by
   *  `Form.currentVersionId`, not `status` (see public-lookup.ts). */
  isLive: boolean;
  /** Whether the version being edited has diverged from what's live, i.e. there are
   *  changes waiting to be published. Only meaningful when `isLive` is true. */
  hasPendingChanges: boolean;
}

/**
 * Describes whether a form is currently reachable by respondents, and whether there's a
 * newer draft waiting to replace what's live — combining `Form.status` (the
 * draft → approved → published approval pipeline for whichever version is being edited)
 * with `isLive`/`hasPendingChanges` (derived from `currentVersionId` vs. the latest
 * version).
 *
 * These two dimensions used to be conflated: editing a live form reset `status` to
 * 'draft', which read as "nothing is live" even though the previously-published version
 * kept serving respondents right up until someone chose to take it offline. `status`
 * alone can no longer answer "is this live" — this combines both so the UI always tells
 * the truth.
 */
export function getFormLiveDescriptor({
  status,
  isLive,
  hasPendingChanges,
}: FormLiveInput): FormLiveDescriptor {
  if (status === 'archived') {
    return { tone: 'archived', label: 'Archived' };
  }
  if (!isLive) {
    return status === 'approved'
      ? { tone: 'approved', label: 'Approved · not live' }
      : { tone: 'draft', label: 'Draft' };
  }
  if (hasPendingChanges) {
    return { tone: 'pending', label: 'Live · changes pending' };
  }
  return { tone: 'live', label: 'Live' };
}

export const FORM_LIVE_TONE_CLASS: Record<FormLiveTone, string> = {
  live: 'live-status--live',
  pending: 'live-status--pending',
  draft: 'live-status--draft',
  approved: 'live-status--approved',
  archived: 'live-status--archived',
};
