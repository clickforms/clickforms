'use client';

import { type FormEvent, useId, useLayoutEffect, useRef, useState } from 'react';
import { REVIEW_BODY_MAX, REVIEW_BODY_MIN } from '@/lib/reviews/schema';

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
      <title>Star</title>
      <path
        d="m12 2.8 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1L3.2 9.3l6.1-.9L12 2.8Z"
        fill={filled ? '#f7b928' : 'none'}
        stroke={filled ? '#f7b928' : '#c9cce0'}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const RATING_LABELS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'] as const;

export function ReviewForm() {
  const ids = useId();
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [body, setBody] = useState('');
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [role, setRole] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);

  // The review box grows with what is typed (up to the CSS max-height, then it scrolls), and can
  // also be dragged larger by hand.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure whenever the text changes
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [body]);
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const shownRating = hoverRating ?? rating ?? 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);

    if (!name.trim()) return setError('Please enter your full name.');
    if (!company.trim()) return setError('Please enter your company or organisation.');
    if (body.trim().length < REVIEW_BODY_MIN) {
      return setError(`Please write at least ${REVIEW_BODY_MIN} characters in your review.`);
    }
    if (!consent) return setError('Please tick the box so we know we can publish your review.');

    setSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          company,
          body,
          role,
          rating,
          email,
          consent,
          website,
        }),
      });
      if (!res.ok) {
        const data: { error?: string } | null = await res.json().catch(() => null);
        setError(data?.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setSent(true);
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="rv-card rv-card--done" role="status">
        <span className="rv-done-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
            <title>Review sent</title>
            <path
              d="m5 12.5 4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h2>Thank you, {name.trim().split(' ')[0]}!</h2>
        <p>
          Your review is with our team. We read every one, and we&rsquo;ll only share it once
          we&rsquo;ve checked it. You can ask us to remove it at any time.
        </p>
      </div>
    );
  }

  return (
    <form className="rv-card" onSubmit={handleSubmit} noValidate>
      <div className="rv-field">
        <label htmlFor={`${ids}-name`}>Full name</label>
        <input
          id={`${ids}-name`}
          className="rv-input"
          type="text"
          autoComplete="name"
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={submitting}
        />
      </div>

      <div className="rv-field">
        <label htmlFor={`${ids}-company`}>Company or organisation</label>
        <input
          id={`${ids}-company`}
          className="rv-input"
          type="text"
          autoComplete="organization"
          maxLength={160}
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          disabled={submitting}
        />
      </div>

      <div className="rv-field">
        <label htmlFor={`${ids}-body`}>Your review</label>
        <textarea
          id={`${ids}-body`}
          className="rv-input rv-textarea"
          rows={5}
          ref={bodyRef}
          maxLength={REVIEW_BODY_MAX}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          disabled={submitting}
        />
        <span className="rv-count" aria-live="off">
          {body.length}/{REVIEW_BODY_MAX}
        </span>
      </div>

      <div className="rv-field">
        <div className="rv-label-row">
          <label htmlFor={`${ids}-role`}>Your role</label>
          <span className="rv-optional">Optional</span>
        </div>
        <input
          id={`${ids}-role`}
          className="rv-input"
          type="text"
          autoComplete="organization-title"
          maxLength={120}
          value={role}
          onChange={(event) => setRole(event.target.value)}
          disabled={submitting}
        />
      </div>

      <fieldset className="rv-field rv-rating" disabled={submitting}>
        <legend className="rv-label-row">
          <span>Rating</span>
          <span className="rv-optional">Optional</span>
        </legend>
        <div className="rv-stars">
          {RATING_LABELS.map((label, index) => {
            const value = index + 1;
            return (
              <label
                key={label}
                className="rv-star"
                onMouseEnter={() => setHoverRating(value)}
                onMouseLeave={() => setHoverRating(null)}
              >
                <input
                  type="radio"
                  name={`${ids}-rating`}
                  className="rv-sr"
                  checked={rating === value}
                  aria-label={`${value} ${value === 1 ? 'star' : 'stars'}, ${label}`}
                  onChange={() => setRating(value)}
                  onClick={() => {
                    // Clicking the selected star again clears the optional rating.
                    if (rating === value) setRating(null);
                  }}
                  onFocus={() => setHoverRating(value)}
                  onBlur={() => setHoverRating(null)}
                />
                <Star filled={value <= shownRating} />
              </label>
            );
          })}
          <span className="rv-rating-label" aria-live="polite">
            {shownRating > 0 ? RATING_LABELS[shownRating - 1] : ''}
          </span>
        </div>
      </fieldset>

      <div className="rv-field">
        <div className="rv-label-row">
          <label htmlFor={`${ids}-email`}>Email</label>
          <span className="rv-optional">Optional</span>
        </div>
        <input
          id={`${ids}-email`}
          className="rv-input"
          type="email"
          autoComplete="email"
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={submitting}
        />
        <p className="rv-hint">Only used if we need to check a detail with you. Never published.</p>
      </div>

      {/* Honeypot: hidden from people, tempting to bots. */}
      <div className="rv-trap" aria-hidden="true">
        <label htmlFor={`${ids}-website`}>Website</label>
        <input
          id={`${ids}-website`}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      <label className="rv-consent">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          disabled={submitting}
        />
        <span>
          I agree to Clickforms publishing my name, company, role and review on its website and
          social media. I can ask for it to be removed at any time.
        </span>
      </label>

      {error ? (
        <p className="rv-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="rv-submit" disabled={submitting}>
        {submitting ? (
          'Sending…'
        ) : (
          <>
            Send my review
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
              <path
                d="M4 10h11m-4.5-5L15 10l-4.5 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </>
        )}
      </button>
    </form>
  );
}
