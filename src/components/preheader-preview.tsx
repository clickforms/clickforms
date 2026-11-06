import type { CSSProperties, ReactNode } from 'react';
import { isBodyEmpty, type OrgPreheader } from '@/lib/org-preheader';
import './preheader-preview.css';

interface PreheaderPreviewProps {
  preheader: OrgPreheader;
  /** Resolved logo URL (pre-header upload or organisation logo). */
  logoUrl: string | null;
  orgName: string;
  /** Replaces the placeholder skeleton beneath the pre-header (template preview). */
  children?: ReactNode;
}

/** Visual mock of the pre-header as it appears at the top of a form. */
export function PreheaderPreview({ preheader, logoUrl, orgName, children }: PreheaderPreviewProps) {
  const showLogo = preheader.showLogo && Boolean(logoUrl);
  const hasBody = !isBodyEmpty(preheader.body);
  const style: CSSProperties | undefined = preheader.backgroundColor
    ? { backgroundColor: preheader.backgroundColor }
    : undefined;

  const logo = showLogo ? (
    <div className={`preheader-preview-logo preheader-preview-logo--${preheader.logoSize}`}>
      {/* biome-ignore lint/performance/noImgElement: presigned S3 URL, same as org settings */}
      <img src={logoUrl ?? ''} alt={`${orgName} logo`} />
    </div>
  ) : null;

  const body = hasBody ? (
    <div
      className="preheader-preview-body"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: admin-authored rich text from the shared editor, validated server-side
      dangerouslySetInnerHTML={{ __html: preheader.body }}
    />
  ) : null;

  return (
    <div className="preheader-preview">
      <div className="preheader-preview-bar">
        <span />
        <span />
        <span />
      </div>
      <div className="preheader-preview-page">
        {logo || body ? (
          <div
            className={`preheader-preview-block preheader-preview-block--${preheader.layout}`}
            style={style}
          >
            {preheader.layout === 'logo-right' ? (
              <>
                {body}
                {logo}
              </>
            ) : (
              <>
                {logo}
                {body}
              </>
            )}
          </div>
        ) : (
          <p className="preheader-preview-empty">Add a logo or some text to see it here.</p>
        )}
        {preheader.showDivider && (logo || body) ? (
          <div className="preheader-preview-rule" />
        ) : null}
        {children ?? (
          <div className="preheader-preview-sample" aria-hidden="true">
            <span className="preheader-preview-sample-title" />
            <div className="preheader-preview-sample-field">
              <span />
              <span />
            </div>
            <div className="preheader-preview-sample-field">
              <span />
              <span />
            </div>
            <span className="preheader-preview-sample-button" />
          </div>
        )}
      </div>
    </div>
  );
}
