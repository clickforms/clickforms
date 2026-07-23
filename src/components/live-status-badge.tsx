import {
  FORM_LIVE_TONE_CLASS,
  type FormLiveInput,
  getFormLiveDescriptor,
} from '@/lib/forms/live-status';

/** Renders the dot + label live-status indicator (Live / Live · changes pending /
 *  Draft / Approved · not live / Archived) used on both the forms list and the builder
 *  header — see src/lib/forms/live-status.ts for what drives each state. */
export function LiveStatusBadge(props: FormLiveInput) {
  const descriptor = getFormLiveDescriptor(props);
  return (
    <span
      className={`live-status ${FORM_LIVE_TONE_CLASS[descriptor.tone]}`}
      title={
        descriptor.tone === 'pending'
          ? 'The published version is still live — publish your changes to update it.'
          : undefined
      }
    >
      <span className="live-status-dot" aria-hidden="true" />
      {descriptor.label}
    </span>
  );
}
