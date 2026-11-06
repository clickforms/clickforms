import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton';

// Route group so the dashboard (/forms) gets its own skeleton without it also being the
// fallback for every other /forms/* page — each of those has its own loading.tsx.
export default function Loading() {
  return <DashboardSkeleton />;
}
