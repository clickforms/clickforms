'use client';

import type { FormNotificationMode } from '@prisma/client';
import Link from 'next/link';
import {
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { readApiError } from '@/lib/error-message';

// Mirrors resolveFilenameTemplate in src/lib/forms/generate-submission-pdf.ts, kept as a
// small local copy rather than a shared import — that module also pulls in Puppeteer and
// Node's fs/crypto for PDF generation, which has no business being in the client bundle
// just to preview a filename string here.
const FILENAME_UNSAFE_CHARS = /[/\\:*?"<>|]/g;
const FIELD_TOKEN_PATTERN = /\{field:([a-zA-Z0-9_-]+)\}/g;
// Every token type the editor below renders as a chip rather than plain text — used both
// to split a saved template into chip/text runs, and to recognize a dragged/dropped token
// as ours rather than arbitrary text dropped from elsewhere on the page.
const ANY_TOKEN_PATTERN = /\{field:[a-zA-Z0-9_-]+\}|\{date\}|\{prefix\}/g;

// Mirrors listFilenamePrefixCandidates' return shape in src/lib/forms/schema.ts — kept as
// a plain local type (rather than importing that module) for the same reason
// FILENAME_UNSAFE_CHARS above is duplicated: schema.ts pulls in Zod for its validators,
// which has no business bloating the client bundle just to describe this shape.
export interface FilenamePrefixFieldOption {
  id: string;
  label: string;
  position: number;
}

function fieldToken(fieldId: string): string {
  return `{field:${fieldId}}`;
}

// No real submission exists yet at settings-edit time, so every field token previews
// using that field's own label as a stand-in (e.g. "Full Name") rather than a fabricated
// answer — makes clear which question is feeding each token without implying a fake
// value. `{prefix}` is the older singular token (see resolveFilenamePrefixValue in
// generate-submission-pdf.ts) — still previewed here for any form that configured it
// before this page moved to per-field chips, via `legacyPrefixLabel`.
function slugifyFormName(formName: string): string {
  return formName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function previewFilename(
  template: string,
  fields: FilenamePrefixFieldOption[],
  legacyPrefixLabel: string | null,
  formName: string,
): string {
  const todayIso = new Date().toISOString().slice(0, 10);
  if (!template.trim()) {
    return `${slugifyFormName(formName) || 'submission'}-${todayIso}.pdf`;
  }

  const labelById = new Map(fields.map((field) => [field.id, field.label]));
  const resolved = template
    .replace(/\{prefix\}/gi, legacyPrefixLabel ?? '')
    .replace(FIELD_TOKEN_PATTERN, (_match, fieldId: string) => labelById.get(fieldId) ?? '')
    .replace(/\{date\}/gi, todayIso)
    .replace(FILENAME_UNSAFE_CHARS, '')
    .trim();
  return `${resolved || 'response'}.pdf`;
}

function nameDateTemplate(fields: FilenamePrefixFieldOption[]): string {
  const named = fields.find((field) => /\bname\b/i.test(field.label)) ?? fields[0];
  if (!named) return '{date}';
  return `${fieldToken(named.id)} - {date}`;
}

type FilenamePreset = 'form-date' | 'name-date' | 'custom';

function presetForTemplate(template: string, fields: FilenamePrefixFieldOption[]): FilenamePreset {
  if (!template.trim()) return 'form-date';
  if (template.trim() === nameDateTemplate(fields)) return 'name-date';
  return 'custom';
}

interface FormSettingsClientProps {
  formId: string;
  formName: string;
  canEdit: boolean;
  initialPdfFilenameTemplate: string;
  initialFilenamePrefixFieldId: string | null;
  availableFields: FilenamePrefixFieldOption[];
  initialNotificationMode: FormNotificationMode;
  initialNotificationEmail: string | null;
  organizationNotificationEmail: string | null;
}

export function FormSettingsClient({
  formId,
  formName,
  canEdit,
  initialPdfFilenameTemplate,
  initialFilenamePrefixFieldId,
  availableFields,
  initialNotificationMode,
  initialNotificationEmail,
  organizationNotificationEmail,
}: FormSettingsClientProps) {
  const [template, setTemplate] = useState(initialPdfFilenameTemplate);
  const [lastSaved, setLastSaved] = useState(initialPdfFilenameTemplate);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fieldQuery, setFieldQuery] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  // The editor's last known caret/selection Range, kept fresh as the admin clicks or
  // types inside it — clicking a chip button in the toolbar below blurs the editor
  // (losing the browser's own notion of "current selection" there), so without this a
  // click-to-insert would have nowhere to land except the very end of the text.
  const lastRangeRef = useRef<Range | null>(null);
  // Which existing chip (if any) is mid-drag, so a drop inside the editor can be told
  // apart from a drop originating in the "Insert a field" palette below: a palette drop
  // creates a brand-new chip, but dragging a chip that's already in the editor should
  // move that same node to its new spot instead of duplicating it.
  const draggingChipRef = useRef<HTMLElement | null>(null);

  const legacyPrefixLabel =
    availableFields.find((field) => field.id === initialFilenamePrefixFieldId)?.label ?? null;
  const labelById = new Map(availableFields.map((field) => [field.id, field.label]));

  function chipLabelFor(tokenStr: string): string {
    if (tokenStr === '{date}') return 'Date';
    if (tokenStr === '{prefix}') return legacyPrefixLabel ?? 'Prefix field';
    const fieldId = /^\{field:([a-zA-Z0-9_-]+)\}$/.exec(tokenStr)?.[1];
    return (fieldId && labelById.get(fieldId)) || 'Deleted field';
  }

  function createChipNode(tokenStr: string): HTMLSpanElement {
    const chip = document.createElement('span');
    chip.contentEditable = 'false';
    chip.className = 'filename-token-chip';
    chip.dataset.token = tokenStr;
    chip.title = chipLabelFor(tokenStr);

    const label = document.createElement('span');
    label.className = 'filename-token-chip-label';
    label.textContent = chipLabelFor(tokenStr);
    chip.appendChild(label);

    if (canEdit) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'filename-token-chip-remove';
      remove.setAttribute('aria-label', `Remove ${chipLabelFor(tokenStr)}`);
      remove.textContent = '×';
      remove.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      remove.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        chip.remove();
        setTemplate(serializeEditor());
      });
      chip.appendChild(remove);
    }

    // Made draggable here (imperatively, as a native listener) rather than in JSX, since
    // every chip in the editor — whether built from the saved template on mount or
    // inserted later — is a plain DOM node, not something React renders/diffs. Reordering
    // is handled in handleEditorDrop, which checks draggingChipRef to tell this apart
    // from a fresh insert dragged in from the field palette below.
    chip.draggable = true;
    chip.addEventListener('dragstart', (event) => {
      draggingChipRef.current = chip;
      chip.classList.add('filename-token-chip--dragging');
      event.dataTransfer?.setData('text/plain', tokenStr);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });
    chip.addEventListener('dragend', () => {
      draggingChipRef.current = null;
      chip.classList.remove('filename-token-chip--dragging');
      setIsDragOver(false);
    });
    return chip;
  }

  function endOfContainerRange(container: HTMLDivElement | null): Range | null {
    if (!container) return null;
    const range = document.createRange();
    range.selectNodeContents(container);
    range.collapse(false);
    return range;
  }

  // Walks up from a hit-tested node to the chip element it's inside of, if any — a chip's
  // label is still just a text node under the hood, and caretRangeFromPoint/
  // caretPositionFromPoint do purely visual/geometric hit-testing, with no idea that
  // contentEditable="false" makes that text atomic. Left unchecked, a drop landing over a
  // chip's own label would return a position *inside* it, splicing the dropped node into
  // the middle of another chip's text instead of landing next to it.
  function findAncestorChip(node: Node, container: HTMLElement): HTMLElement | null {
    let current: Node | null = node;
    while (current && current !== container) {
      if (current instanceof HTMLElement && current.classList.contains('filename-token-chip')) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  }

  // Shared by both a palette-drop (fresh insert) and an in-editor drag (reorder) — finds
  // the precise text position under the cursor at drop time, rather than falling back to
  // "wherever the caret last was," which is what makes drag-to-a-specific-spot meaningful.
  function getDropRange(event: DragEvent<HTMLDivElement>): Range | null {
    const container = editorRef.current;
    const pointApis = document as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (
        x: number,
        y: number,
      ) => { offsetNode: Node; offset: number } | null;
    };
    let range: Range | null = null;
    if (pointApis.caretRangeFromPoint) {
      range = pointApis.caretRangeFromPoint(event.clientX, event.clientY);
    } else if (pointApis.caretPositionFromPoint) {
      const position = pointApis.caretPositionFromPoint(event.clientX, event.clientY);
      if (position) {
        range = document.createRange();
        range.setStart(position.offsetNode, position.offset);
        range.collapse(true);
      }
    }
    if (!range || !container?.contains(range.startContainer)) {
      return null;
    }

    // Landed inside an existing chip — snap to just before or after it instead (whichever
    // edge the drop point is closer to), rather than trusting the raw in-chip offset.
    const chip = findAncestorChip(range.startContainer, container);
    if (chip) {
      const rect = chip.getBoundingClientRect();
      const snapped = document.createRange();
      if (event.clientX < rect.left + rect.width / 2) {
        snapped.setStartBefore(chip);
      } else {
        snapped.setStartAfter(chip);
      }
      snapped.collapse(true);
      return snapped;
    }

    return range;
  }

  // Rebuilds the editor's DOM from a canonical template string — text runs become plain
  // text nodes, recognized tokens become non-editable chip spans carrying the real token
  // string in a data attribute (see serializeEditor, the inverse of this). Only called
  // once, on mount: after that, typing and chip insertion mutate the live DOM directly
  // and get read back into `template` state via serializeEditor, rather than state
  // driving the DOM — re-rendering contentEditable children from React state on every
  // keystroke would reset the browser's own cursor position on each one.
  function buildEditorContent(container: HTMLDivElement, value: string) {
    container.textContent = '';
    let lastIndex = 0;
    for (const match of value.matchAll(ANY_TOKEN_PATTERN)) {
      const index = match.index ?? 0;
      if (index > lastIndex) {
        container.appendChild(document.createTextNode(value.slice(lastIndex, index)));
      }
      container.appendChild(createChipNode(match[0]));
      lastIndex = index + match[0].length;
    }
    if (lastIndex < value.length) {
      container.appendChild(document.createTextNode(value.slice(lastIndex)));
    }
  }

  // Runs synchronously before paint (not useEffect) so the saved template's chips are
  // already in place on first render rather than flashing in a beat later. Deliberately
  // empty deps — this seeds the editor once from the initial saved value; every change
  // after that comes from the DOM itself (typing, chip insert/delete), not from
  // re-running this build step (which would wipe the live DOM/cursor on every re-render).
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useLayoutEffect(() => {
    if (editorRef.current) {
      buildEditorContent(editorRef.current, initialPdfFilenameTemplate);
    }
  }, []);

  function serializeEditor(): string {
    const container = editorRef.current;
    if (!container) return '';
    let result = '';
    for (const node of container.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent ?? '';
      } else if (node instanceof HTMLElement && node.dataset.token) {
        result += node.dataset.token;
      }
    }
    return result;
  }

  function handleEditorInput() {
    setTemplate(serializeEditor());
  }

  function trackSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (editorRef.current?.contains(range.commonAncestorContainer)) {
      lastRangeRef.current = range.cloneRange();
    }
  }

  function insertTokenAtCaret(tokenStr: string) {
    const container = editorRef.current;
    if (!container) return;

    let range = lastRangeRef.current;
    if (!range || !container.contains(range.startContainer)) {
      range = document.createRange();
      range.selectNodeContents(container);
      range.collapse(false);
    }

    const chip = createChipNode(tokenStr);
    range.deleteContents();
    range.insertNode(chip);
    range.setStartAfter(chip);
    range.setEndAfter(chip);
    range.collapse(true);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    lastRangeRef.current = range.cloneRange();

    container.focus();
    setTemplate(serializeEditor());
  }

  function handleFieldChipDragStart(event: DragEvent<HTMLButtonElement>, fieldId: string) {
    event.dataTransfer.setData('text/plain', fieldToken(fieldId));
    event.dataTransfer.effectAllowed = 'copy';
  }

  function applyTemplate(next: string) {
    if (editorRef.current) {
      buildEditorContent(editorRef.current, next);
    }
    setTemplate(next);
  }

  function handleEditorDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(true);
  }

  function handleEditorDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);

    const container = editorRef.current;
    const draggedChip = draggingChipRef.current;
    draggingChipRef.current = null;
    const dropRange = getDropRange(event);

    if (draggedChip && container?.contains(draggedChip)) {
      // Reordering a chip that's already in the editor — move the real node rather than
      // inserting a duplicate. No-op (rather than an error) if it was dropped back onto
      // or inside itself.
      const range = dropRange ?? endOfContainerRange(container);
      if (
        !range ||
        range.startContainer === draggedChip ||
        draggedChip.contains(range.startContainer)
      ) {
        return;
      }

      draggedChip.remove();
      range.insertNode(draggedChip);
      range.setStartAfter(draggedChip);
      range.setEndAfter(draggedChip);
      range.collapse(true);

      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      lastRangeRef.current = range.cloneRange();
      container?.focus();
      setTemplate(serializeEditor());
      return;
    }

    // Not reordering — a fresh token dragged in from the "Insert a field" palette (or the
    // {date} button) below. Only accept tokens in our own recognized shape, not arbitrary
    // text/files dropped from elsewhere on the page or outside the browser.
    const token = event.dataTransfer.getData('text/plain');
    if (!/^\{field:[a-zA-Z0-9_-]+\}$/.test(token) && token !== '{date}') return;
    lastRangeRef.current = dropRange;
    insertTokenAtCaret(token);
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Single-line field — no newlines.
    if (event.key === 'Enter') {
      event.preventDefault();
    }
  }

  function handleEditorPaste(event: ClipboardEvent<HTMLDivElement>) {
    // Force plain text on paste — accepting a rich/HTML paste could smuggle in stray
    // elements serializeEditor doesn't know how to read back out of the DOM.
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }

  async function saveTemplate(next = template) {
    const value = next.trim();
    if (value === lastSaved.trim() && saveState === 'saved') return;

    setError(null);
    setSaveState('saving');

    try {
      const res = await fetch(`/api/forms/${formId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfFilenameTemplate: value }),
      });

      if (!res.ok) {
        setError(await readApiError(res, 'Could not save this setting'));
        setSaveState('unsaved');
        return;
      }

      setLastSaved(value);
      setSaveState('saved');
    } catch {
      setError('Something went wrong. Please try again.');
      setSaveState('unsaved');
    }
  }

  useEffect(() => {
    if (!canEdit) return;
    setSaveState(template.trim() === lastSaved.trim() ? 'saved' : 'unsaved');
  }, [template, canEdit, lastSaved]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: saveTemplate is read on keypress; rebinding every render is unnecessary
  useEffect(() => {
    if (!canEdit) return;

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveTemplate();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canEdit]);

  const query = fieldQuery.trim().toLowerCase();
  const filteredFields = query
    ? availableFields.filter((field) => field.label.toLowerCase().includes(query))
    : availableFields;
  const activePreset = presetForTemplate(template, availableFields);
  const previewName = previewFilename(template, availableFields, legacyPrefixLabel, formName);
  const usedFieldIds = new Set(
    [...template.matchAll(new RegExp(FIELD_TOKEN_PATTERN.source, 'g'))].map((match) => match[1]),
  );

  return (
    <div className="form-settings-page">
      <div className="form-settings-hero">
        <p className="form-settings-hero-kicker">Form settings</p>
        <h1 className="form-settings-hero-title">Settings</h1>
        <p className="form-settings-hero-lead">
          Control how this form&apos;s responses behave when exported.
        </p>
      </div>

      <div className="form-settings-accordion">
        <details className="form-settings-card">
          <summary className="form-settings-card-toggle">
            <span className="contact-details-header-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <title>Download</title>
                <path
                  d="M10 3v9M6.5 8.5 10 12l3.5-3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M4 14.5v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="form-settings-card-toggle-copy">
              <span className="contact-details-title">Download filename</span>
              <span className="contact-details-intro">
                Build the name every response PDF downloads with. Click a field to insert it, type
                any extra text, and remove a chip with ×.
              </span>
            </span>
            <span className="form-settings-card-chevron" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path
                  d="M4.5 7l4.5 4.5L13.5 7"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </summary>

          <div id="form-settings-filename" className="form-settings-body">
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}

            <section className="form-settings-panel" aria-label="Filename format">
              <p className="form-settings-panel-label">Filename format</p>
              <div className="form-settings-presets">
                <button
                  type="button"
                  className={`form-settings-preset${activePreset === 'form-date' ? ' form-settings-preset--active' : ''}`}
                  onClick={() => applyTemplate('')}
                  disabled={!canEdit}
                >
                  Form name + date
                </button>
                <button
                  type="button"
                  className={`form-settings-preset${activePreset === 'name-date' ? ' form-settings-preset--active' : ''}`}
                  onClick={() => applyTemplate(nameDateTemplate(availableFields))}
                  disabled={!canEdit || availableFields.length === 0}
                >
                  Name + date
                </button>
                {activePreset === 'custom' ? (
                  <span className="form-settings-preset form-settings-preset--active">Custom</span>
                ) : null}
              </div>

              <div className="filename-template-field">
                {/* biome-ignore lint/a11y/useSemanticElements: needs contentEditable for
                  inline token chips (see FormSettingsClient docs above) — a plain
                  <input>/<textarea> can't render a non-text child node inline with
                  typed text, which is the whole point of this editor. */}
                <div
                  ref={editorRef}
                  tabIndex={canEdit ? 0 : -1}
                  className={`text-input contact-details-input filename-template-input${
                    isDragOver ? ' filename-template-input--drag-over' : ''
                  }`}
                  contentEditable={canEdit}
                  suppressContentEditableWarning
                  role="textbox"
                  aria-multiline="false"
                  aria-label="Filename format"
                  data-placeholder="Type text or insert a field…"
                  onInput={handleEditorInput}
                  onKeyDown={handleEditorKeyDown}
                  onKeyUp={trackSelection}
                  onMouseUp={trackSelection}
                  onFocus={trackSelection}
                  onPaste={handleEditorPaste}
                  onDragOver={handleEditorDragOver}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleEditorDrop}
                />
                <button
                  type="button"
                  className="button button--small button--ghost"
                  onClick={() => insertTokenAtCaret('{date}')}
                  disabled={!canEdit}
                >
                  Insert date
                </button>
              </div>

              <div className="filename-file-preview" aria-live="polite">
                <span className="filename-file-preview-icon" aria-hidden="true">
                  PDF
                </span>
                <div className="filename-file-preview-copy">
                  <p className="filename-file-preview-name">{previewName}</p>
                  <p className="filename-file-preview-meta">
                    {template.trim()
                      ? 'Example of the next PDF download'
                      : 'Default naming (form name + date)'}
                  </p>
                </div>
              </div>
            </section>

            {availableFields.length > 0 ? (
              <section className="form-settings-panel" aria-label="Insert a field">
                <div className="form-settings-palette-header">
                  <h3 className="form-settings-palette-title">Insert a field</h3>
                  <input
                    className="text-input form-settings-palette-search"
                    type="search"
                    value={fieldQuery}
                    onChange={(event) => setFieldQuery(event.target.value)}
                    placeholder="Search questions"
                    aria-label="Search questions"
                    disabled={!canEdit}
                  />
                </div>
                {filteredFields.length > 0 ? (
                  <ul className="filename-field-chip-list">
                    {filteredFields.map((field) => (
                      <li key={field.id}>
                        <button
                          type="button"
                          className={`filename-field-chip${usedFieldIds.has(field.id) ? ' filename-field-chip--in-use' : ''}`}
                          draggable={canEdit}
                          onDragStart={(event) => handleFieldChipDragStart(event, field.id)}
                          onClick={() => insertTokenAtCaret(fieldToken(field.id))}
                          disabled={!canEdit}
                          title={`${field.label} — click to insert`}
                        >
                          <span className="filename-field-chip-label">
                            {'{'}
                            {field.label}
                            {'}'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="contact-details-readonly-note">No matching questions.</p>
                )}
                <p className="contact-details-readonly-note">
                  A respondent&apos;s answer replaces the chip. Blank answers are omitted. Only
                  single-answer questions are listed.
                </p>
              </section>
            ) : null}

            {canEdit ? (
              <div className="form-settings-footer">
                <p>
                  {saveState === 'saving'
                    ? 'Saving…'
                    : saveState === 'unsaved'
                      ? 'Unsaved changes'
                      : 'Applies to every future PDF download of this form.'}
                </p>
                <button
                  type="button"
                  className="button button--dark"
                  onClick={() => void saveTemplate()}
                  disabled={saveState !== 'unsaved'}
                >
                  {saveState === 'saving' ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            ) : null}
          </div>
        </details>

        <NotificationSettingsCard
          formId={formId}
          canEdit={canEdit}
          initialNotificationMode={initialNotificationMode}
          initialNotificationEmail={initialNotificationEmail}
          organizationNotificationEmail={organizationNotificationEmail}
        />
      </div>
    </div>
  );
}

const NOTIFICATION_MODE_OPTIONS: {
  value: FormNotificationMode;
  label: string;
  description: string;
}[] = [
  {
    value: 'org_default',
    label: 'Organisation default',
    description: 'Send to the notification email in Organisation settings.',
  },
  {
    value: 'custom',
    label: 'Custom address',
    description: 'Send to a specific inbox for this form only.',
  },
  {
    value: 'off',
    label: 'Off',
    description: "Don't email anyone when this form receives a response.",
  },
];

interface NotificationSettingsCardProps {
  formId: string;
  canEdit: boolean;
  initialNotificationMode: FormNotificationMode;
  initialNotificationEmail: string | null;
  organizationNotificationEmail: string | null;
}

/** Own card, own save action — same "each setting group saves independently" pattern as
 * the Download filename card above, rather than one page-wide save covering everything. */
function NotificationSettingsCard({
  formId,
  canEdit,
  initialNotificationMode,
  initialNotificationEmail,
  organizationNotificationEmail,
}: NotificationSettingsCardProps) {
  const [mode, setMode] = useState(initialNotificationMode);
  const [email, setEmail] = useState(initialNotificationEmail ?? '');
  const [lastSaved, setLastSaved] = useState({
    mode: initialNotificationMode,
    email: initialNotificationEmail ?? '',
  });
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canEdit) return;
    const changed = mode !== lastSaved.mode || (mode === 'custom' && email !== lastSaved.email);
    setSaveState(changed ? 'unsaved' : 'saved');
  }, [mode, email, lastSaved, canEdit]);

  async function handleSave() {
    if (mode === 'custom' && !email.trim()) {
      setError('Enter an email address, or choose a different option.');
      return;
    }

    setError(null);
    setSaveState('saving');

    try {
      const res = await fetch(`/api/forms/${formId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationMode: mode,
          notificationEmail: mode === 'custom' ? email.trim() : '',
        }),
      });

      if (!res.ok) {
        setError(await readApiError(res, 'Could not save this setting'));
        setSaveState('unsaved');
        return;
      }

      setLastSaved({ mode, email: mode === 'custom' ? email.trim() : '' });
      setSaveState('saved');
    } catch {
      setError('Something went wrong. Please try again.');
      setSaveState('unsaved');
    }
  }

  return (
    <details className="form-settings-card">
      <summary className="form-settings-card-toggle">
        <span
          className="contact-details-header-icon contact-details-header-icon--lavender"
          aria-hidden="true"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <title>Notifications</title>
            <path
              d="M10 3.5c-2.2 0-4 1.8-4 4v2.3c0 .4-.15.8-.43 1.1L4.5 12.2a1 1 0 0 0 .7 1.7h9.6a1 1 0 0 0 .7-1.7l-1.07-1.3a1.7 1.7 0 0 1-.43-1.1V7.5c0-2.2-1.8-4-4-4Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M8.3 15.5a1.8 1.8 0 0 0 3.4 0"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="form-settings-card-toggle-copy">
          <span className="contact-details-title">Response notifications</span>
          <span className="contact-details-intro">
            Choose who gets emailed — with a PDF of the response attached — every time this form
            receives a new response.
          </span>
        </span>
        <span className="form-settings-card-chevron" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path
              d="M4.5 7l4.5 4.5L13.5 7"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </summary>

      <div className="form-settings-body">
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div
          className="form-settings-choice-list"
          role="radiogroup"
          aria-label="Who receives response notifications"
        >
          {NOTIFICATION_MODE_OPTIONS.map((option) => {
            const selected = mode === option.value;
            return (
              <label
                key={option.value}
                className={
                  selected
                    ? 'form-settings-choice form-settings-choice--selected'
                    : 'form-settings-choice'
                }
              >
                <input
                  type="radio"
                  name="notification-mode"
                  value={option.value}
                  checked={selected}
                  onChange={() => setMode(option.value)}
                  disabled={!canEdit}
                />
                <span className="form-settings-choice-radio" aria-hidden="true" />
                <span className="form-settings-choice-copy">
                  <span className="form-settings-choice-title">{option.label}</span>
                  <span className="form-settings-choice-desc">{option.description}</span>
                  {selected && option.value === 'org_default' ? (
                    organizationNotificationEmail ? (
                      <span className="form-settings-choice-note">
                        Currently sending to <strong>{organizationNotificationEmail}</strong>.
                      </span>
                    ) : (
                      <span className="form-settings-choice-note form-settings-choice-note--warn">
                        No organisation email is set, so nothing will send.{' '}
                        <Link href="/forms/organisation">Add one in Organisation settings</Link>, or
                        choose a custom address.
                      </span>
                    )
                  ) : null}
                  {selected && option.value === 'custom' ? (
                    <input
                      className="text-input form-settings-choice-input"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="responses@yourorg.com"
                      disabled={!canEdit}
                    />
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>

        {canEdit ? (
          <div className="form-settings-footer">
            <p>
              {saveState === 'saving'
                ? 'Saving…'
                : saveState === 'unsaved'
                  ? 'Unsaved changes'
                  : 'Applies to every future response to this form.'}
            </p>
            <button
              type="button"
              className="button button--dark"
              onClick={() => void handleSave()}
              disabled={saveState !== 'unsaved'}
            >
              {saveState === 'saving' ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        ) : null}
      </div>
    </details>
  );
}
