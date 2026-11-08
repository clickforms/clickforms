import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { type ReviewRow, ReviewsAdminClient } from '@/app/admin/reviews/reviews-admin-client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const metadata = { title: 'Reviews | Clickforms Admin' };

const REVIEW_LIMIT = 500;

export default async function AdminReviewsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isPlatformAdmin) {
    redirect('/forms');
  }

  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: 'desc' },
    take: REVIEW_LIMIT,
    select: {
      id: true,
      name: true,
      company: true,
      role: true,
      rating: true,
      body: true,
      email: true,
      consentToPublish: true,
      status: true,
      createdAt: true,
    },
  });

  const rows: ReviewRow[] = reviews.map((review) => ({
    ...review,
    createdAt: review.createdAt.toISOString(),
  }));

  return <ReviewsAdminClient initialReviews={rows} />;
}
