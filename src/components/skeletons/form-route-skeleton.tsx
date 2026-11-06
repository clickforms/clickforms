'use client';

import { usePathname } from 'next/navigation';
import '@/app/forms/[id]/prefills/prefills.css';
import { PageSkeleton } from '@/components/page-skeleton';
import {
  BuilderSkeleton,
  FormSettingsSkeleton,
  type FormTab,
  FormWorkspaceFrameSkeleton,
  PrefillsSkeleton,
  ResponsesSkeleton,
  SubmissionDetailSkeleton,
} from './form-workspace-skeleton';

const FORM_PATH = /^\/forms\/[0-9a-f-]{36}(?:\/([a-z]+))?(?:\/[^/]+)?\/?$/i;

/** Fallback for the `/forms/[id]` layout itself (it awaits the form before rendering the
 * workspace shell, so a route's own loading.tsx can't cover that gap). Picks the matching
 * tab from the URL and draws the shell + that tab's content. Other /forms/* routes without
 * their own loading.tsx get the generic skeleton. */
export function FormsRouteSkeleton() {
  const pathname = usePathname();
  const match = FORM_PATH.exec(pathname);
  if (!match) return <PageSkeleton />;

  const segment = match[1] ?? 'builder';
  const isDetail = segment === 'submissions' && /\/submissions\/[^/]+\/?$/.test(pathname);

  let active: FormTab;
  let content: React.ReactNode;
  switch (segment) {
    case 'submissions':
      active = 'responses';
      content = isDetail ? <SubmissionDetailSkeleton /> : <ResponsesSkeleton />;
      break;
    case 'prefills':
      active = 'prefills';
      content = <PrefillsSkeleton />;
      break;
    case 'settings':
      active = 'settings';
      content = <FormSettingsSkeleton />;
      break;
    default:
      active = 'builder';
      content = <BuilderSkeleton />;
  }
  return <FormWorkspaceFrameSkeleton active={active}>{content}</FormWorkspaceFrameSkeleton>;
}
