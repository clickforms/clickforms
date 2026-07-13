import { redirect } from 'next/navigation';

export default function SettingsIndexPage() {
  redirect('/forms/settings/user-details');
}
