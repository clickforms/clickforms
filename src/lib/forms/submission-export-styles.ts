/** Print/export styles mirroring the public form renderer (.form-renderer in globals.css). */
export const SUBMISSION_EXPORT_STYLES = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: #e8e8e8;
    color: #222;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .export-form {
    max-width: 960px;
    margin: 0 auto;
    padding: 2rem 1.5rem 2.5rem;
    --color-primary: #00a960;
    --form-secondary-color: #4a90d9;
    --form-pad-x: 2.5rem;
    --form-pad-y: 2rem;
  }
  .export-form-card {
    background: #fff;
    border: 1px solid #d8d8d8;
    border-radius: 4px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  }
  .export-form-hero {
    text-align: center;
    /* No bottom padding — .export-form-page immediately below supplies its own top padding
       (var(--form-pad-y)); the two used to stack into a much bigger gap than intended at this
       seam. Mirrors the same fix on .form-renderer-hero in globals.css. */
    padding: var(--form-pad-y) var(--form-pad-x) 0;
  }
  .export-form-logo {
    display: flex;
    justify-content: center;
    margin-bottom: 1.25rem;
  }
  .export-form-logo img {
    max-width: min(100%, 320px);
    max-height: 72px;
    object-fit: contain;
  }
  .export-form-title {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    line-height: 1.2;
  }
  .export-form-title-primary { color: var(--color-primary); }
  .export-form-title-secondary { color: var(--form-secondary-color); }
  .export-form-page {
    padding: var(--form-pad-y) var(--form-pad-x);
    border-top: 1px solid #ececec;
  }
  .export-form-page:first-of-type { border-top: none; }
  .export-form-page-title {
    margin: 0 0 1.5rem;
    font-size: 1.125rem;
    font-weight: 700;
  }
  .export-field-list {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 1.35rem 1.25rem;
    align-items: start;
  }
  .export-field-cell { min-width: 0; }
  .field-width--full { grid-column: 1 / -1; }
  .field-width--half { grid-column: span 3; }
  .field-width--third { grid-column: span 2; }
  .export-field-group {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }
  .export-field-group--highlighted,
  .export-static-text--colored {
    padding: 0.75rem 1rem;
    border-radius: 6px;
  }
  .export-field-label {
    font-weight: 700;
    font-size: 0.9375rem;
    line-height: 1.35;
    break-after: avoid;
    page-break-after: avoid;
  }
  .export-field-help {
    color: #666;
    font-size: 0.8125rem;
    margin: -0.1rem 0 0;
    line-height: 1.45;
  }
  .export-input,
  .export-textarea,
  .export-select {
    width: 100%;
    border: 1px solid #c8c8c8;
    border-radius: 3px;
    padding: 0.6rem 0.75rem;
    font-size: 0.9375rem;
    background: #fff;
    color: #222;
    font-family: inherit;
  }
  /* Div (not <textarea>) so long answers can paginate cleanly — replaced elements
     like textarea/input are atomic and get sliced mid-glyph when a page break hits. */
  .export-textarea {
    min-height: 5.5rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    line-height: 1.45;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  .export-option-list {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    border: 1px solid #c8c8c8;
    border-radius: 3px;
    padding: 0.65rem 0.75rem;
    background: #fff;
  }
  /* Multi-column (not CSS grid) so options fill top-to-bottom within a column before
     wrapping to the next one, matching how a plain single-column list reads — a grid
     with grid-auto-flow: row (the default) fills left-to-right first, which splits a
     short related run of options (e.g. a Likert scale) across the row instead of
     keeping it together in one column. */
  .export-option-list--grid {
    display: block;
    column-count: 3;
    column-gap: 1.25rem;
  }
  .export-option-row {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    font-size: 0.9rem;
    line-height: 1.35;
  }
  .export-option-list--grid .export-option-row {
    break-inside: avoid;
    margin-bottom: 0.45rem;
  }
  .export-option-indicator {
    width: 1rem;
    height: 1rem;
    margin-top: 0.15rem;
    flex-shrink: 0;
    border: 1.5px solid #888;
    background: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .export-option-indicator--radio { border-radius: 50%; }
  .export-option-indicator--checkbox { border-radius: 2px; }
  .export-option-indicator.is-selected {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: #fff;
    font-size: 0.65rem;
    font-weight: 700;
  }
  .export-rating {
    display: flex;
    gap: 0.15rem;
    font-size: 1.15rem;
    color: #ccc;
  }
  .export-rating-star--filled { color: var(--export-rating-color, #f5a623); }
  .export-section-break-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: 1.5rem 0 0;
  }
  .export-section-break-wrap:first-child { margin-top: 0; }
  .export-section-break {
    background: var(--color-primary);
    border-radius: 4px;
    padding: 0.7rem 1rem;
  }
  .export-section-break-title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #fff;
  }
  .export-section-instruction {
    margin: 0;
    color: #444;
    font-size: 0.875rem;
    line-height: 1.55;
  }
  .export-divider-wrap {
    display: flex;
    justify-content: center;
    margin: 1rem 0;
  }
  .export-divider-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    max-width: 100%;
  }
  .export-divider-caption {
    align-self: stretch;
    font-size: 0.8125rem;
    font-weight: 700;
    color: #444;
    text-align: center;
  }
  .export-divider-line {
    width: 100%;
    border-radius: 999px;
    background-color: #d0d3d9;
  }
  .export-static-text-heading {
    margin: 0 0 0.5rem;
    font-weight: 700;
    font-size: 0.9375rem;
  }
  .export-static-text-body p { margin: 0 0 0.65rem; line-height: 1.55; }
  .export-static-text-body p:last-child { margin-bottom: 0; }
  .export-image-field { text-align: center; margin-bottom: 0.5rem; }
  .export-image-field--align-left { text-align: left; }
  .export-image-field--align-right { text-align: right; }
  .export-image-field img {
    max-width: 100%;
    max-height: 120px;
    object-fit: contain;
  }
  .export-image-caption {
    margin: 0 0 0.75rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #444;
  }
  .export-file-status {
    display: flex;
    align-items: center;
    background: #f7f7f7;
    border: 1px solid #ddd;
    border-radius: 3px;
    padding: 0.6rem 0.9rem;
    font-size: 0.875rem;
  }
  .export-file-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .export-signature img {
    max-width: 280px;
    max-height: 120px;
    border: 1px solid #ddd;
    border-radius: 3px;
    background: #fff;
  }
  .export-address-field {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }
  .export-address-row {
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr;
    gap: 0.55rem;
  }
  .export-column-layout { display: flex; flex-direction: column; gap: 0.75rem; }
  .export-column-layout-title {
    font-weight: 700;
    font-size: 0.9375rem;
    color: #444;
    margin: 0;
  }
  .export-column-layout-grid { display: grid; gap: 1.35rem 1.25rem; }
  .export-column-layout-grid--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .export-column-layout-grid--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .export-column-layout-grid--4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .export-choice-matrix {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  .export-choice-matrix th,
  .export-choice-matrix td {
    padding: 0.6rem 0.75rem;
    text-align: center;
    border-bottom: 1px solid #ddd;
  }
  .export-choice-matrix-row-label {
    text-align: left !important;
    white-space: normal !important;
  }

  /* Prefer keeping short fields intact. Apply on the grid cell — Chromium often
     ignores break-inside on descendants of CSS grid. */
  .export-field-cell,
  .export-field-group,
  .export-option-list,
  .export-section-break-wrap,
  .export-divider-wrap,
  .export-choice-matrix-wrap,
  .export-address-field,
  .export-signature,
  .export-image-field {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* Long paragraph answers must be allowed to split across pages. Forcing
     avoid on a tall box leaves a huge blank gap, then Chromium still slices it. */
  .export-field-cell:has(.export-textarea),
  .export-field-group:has(.export-textarea) {
    break-inside: auto;
    page-break-inside: auto;
  }

  .export-section-break-wrap {
    break-after: avoid;
    page-break-after: avoid;
  }
`;

/** Applied on top of SUBMISSION_EXPORT_STYLES only when this page is being
 *  rendered for PDF export (see the `x-forms-pdf-export` header handling in
 *  src/app/f/[slug]/submissions/[submissionId]/preview/page.tsx and
 *  src/lib/forms/generate-submission-pdf.ts). The browser preview
 *  intentionally looks like a card floating on a gray page — that reads fine
 *  as a page inside our app's admin chrome. A printed PDF should instead read
 *  as a plain document: no surrounding gray backdrop, no card border/shadow/
 *  rounded corners, since Puppeteer's own page margin already supplies the
 *  PDF page's whitespace. */
export const SUBMISSION_EXPORT_PDF_OVERRIDE_STYLES = `
  body { background: #fff; }
  .export-form { padding: 0; }
  .export-form-card {
    border: none;
    border-radius: 0;
    box-shadow: none;
  }
  /* Next.js's dev-mode floating indicator ("N" badge) — only present under
     \`next dev\`, never in a production build — but Puppeteer captures
     whatever's on the page, badge included, when exporting from a dev server. */
  nextjs-portal {
    display: none !important;
  }
`;
