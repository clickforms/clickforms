export type FormLiveTone = 'live' | 'draft' | 'archived';

export interface FormLiveDescriptor {
  tone: FormLiveTone;
  label: string;
}

export interface FormLiveInput {
  /** Whether a version is currently reachable by respondents — driven by
   *  `Form.currentVersionId`, not `status` (see public-lookup.ts). */
  isLive: boolean;
  /** True once a form has been archived — takes precedence over isLive. */
  isArchived: boolean;
}

/** Describes whether a form is currently reachable by respondents. Only three real
 *  outcomes now that editing a live form requires explicitly taking it offline first
 *  (see form-workflow.ts's unpublishForm) — there's no more "live with an unpublished
 *  draft sitting behind it" state to represent. */
export function getFormLiveDescriptor({ isLive, isArchived }: FormLiveInput): FormLiveDescriptor {
  if (isArchived) {
    return { tone: 'archived', label: 'Archived' };
  }
  if (isLive) {
    return { tone: 'live', label: 'Live' };
  }
  return { tone: 'draft', label: 'Not live' };
}

export const FORM_LIVE_TONE_CLASS: Record<FormLiveTone, string> = {
  live: 'live-status--live',
  draft: 'live-status--draft',
  archived: 'live-status--archived',
};
