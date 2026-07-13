export default function TwoFactorPage() {
  return (
    <div className="settings-page">
      <h1 className="settings-page-title">Account Settings</h1>

      <div className="card contact-details-card">
        <div className="contact-details-header">
          <h2 className="contact-details-title">Two-Factor Authentication</h2>
          <p className="contact-details-intro">
            Add an extra layer of security to your account by requiring a code from your phone when
            you sign in.
          </p>
        </div>

        <div className="settings-coming-soon">
          <p className="settings-coming-soon-title">Coming soon</p>
          <p className="settings-coming-soon-text">
            Two-factor authentication is not available yet. You&apos;ll be able to set it up here
            when it launches.
          </p>
        </div>
      </div>
    </div>
  );
}
