'use client';

import { type FormEvent, useState } from 'react';
import { UploadIcon } from '@/components/landing/landing-icons';

const CONTACT_EMAIL = 'admin@clickforms.com.au';

const CONCERN_TYPES = [
  'General inquiry',
  'Billing',
  'Technical support',
  'Feature request',
  'Other',
] as const;

/**
 * No contact/support API endpoint exists yet, so this composes a mailto: link from the
 * fields and hands off to the visitor's own email client rather than silently failing
 * against a backend that was never built. A file can be picked in the browser, but mailto
 * can't carry an attachment — the filename is included as a reminder to attach it by hand.
 */
export function LandingContactForm() {
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [concern, setConcern] = useState('');
  const [description, setDescription] = useState('');
  const [fileName, setFileName] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
    const subject = `${concern || 'Message'} from ${fullName || 'the Clickforms website'}`;
    const bodyLines = [
      description,
      '',
      `— ${fullName}`,
      email ? `Email: ${email}` : null,
      phone ? `Phone: +61 ${phone}` : null,
      fileName ? `Please remember to attach: ${fileName}` : null,
    ].filter((line): line is string => line !== null);
    const mailtoUrl = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;
    window.location.href = mailtoUrl;
  }

  return (
    <form className="landing-contact-form" onSubmit={handleSubmit}>
      <div className="landing-form-field">
        <label className="landing-sr-only" htmlFor="contact-first-name">
          First name
        </label>
        <input
          id="contact-first-name"
          name="firstName"
          type="text"
          placeholder="First name"
          required
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
        />
      </div>

      <div className="landing-form-field">
        <label className="landing-sr-only" htmlFor="contact-middle-name">
          Middle name (optional)
        </label>
        <input
          id="contact-middle-name"
          name="middleName"
          type="text"
          placeholder="Middle name (Optional)"
          value={middleName}
          onChange={(event) => setMiddleName(event.target.value)}
        />
      </div>

      <div className="landing-form-field">
        <label className="landing-sr-only" htmlFor="contact-last-name">
          Last name
        </label>
        <input
          id="contact-last-name"
          name="lastName"
          type="text"
          placeholder="Last name"
          required
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
        />
      </div>

      <div className="landing-form-field">
        <label className="landing-sr-only" htmlFor="contact-email">
          Email
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div className="landing-form-row">
        <div className="landing-form-field">
          <span className="landing-form-phone-code">🇦🇺 +61</span>
        </div>
        <div className="landing-form-field">
          <label className="landing-sr-only" htmlFor="contact-phone">
            Phone number
          </label>
          <input
            id="contact-phone"
            name="phone"
            type="tel"
            placeholder="Phone number"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
      </div>

      <div className="landing-form-field">
        <label className="landing-sr-only" htmlFor="contact-concern">
          Type of concern
        </label>
        <select
          id="contact-concern"
          name="concern"
          required
          value={concern}
          onChange={(event) => setConcern(event.target.value)}
        >
          <option value="" disabled>
            Type of concern
          </option>
          {CONCERN_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="landing-form-field">
        <label className="landing-sr-only" htmlFor="contact-description">
          Description
        </label>
        <textarea
          id="contact-description"
          name="description"
          placeholder="Description"
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <label className="landing-form-upload" htmlFor="contact-file">
        <span className="landing-form-upload-icon">
          <UploadIcon />
        </span>
        <span className="landing-form-upload-label">{fileName || 'Tap to upload a document'}</span>
        <span className="landing-form-upload-hint">
          The file must be either a JPG, JPEG, PNG or PDF. Max. File size: 5mb
        </span>
        <input
          id="contact-file"
          name="file"
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? '')}
        />
      </label>

      <button type="submit" className="landing-btn landing-btn--cta landing-btn--block">
        Send
      </button>
      <p className="landing-contact-form-note">
        Opens your email client with this addressed to {CONTACT_EMAIL}.
      </p>
    </form>
  );
}
