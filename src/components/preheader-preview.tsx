import type { OrgPreheader } from '@/lib/org-preheader';
import './preheader-preview.css';

interface PreheaderPreviewProps {
  preheader: OrgPreheader;
  logoUrl: string | null;
  orgName: string;
  /** Optional placeholder body shown beneath the pre-header (template preview). */
  children?: React.ReactNode;
}

/** Visual mock of the pre-header as it appears at the top of a form: logo left, info right. */
export function PreheaderPreview({ preheader, logoUrl, orgName, children }: PreheaderPreviewProps) {
  const lines = preheader.details
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const showLogo = preheader.showLogo && Boolean(logoUrl);
  const hasInfo = Boolean(preheader.title) || lines.length > 0;

  return (
    <div className="preheader-preview">
      <div className="preheader-preview-bar">
        <span />
        <span />
        <span />
      </div>
      <div className="preheader-preview-page">
        <div className="preheader-preview-row">
          <div className="preheader-preview-logo">
            {showLogo ? (
              // biome-ignore lint/performance/noImgElement: presigned S3 URL, same as org settings
              <img src={logoUrl ?? ''} alt={`${orgName} logo`} />
            ) : null}
          </div>
          {hasInfo ? (
            <div className="preheader-preview-info">
              {preheader.title ? <strong>{preheader.title}</strong> : null}
              {lines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="preheader-preview-rule" />
        {children ?? (
          <div className="preheader-preview-skeleton" aria-hidden="true">
            <span style={{ width: '46%' }} />
            <span style={{ width: '100%' }} />
            <span style={{ width: '82%' }} />
          </div>
        )}
      </div>
    </div>
  );
}
