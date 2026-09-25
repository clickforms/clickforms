'use client';

import { useEffect } from 'react';

interface PreviewTemplate {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  category: string | null;
  formType: string | null;
  thumbnailUrl: string | null;
}

interface TemplatePreviewModalProps {
  open: boolean;
  template: PreviewTemplate | null;
  related: PreviewTemplate[];
  isCreating: boolean;
  /** True while the name-your-form dialog is stacked on top — keep this preview in place
   * but don't let Escape / backdrop click dismiss it underneath. */
  locked?: boolean;
  onClose: () => void;
  onUse: () => void;
  onSelectRelated: (template: PreviewTemplate) => void;
}

export function TemplatePreviewModal({
  open,
  template,
  related,
  isCreating,
  locked = false,
  onClose,
  onUse,
  onSelectRelated,
}: TemplatePreviewModalProps) {
  useEffect(() => {
    if (!open || locked) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isCreating) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, locked, isCreating, onClose]);

  if (!open || !template) return null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; Escape key and a Close button are also wired up
    <div className="modal-overlay" onMouseDown={() => !isCreating && !locked && onClose()}>
      <div
        className="canva-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="canva-preview-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="canva-preview-close"
          onClick={onClose}
          aria-label="Close"
          disabled={isCreating || locked}
        >
          ×
        </button>

        <div className="canva-preview-main">
          <div className="canva-preview-stage">
            <iframe
              key={template.id}
              src={`/template-preview/${template.id}?embed=1`}
              title={`Preview of ${template.name}`}
              className="canva-preview-frame"
              tabIndex={-1}
            />
          </div>
          <div className="canva-preview-meta">
            <p className="canva-preview-kicker">
              {[template.industry, template.category, template.formType]
                .filter(Boolean)
                .join(' · ') || 'Template'}
            </p>
            <h2 className="canva-preview-title" id="canva-preview-title">
              {template.name}
            </h2>
            {template.description ? (
              <p className="canva-preview-copy">{template.description}</p>
            ) : null}
            <button
              type="button"
              className="button button--dark canva-preview-cta"
              onClick={onUse}
              disabled={isCreating || locked}
            >
              {isCreating ? 'Creating…' : 'Use this template'}
            </button>
          </div>
        </div>

        {related.length > 0 ? (
          <div className="canva-preview-more">
            <h3 className="canva-preview-more-title">More like this</h3>
            <div className="canva-preview-more-row">
              {related.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="template-tile template-tile--compact"
                  onClick={() => onSelectRelated(item)}
                  disabled={isCreating || locked}
                >
                  <span className="template-tile-art">
                    {item.thumbnailUrl ? (
                      // biome-ignore lint/performance/noImgElement: presigned S3 URL, not a static asset next/image can optimize
                      <img src={item.thumbnailUrl} alt="" />
                    ) : (
                      <span className="template-tile-fallback">{item.name}</span>
                    )}
                  </span>
                  <span className="template-tile-name">{item.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
