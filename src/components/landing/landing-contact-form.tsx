'use client';

import { type FormEvent, useState } from 'react';

const CONTACT_EMAIL = 'admin@clickforms.com.au';

/**
 * No contact/support API endpoint exists yet, so this composes a mailto: link from the
 * fields and hands off to the visitor's own email client rather than silently failing
 * against a backend that was never built.
 */
export function LandingContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const subject = `Message from ${name || 'the Clickforms website'}`;
    const body = `${message}\n\n— ${name}${email ? ` (${email})` : ''}`;
    const mailtoUrl = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  }

  return (
    <form className="landing-contact-form" onSubmit={handleSubmit}>
      <div className="landing-form-field">
        <label htmlFor="contact-name">Name</label>
        <input
          id="contact-name"
          name="name"
          type="text"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="landing-form-field">
        <label htmlFor="contact-email">Email</label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="landing-form-field">
        <label htmlFor="contact-message">Message</label>
        <textarea
          id="contact-message"
          name="message"
          required
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>
      <button type="submit" className="landing-btn landing-btn--primary landing-btn--lg">
        Send message
      </button>
      <p className="landing-contact-form-note">
        Opens your email client with this addressed to {CONTACT_EMAIL}.
      </p>
    </form>
  );
}
