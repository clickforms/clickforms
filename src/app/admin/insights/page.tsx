import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import '@/app/admin/insights/insights.css';
import { startOfCurrentMonth } from '@/lib/admin/plan-limits';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  fillMonths,
  type GroupStat,
  groupReviews,
  type MonthPoint,
  summarizeRatings,
} from '@/lib/reviews/stats';

export const metadata = { title: 'Insights | Clickforms Admin' };

type Scope = 'all' | 'approved';

const NUMBER = new Intl.NumberFormat('en-AU');

function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" className={className}>
      <title>Star</title>
      <path
        d="m12 2.8 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1L3.2 9.3l6.1-.9L12 2.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function monthCounts(rows: { month: string; count: number }[]): Map<string, number> {
  return new Map(rows.map((row) => [row.month, row.count]));
}

function ColumnChart({ points, label }: { points: MonthPoint[]; label: string }) {
  const max = Math.max(1, ...points.map((point) => point.count));
  return (
    <ul className="ins-chart" aria-label={label}>
      {points.map((point) => (
        <li key={point.month} className="ins-chart-col">
          <span className="ins-chart-value">{NUMBER.format(point.count)}</span>
          <span className="ins-chart-track">
            <span
              className="ins-chart-bar"
              style={{ height: `${Math.max(point.count > 0 ? 6 : 0, (point.count / max) * 100)}%` }}
            />
          </span>
          <span className="ins-chart-label">{point.label}</span>
        </li>
      ))}
    </ul>
  );
}

function GroupList({ rows, empty }: { rows: GroupStat[]; empty: string }) {
  if (rows.length === 0) return <p className="bo-empty">{empty}</p>;
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <ul className="ins-groups">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="ins-group-head">
            <span className="ins-group-name">{row.label}</span>
            <span className="ins-group-meta">
              {row.average !== null ? (
                <span className="ins-avg">
                  <Star className="ins-avg-star" />
                  {row.average.toFixed(1)}
                </span>
              ) : null}
              <span>
                {row.count} {row.count === 1 ? 'review' : 'reviews'}
              </span>
            </span>
          </div>
          <div className="bo-bar">
            <div className="bo-bar-fill" style={{ width: `${(row.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function AdminInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isPlatformAdmin) {
    redirect('/forms');
  }

  const scope: Scope = (await searchParams).scope === 'approved' ? 'approved' : 'all';
  const now = new Date();
  const monthStart = startOfCurrentMonth();
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

  const [
    submittedTotal,
    submittedThisMonth,
    inProgress,
    submissionMonths,
    reviewRows,
    reviewMonths,
    latest,
  ] = await Promise.all([
    prisma.submission.count({ where: { submittedAt: { not: null } } }),
    prisma.submission.count({ where: { submittedAt: { gte: monthStart } } }),
    prisma.submission.count({ where: { submittedAt: null } }),
    prisma.$queryRaw<{ month: string; count: number }[]>`
      SELECT to_char(date_trunc('month', submitted_at), 'YYYY-MM') AS month, count(*)::int AS count
      FROM submissions
      WHERE submitted_at IS NOT NULL AND submitted_at >= ${sixMonthsAgo}
      GROUP BY 1`,
    prisma.review.findMany({
      select: { company: true, role: true, rating: true, status: true },
    }),
    prisma.$queryRaw<{ month: string; count: number }[]>`
      SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, count(*)::int AS count
      FROM reviews
      WHERE created_at >= ${sixMonthsAgo}
      GROUP BY 1`,
    prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        company: true,
        role: true,
        rating: true,
        body: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  const counts = {
    all: reviewRows.length,
    pending: reviewRows.filter((row) => row.status === 'pending').length,
    approved: reviewRows.filter((row) => row.status === 'approved').length,
    hidden: reviewRows.filter((row) => row.status === 'hidden').length,
  };
  // "All" counts everything people sent except reviews an admin has hidden as unsuitable.
  const scoped = reviewRows.filter((row) =>
    scope === 'approved' ? row.status === 'approved' : row.status !== 'hidden',
  );
  const ratings = summarizeRatings(scoped.map((row) => row.rating));
  const maxStars = Math.max(1, ...ratings.distribution);
  const submissionPoints = fillMonths(monthCounts(submissionMonths), now);
  const reviewPoints = fillMonths(monthCounts(reviewMonths), now);
  const byRole = groupReviews(scoped, 'role');
  const byCompany = groupReviews(scoped, 'company');

  return (
    <div className="bo ins">
      <header className="bo-header">
        <div>
          <h1 className="bo-title">Insights</h1>
          <p className="ins-sub">Submissions across every organisation, and what customers say.</p>
        </div>
        <div className="bo-header-actions">
          <Link href="/admin/reviews" className="button button--dark">
            Manage reviews
            {counts.pending > 0 ? <span className="ins-pill">{counts.pending}</span> : null}
          </Link>
        </div>
      </header>

      <section className="bo-kpis" aria-label="Summary">
        <article className="bo-kpi">
          <span className="bo-kpi-icon bo-kpi-icon--green">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
              <title>Submissions</title>
              <path
                d="M5 3h7l3 3v11H5V3Zm7 0v3h3M8 10h4M8 13h4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div>
            <p className="bo-kpi-label">Form submissions</p>
            <p className="bo-kpi-value">{NUMBER.format(submittedTotal)}</p>
            <p className="bo-kpi-note">
              {NUMBER.format(submittedThisMonth)} this month · {NUMBER.format(inProgress)} in
              progress
            </p>
          </div>
        </article>
        <article className="bo-kpi">
          <span className="bo-kpi-icon bo-kpi-icon--blue">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
              <title>Reviews</title>
              <path
                d="M3 4h14v9H8l-4 3v-3H3V4Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div>
            <p className="bo-kpi-label">Reviews received</p>
            <p className="bo-kpi-value">{NUMBER.format(counts.all)}</p>
            <p className="bo-kpi-note">
              {counts.pending > 0 ? `${counts.pending} awaiting approval` : 'All reviewed'}
            </p>
          </div>
        </article>
        <article className="bo-kpi">
          <span className="bo-kpi-icon bo-kpi-icon--amber">
            <Star className="ins-kpi-star" />
          </span>
          <div>
            <p className="bo-kpi-label">Average rating</p>
            <p className="bo-kpi-value">
              {ratings.average !== null ? ratings.average.toFixed(1) : '–'}
              <span className="ins-kpi-unit"> / 5</span>
            </p>
            <p className="bo-kpi-note">
              {ratings.rated > 0
                ? `from ${NUMBER.format(ratings.rated)} rated ${ratings.rated === 1 ? 'review' : 'reviews'}`
                : 'No ratings yet'}
            </p>
          </div>
        </article>
        <article className="bo-kpi">
          <span className="bo-kpi-icon bo-kpi-icon--green">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
              <title>Approved</title>
              <path
                d="m4.5 10.5 3.5 3.5 7.5-8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div>
            <p className="bo-kpi-label">Approved to feature</p>
            <p className="bo-kpi-value">{NUMBER.format(counts.approved)}</p>
            <p className="bo-kpi-note">{NUMBER.format(counts.hidden)} hidden</p>
          </div>
        </article>
      </section>

      <nav className="ins-scope" aria-label="Which reviews to count">
        <span className="ins-scope-label">Review statistics for</span>
        <Link
          href="/admin/insights"
          className={`ins-scope-tab${scope === 'all' ? ' ins-scope-tab--active' : ''}`}
          aria-current={scope === 'all' ? 'true' : undefined}
        >
          All reviews
        </Link>
        <Link
          href="/admin/insights?scope=approved"
          className={`ins-scope-tab${scope === 'approved' ? ' ins-scope-tab--active' : ''}`}
          aria-current={scope === 'approved' ? 'true' : undefined}
        >
          Approved only
        </Link>
      </nav>

      <div className="bo-insights">
        <section className="bo-card" aria-label="Rating breakdown">
          <header className="bo-card-head">
            <h2>Rating breakdown</h2>
            <span className="bo-card-meta">{ratings.rated} rated</span>
          </header>
          {ratings.rated === 0 ? (
            <p className="bo-empty">No star ratings yet.</p>
          ) : (
            <ul className="ins-stars-list">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = ratings.distribution[stars - 1] ?? 0;
                return (
                  <li key={stars}>
                    <span className="ins-stars-label">
                      {stars}
                      <Star className="ins-avg-star" />
                    </span>
                    <div className="bo-bar">
                      <div
                        className="bo-bar-fill ins-bar-gold"
                        style={{ width: `${(count / maxStars) * 100}%` }}
                      />
                    </div>
                    <span className="ins-stars-count">
                      {count}
                      <span className="ins-stars-pct">
                        {' '}
                        · {Math.round((count / ratings.rated) * 100)}%
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="bo-card" aria-label="Submissions by month">
          <header className="bo-card-head">
            <h2>Submissions by month</h2>
            <span className="bo-card-meta">Last 6 months</span>
          </header>
          <ColumnChart points={submissionPoints} label="Form submissions per month" />
        </section>

        <section className="bo-card" aria-label="Reviews by month">
          <header className="bo-card-head">
            <h2>Reviews by month</h2>
            <span className="bo-card-meta">Last 6 months</span>
          </header>
          <ColumnChart points={reviewPoints} label="Reviews per month" />
        </section>
      </div>

      <div className="ins-two">
        <section className="bo-card" aria-label="Reviews by role">
          <header className="bo-card-head">
            <h2>By role</h2>
            <span className="bo-card-meta">Count and average stars</span>
          </header>
          <GroupList rows={byRole} empty="No reviews yet." />
        </section>
        <section className="bo-card" aria-label="Reviews by company">
          <header className="bo-card-head">
            <h2>By company</h2>
            <span className="bo-card-meta">Top 8</span>
          </header>
          <GroupList rows={byCompany} empty="No reviews yet." />
        </section>
      </div>

      <section className="bo-card" aria-label="Latest reviews">
        <header className="bo-card-head">
          <h2>Latest reviews</h2>
          <Link href="/admin/reviews" className="bo-card-link">
            See all
          </Link>
        </header>
        {latest.length === 0 ? (
          <p className="bo-empty">
            Nothing yet. Share the <strong>/review</strong> link with customers to start collecting.
          </p>
        ) : (
          <ul className="ins-latest">
            {latest.map((review) => (
              <li key={review.id}>
                <div className="ins-latest-head">
                  <span className="ins-latest-name">{review.name}</span>
                  <span className="ins-latest-meta">
                    {review.company}
                    {review.role ? ` · ${review.role}` : ''}
                  </span>
                  <span className={`ins-status ins-status--${review.status}`}>{review.status}</span>
                  {review.rating !== null ? (
                    <span className="ins-avg">
                      <Star className="ins-avg-star" />
                      {review.rating}
                    </span>
                  ) : null}
                </div>
                <p className="ins-latest-body">{review.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
