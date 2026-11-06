import { Sk, SkRegion } from './primitives';

interface SettingsRow {
  label: string;
  hint?: boolean;
}

interface SettingsSkeletonProps {
  title: string;
  lead: string;
  cardTitle: string;
  cardIntro: string;
  rows?: SettingsRow[];
  /** Two-factor layout: a method row instead of form rows. */
  variant?: 'form' | 'method';
  actionNote?: string;
  actionLabelWidth?: number;
}

/** Mirrors `.settings-page` (header + one `contact-details-card`). The surrounding settings
 * nav comes from the real `SettingsShell` layout, so only the right-hand content is faked. */
export function SettingsSkeleton({
  title,
  lead,
  cardTitle,
  cardIntro,
  rows = [],
  variant = 'form',
  actionNote,
  actionLabelWidth = 110,
}: SettingsSkeletonProps) {
  return (
    <SkRegion label={`Loading ${title.toLowerCase()}`}>
      <div className="settings-page">
        <header className="settings-page-header">
          <p className="settings-page-kicker">Personal profile</p>
          <h1 className="settings-page-title">{title}</h1>
          <p className="settings-page-lead">{lead}</p>
        </header>

        <div className="card contact-details-card">
          <div className="contact-details-header">
            <Sk w={40} h={40} r={12} />
            <div>
              <h2 className="contact-details-title">{cardTitle}</h2>
              <p className="contact-details-intro">{cardIntro}</p>
            </div>
          </div>

          {variant === 'form' ? (
            <>
              <dl className="contact-details-list">
                {rows.map((row) => (
                  <div className="contact-details-row" key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>
                      <Sk h={40} r={10} />
                      {row.hint ? <Sk w="55%" h={10} style={{ marginTop: 8 }} /> : null}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="contact-details-actions">
                {actionNote ? <p>{actionNote}</p> : <span />}
                <Sk w={actionLabelWidth} h={38} r="pill" />
              </div>
            </>
          ) : (
            <div className="two-factor-body">
              <div className="two-factor-method-row">
                <div>
                  <p className="two-factor-method-title">Email code</p>
                  <Sk w={70} h={11} style={{ marginTop: 4 }} />
                </div>
                <Sk w={44} h={24} r="pill" />
              </div>
            </div>
          )}
        </div>
      </div>
    </SkRegion>
  );
}
