'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import '@/app/admin/insights/insights.css';
import { useToast } from '@/components/toast';

type Status = 'pending' | 'approved' | 'hidden';

export interface ReviewRow {
  id: string;
  name: string;
  company: string;
  role: string | null;
  rating: number | null;
  body: string;
  email: string | null;
  consentToPublish: boolean;
  status: Status;
  createdAt: string;
}

const FILTERS: { value: Status | 'all'; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'all', label: 'All' },
];

export function ReviewsAdminClient({ initialReviews }: { initialReviews: ReviewRow[] }) {
  const toast = useToast();
  const [reviews, setReviews] = useState(initialReviews);
  const [filter, setFilter] = useState<Status | 'all'>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const result = { all: reviews.length, pending: 0, approved: 0, hidden: 0 };
    for (const review of reviews) result[review.status] += 1;
    return result;
  }, [reviews]);

  const visible = filter === 'all' ? reviews : reviews.filter((review) => review.status === filter);

  async function setStatus(id: string, status: Status) {
    setBusyId(id);
    try {
      const response = await fetch(`/api/admin/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Request failed');
      setReviews((current) =>
        current.map((review) => (review.id === id ? { ...review, status } : review)),
      );
      toast.success(
        status === 'approved'
          ? 'Review approved'
          : status === 'hidden'
            ? 'Review hidden'
            : 'Review restored',
      );
    } catch {
      toast.error('Could not update the review. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      const response = await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Request failed');
      setReviews((current) => current.filter((review) => review.id !== id));
      setConfirmDeleteId(null);
      toast.success('Review deleted');
    } catch {
      toast.error('Could not delete the review. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="bo ins">
      <header className="bo-header">
        <div>
          <h1 className="bo-title">Reviews</h1>
          <p className="ins-sub">
            New reviews stay private until you approve them. Approved reviews are the ones you can
            feature.
          </p>
        </div>
        <div className="bo-header-actions">
          <Link href="/admin/insights" className="button button--secondary">
            View insights
          </Link>
        </div>
      </header>

      <nav className="ins-scope" aria-label="Filter reviews by status">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`ins-scope-tab${filter === item.value ? ' ins-scope-tab--active' : ''}`}
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
          >
            {item.label} ({counts[item.value]})
          </button>
        ))}
      </nav>

      <section className="bo-card" aria-label="Reviews">
        {visible.length === 0 ? (
          <p className="bo-empty">
            {filter === 'pending' ? 'Nothing waiting for approval.' : 'No reviews here yet.'}
          </p>
        ) : (
          <ul className="ins-latest ins-mod">
            {visible.map((review) => {
              const busy = busyId === review.id;
              return (
                <li key={review.id}>
                  <div className="ins-latest-head">
                    <span className="ins-latest-name">{review.name}</span>
                    <span className="ins-latest-meta">
                      {review.company}
                      {review.role ? ` · ${review.role}` : ''}
                    </span>
                    <span className={`ins-status ins-status--${review.status}`}>
                      {review.status}
                    </span>
                    {review.rating !== null ? (
                      <span className="ins-avg" title={`${review.rating} out of 5`}>
                        {'★'.repeat(review.rating)}
                        <span className="ins-mod-dim">{'★'.repeat(5 - review.rating)}</span>
                      </span>
                    ) : null}
                    <time className="ins-latest-meta ins-mod-time" dateTime={review.createdAt}>
                      {new Date(review.createdAt).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </time>
                  </div>
                  <p className="ins-mod-body">{review.body}</p>
                  <p className="ins-latest-meta">
                    {review.email ? `${review.email} · ` : ''}
                    {review.consentToPublish
                      ? 'Agreed to be published'
                      : 'Has not agreed to be published'}
                  </p>
                  <div className="ins-mod-actions">
                    {review.status !== 'approved' ? (
                      <button
                        type="button"
                        className="button button--dark button--small"
                        disabled={busy}
                        onClick={() => setStatus(review.id, 'approved')}
                      >
                        Approve
                      </button>
                    ) : null}
                    {review.status === 'hidden' ? (
                      <button
                        type="button"
                        className="button button--secondary button--small"
                        disabled={busy}
                        onClick={() => setStatus(review.id, 'pending')}
                      >
                        Restore to pending
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button button--secondary button--small"
                        disabled={busy}
                        onClick={() => setStatus(review.id, 'hidden')}
                      >
                        Hide
                      </button>
                    )}
                    {confirmDeleteId === review.id ? (
                      <>
                        <button
                          type="button"
                          className="button button--danger button--small"
                          disabled={busy}
                          onClick={() => remove(review.id)}
                        >
                          Delete permanently
                        </button>
                        <button
                          type="button"
                          className="button button--secondary button--small"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="button button--secondary button--small"
                        disabled={busy}
                        onClick={() => setConfirmDeleteId(review.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
