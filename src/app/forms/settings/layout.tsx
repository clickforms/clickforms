import type { ReactNode } from 'react';
import { SettingsShell } from '@/app/forms/settings/settings-nav';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <SettingsShell>{children}</SettingsShell>;
}
