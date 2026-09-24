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
    --color-primary: #55ea8c;
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
  /* "Table" layout style — mirrors .form-renderer--table-theme in globals.css (see that
     rule's comment for the full explanation of the continuous-table + label-spans-every-
     row technique). Structure only by default; tableThemeHeaderColor/
     tableThemeHeaderTextColor/tableThemeValueColor set the --form-table-* custom
     properties inline on .export-form (see submission-form-export-document.tsx). */
  .export-form--table-theme .export-table-theme-header {
    display: grid;
    grid-template-columns: minmax(140px, 30%) 1fr;
    border: 1px solid #ddd;
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    overflow: hidden;
  }
  .export-form--table-theme .export-table-theme-header-cell {
    padding: 0.65rem 0.9rem;
    font-weight: 700;
    font-size: 0.9375rem;
    background: var(--form-table-header-bg, transparent);
    color: var(--form-table-header-text, inherit);
  }
  .export-form--table-theme .export-table-theme-header-cell + .export-table-theme-header-cell {
    border-left: 1px solid #ddd;
  }
  .export-form--table-theme .export-field-list {
    display: block;
    border: 1px solid #ddd;
    border-radius: 4px;
    overflow: hidden;
  }
  .export-form--table-theme .export-table-theme-header + .export-field-list {
    border-top: none;
    border-radius: 0 0 4px 4px;
  }
  .export-form--table-theme .export-field-cell {
    width: 100%;
  }
  .export-form--table-theme .export-field-cell:not(:last-child) {
    border-bottom: 1px solid #ddd;
  }
  .export-form--table-theme .export-field-group {
    display: grid;
    grid-template-columns: minmax(140px, 30%) 1fr;
    gap: 0;
  }
  .export-form--table-theme .export-field-group--highlighted {
    padding: 0;
    border-radius: 0;
  }
  .export-form--table-theme .export-field-label {
    grid-column: 1;
    grid-row: 1 / -1;
    background: var(--form-table-label-bg, transparent);
    border-right: 1px solid #ddd;
    padding: 0.75rem 0.9rem;
    margin: 0;
    display: flex;
    align-items: center;
  }
  .export-form--table-theme .export-field-group > *:not(.export-field-label) {
    grid-column: 2;
    padding: 0.55rem 0.8rem;
    margin: 0;
  }
  .export-form--table-theme
    .export-field-group
    > *:not(.export-field-label):not(.export-field-help):not(.export-field-error) {
    background: var(--form-table-value-bg, transparent);
  }
  .export-form--table-theme .export-field-help {
    padding-bottom: 0;
  }
  .export-form--table-theme .export-column-layout-grid {
    display: block;
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
    color: inherit;
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
  /* draw_on_image's flattened background+markup PNG carries more detail than a plain
     signature scrawl — a bigger box than .export-signature's default keeps it legible. */
  .export-drawing img {
    max-width: 420px;
    max-height: 320px;
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
  .export-full-name-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
  }
  .export-full-name-row .export-input {
    flex: 1 1 8rem;
    min-width: 8rem;
  }
  .export-full-name-row .export-full-name-prefix {
    flex: 0 0 6rem;
    min-width: 0;
  }
  .export-ranking-list {
    margin: 0;
    padding-left: 1.4rem;
  }
  .export-ranking-list li {
    padding: 0.15rem 0;
  }
  .export-picture-choice {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .export-picture-choice-image {
    width: 3rem;
    height: 3rem;
    object-fit: cover;
    border-radius: 3px;
    border: 1px solid #ddd;
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

  .export-table-field {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }
  .export-table-field th,
  .export-table-field td {
    padding: 0.5rem 0.65rem;
    text-align: left;
    border: 1px solid #ddd;
  }
  .export-table-field th {
    background: #f4f4f4;
    font-weight: 700;
  }

  /* question_table's PDF export (QuestionTableExportDisplay, submission-field-display.tsx)
     — a fixed two-column question/answer grid. Header/answer-cell colors come from the
     field's own headerColor/headerTextColor/valueColor (inline style, set per field
     instance), so only structural rules live here — same split as .export-table-field
     above vs. the whole-form .export-form--table-theme block further down. */
  .export-question-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }
  .export-question-table th,
  .export-question-table td {
    padding: 0.5rem 0.65rem;
    text-align: left;
    border: 1px solid #ddd;
  }
  .export-question-table th {
    background: #f4f4f4;
    font-weight: 700;
  }
  .export-question-table-label-cell {
    width: 40%;
    font-weight: 600;
  }

  /* Prefer keeping short fields intact. Apply on the grid cell — Chromium often
     ignores break-inside on descendants of CSS grid. */
  .export-field-cell,
  .export-field-group,
  .export-option-list,
  .export-section-break-wrap,
  .export-divider-wrap,
  .export-choice-matrix-wrap,
  .export-table-field-wrap,
  .export-question-table-wrap,
  .export-address-field,
  .export-full-name-row,
  .export-ranking-list,
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

  /* Trailing attachments section (embedded file_upload images) — always forced onto its
     own page so it lands at the very end of the export, never disrupting the form's own
     page flow. See SubmissionFormExportDocument / fileUploadFieldSchema.embedInExport. */
  .export-attachments-section {
    break-before: page;
    page-break-before: always;
    padding: var(--form-pad-y) var(--form-pad-x);
    border-top: 1px solid #ececec;
  }
  .export-attachment-item {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-bottom: 1.5rem;
  }
  .export-attachment-caption {
    font-weight: 700;
    font-size: 0.9375rem;
    margin: 0 0 0.5rem;
  }
  /* max-height matters as much as max-width here: a portrait-oriented photo (the
     common case from a phone camera) scaled to the full ~960px page width can render
     taller than a single PDF page. Without a height cap, page.pdf()'s paginator still
     honors .export-attachment-item's break-inside: avoid by starting the item on a
     fresh page, but the oversized image then overflows that page's bottom edge anyway
     and spills onto the next — the caption ends up alone at the top of a mostly-blank
     page, with the image itself split across the following one or two. Capping both
     max-width and max-height (with width/height left as auto rather than a fixed pair)
     lets the browser scale the image down to fit whichever bound is tighter while
     preserving its aspect ratio, so it always lands within one page. 8.5in leaves
     headroom under the ~10.1in of vertical space actually free on an attachment's own
     page (11.69in page height, minus generate-submission-pdf.ts's 0.6in top+bottom
     margins, minus this section's own --form-pad-y padding) for the caption above it. */
  .export-attachment-image {
    max-width: 100%;
    max-height: 8.5in;
    width: auto;
    height: auto;
    display: block;
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
