import { SettingsSkeleton } from '@/components/skeletons/settings-skeleton';

export default function Loading() {
  return (
    <SettingsSkeleton
      title="Change password"
      lead="Update your password to keep your account secure."
      cardTitle="Change password"
      cardIntro="Choose a strong password you don't use anywhere else."
      rows={[
        { label: 'Current password' },
        { label: 'New password', hint: true },
        { label: 'Confirm new password' },
      ]}
      actionNote="You'll stay signed in on this device."
      actionLabelWidth={140}
    />
  );
}
