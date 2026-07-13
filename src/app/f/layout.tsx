import type { ReactNode } from 'react';

export default function PublicFormLayout({ children }: { children: ReactNode }) {
  return <div className="public-form-layout">{children}</div>;
}
