import type { FormStatus } from '@prisma/client';
import { FORM_LIVE_TONE_CLASS, getFormLiveDescriptor } from '@/lib/forms/live-status';

export interface LiveStatusBadgeProps {
  status: FormStatus;
  /** Whether a version is currently reachable by respondents — see
   *  src/lib/forms/live-status.ts for what drives this. */
  isLive: boolean;
}

/** Renders the dot + label live-status indicator (Live / Not live / Archived) used on
 *  both the forms list and the builder header. */
export function LiveStatusBadge({ status, isLive }: LiveStatusBadgeProps) {
  const descriptor = getFormLiveDescriptor({ isLive, isArchived: status === 'archived' });
  return (
    <span className={`live-status ${FORM_LIVE_TONE_CLASS[descriptor.tone]}`}>
      <span className="live-status-dot" aria-hidden="true" />
      {descriptor.label}
    </span>
  );
}
