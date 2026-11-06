import { SettingsSkeleton } from '@/components/skeletons/settings-skeleton';

export default function Loading() {
  return (
    <SettingsSkeleton
      title="Two-factor authentication"
      lead="Add an extra layer of security when you sign in."
      cardTitle="Email verification code"
      cardIntro="When you sign in, we email a 6-digit code to your account email. You enter it after your password."
      variant="method"
    />
  );
}
