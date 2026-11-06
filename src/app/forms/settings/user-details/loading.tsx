import { SettingsSkeleton } from '@/components/skeletons/settings-skeleton';

export default function Loading() {
  return (
    <SettingsSkeleton
      title="Account settings"
      lead="Keep the details your team uses to identify and contact you up to date."
      cardTitle="Contact details"
      cardIntro="Update the details your team uses to recognise and contact you. Your email is managed by your organisation."
      rows={[{ label: 'Full name' }, { label: 'Phone' }, { label: 'Email address' }]}
      actionNote="Changes are saved to your profile immediately."
      actionLabelWidth={120}
    />
  );
}
