'use client';

import { useEffect, useRef, useState } from 'react';
import { mergeableFields, mergeTokenHtml } from '@/lib/forms/merge-fields';
import { FIELD_COLOR_PRESETS, type FormField } from '@/lib/forms/schema';

// A small hand-built WYSIWYG editor for the "Formatted Text" field's body (matches the
// Rich text toolbar for static_text fields: bold/italic/underline, headings,
// alignment, lists, links, a color swatch, and an "Insert form answers" merge-field picker).
//
// Deliberately not built on a rich-text library (no TipTap/Quill/etc. in this project) —
// document.execCommand is deprecated but still broadly supported in every desktop browser
// this internal admin tool targets, and it keeps the dependency footprint at zero for what
// is, in scope, a fairly small formatting toolbar.
//
// Selection-preservation trick: every toolbar control uses onMouseDown={preventDefault} so
// clicking it never steals DOM focus away from the contentEditable div. Without that, the
// browser's Selection/Range would collapse the moment focus left the editor, and commands
// like "bold" or "insert merge field" would silently apply at the wrong place (or nowhere).

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  fields: Record<string, FormField>;
  excludeFieldId: string;
}

type Popover = 'format' | 'color' | 'merge' | null;

const BLOCK_FORMATS: { label: string; tag: string }[] = [
  { label: 'Paragraph', tag: '<p>' },
  { label: 'Heading 1', tag: '<h2>' },
  { label: 'Heading 2', tag: '<h3>' },
  { label: 'Heading 3', tag: '<h4>' },
];

function preventDefault(event: React.MouseEvent) {
  event.preventDefault();
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="rich-text-toolbar-button"
      title={label}
      aria-label={label}
      onMouseDown={preventDefault}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  disabled,
  fields,
  excludeFieldId,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  // Starts at '' (not `value`) so the very first effect run below still performs the
  // initial DOM write — this div intentionally has no dangerouslySetInnerHTML in its JSX,
  // so the effect is the *only* thing that ever writes HTML into it.
  const lastEmittedRef = useRef<string>('');
  const [openPopover, setOpenPopover] = useState<Popover>(null);

  // Only (re-)sync innerHTML when `value` changed for a reason other than this editor's own
  // onInput (e.g. switching which field is selected, or an undo elsewhere) — otherwise every
  // keystroke would reset innerHTML and throw the caret back to the start. Deliberately not
  // using dangerouslySetInnerHTML in the JSX below: React would re-diff that prop on every
  // parent re-render (which happens on every keystroke, since onChange flows back through
  // parent state), and re-applying even byte-identical HTML via that path still nukes and
  // reparses the DOM, resetting the caret — this imperative, guarded effect is the only
  // writer.
  useEffect(() => {
    if (!editorRef.current) return;
    if (value === lastEmittedRef.current) return;
    editorRef.current.innerHTML = value;
    lastEmittedRef.current = value;
  }, [value]);

  function emitChange() {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    lastEmittedRef.current = html;
    onChange(html);
  }

  function exec(command: string, arg?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    emitChange();
  }

  function insertLink() {
    editorRef.current?.focus();
    const hasSelection = (document.getSelection()?.toString().length ?? 0) > 0;
    const url = window.prompt('Link URL (e.g. https://example.com)');
    if (!url) return;
    if (hasSelection) {
      document.execCommand('createLink', false, url);
    } else {
      document.execCommand(
        'insertHTML',
        false,
        `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
      );
    }
    emitChange();
  }

  function insertMergeField(field: FormField) {
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, mergeTokenHtml(field));
    emitChange();
    setOpenPopover(null);
  }

  const mergeable = mergeableFields(fields, excludeFieldId);

  return (
    <div className="rich-text-editor-wrap">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: mousedown here only preventDefaults so toolbar clicks don't steal selection from the editor; the real controls are the child buttons */}
      <div className="rich-text-toolbar" onMouseDown={preventDefault}>
        <div className="rich-text-toolbar-group">
          <ToolbarButton label="Undo" onClick={() => exec('undo')}>
            ↺
          </ToolbarButton>
          <ToolbarButton label="Redo" onClick={() => exec('redo')}>
            ↻
          </ToolbarButton>
        </div>

        <div className="rich-text-toolbar-group">
          <ToolbarButton label="Bold" onClick={() => exec('bold')}>
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton label="Italic" onClick={() => exec('italic')}>
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton label="Underline" onClick={() => exec('underline')}>
            <span style={{ textDecoration: 'underline' }}>U</span>
          </ToolbarButton>
        </div>

        <div className="rich-text-toolbar-group rich-text-toolbar-group--popover">
          <ToolbarButton
            label="Text color"
            onClick={() => setOpenPopover(openPopover === 'color' ? null : 'color')}
          >
            <span className="rich-text-color-swatch-icon" />
          </ToolbarButton>
          {openPopover === 'color' && (
            // biome-ignore lint/a11y/noStaticElementInteractions: mousedown here only preventDefaults so the popover click doesn't steal selection from the editor; the real controls are the child buttons
            <div
              className="rich-text-popover rich-text-popover--swatches"
              onMouseDown={preventDefault}
            >
              {FIELD_COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="rich-text-swatch"
                  style={{ backgroundColor: color }}
                  aria-label={color}
                  onMouseDown={preventDefault}
                  onClick={() => {
                    exec('foreColor', color);
                    setOpenPopover(null);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="rich-text-toolbar-group rich-text-toolbar-group--popover">
          <ToolbarButton
            label="Paragraph style"
            onClick={() => setOpenPopover(openPopover === 'format' ? null : 'format')}
          >
            ¶ ▾
          </ToolbarButton>
          {openPopover === 'format' && (
            // biome-ignore lint/a11y/noStaticElementInteractions: mousedown here only preventDefaults so the popover click doesn't steal selection from the editor; the real controls are the child buttons
            <div className="rich-text-popover" onMouseDown={preventDefault}>
              {BLOCK_FORMATS.map((format) => (
                <button
                  key={format.tag}
                  type="button"
                  className="rich-text-popover-item"
                  onMouseDown={preventDefault}
                  onClick={() => {
                    exec('formatBlock', format.tag);
                    setOpenPopover(null);
                  }}
                >
                  {format.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rich-text-toolbar-group">
          <ToolbarButton label="Align left" onClick={() => exec('justifyLeft')}>
            ⯇
          </ToolbarButton>
          <ToolbarButton label="Align center" onClick={() => exec('justifyCenter')}>
            ▤
          </ToolbarButton>
          <ToolbarButton label="Align right" onClick={() => exec('justifyRight')}>
            ⯈
          </ToolbarButton>
        </div>

        <div className="rich-text-toolbar-group">
          <ToolbarButton label="Numbered list" onClick={() => exec('insertOrderedList')}>
            1.
          </ToolbarButton>
          <ToolbarButton label="Bulleted list" onClick={() => exec('insertUnorderedList')}>
            •
          </ToolbarButton>
        </div>

        <div className="rich-text-toolbar-group">
          <ToolbarButton label="Insert link" onClick={insertLink}>
            🔗
          </ToolbarButton>
          <ToolbarButton label="Clear formatting" onClick={() => exec('removeFormat')}>
            ⌫
          </ToolbarButton>
        </div>

        {mergeable.length > 0 && (
          <div className="rich-text-toolbar-group rich-text-toolbar-group--popover rich-text-toolbar-group--push-end">
            <button
              type="button"
              className="button button--ghost button--small"
              onMouseDown={preventDefault}
              onClick={() => setOpenPopover(openPopover === 'merge' ? null : 'merge')}
            >
              Insert form answers
            </button>
            {openPopover === 'merge' && (
              // biome-ignore lint/a11y/noStaticElementInteractions: mousedown here only preventDefaults so the popover click doesn't steal selection from the editor; the real controls are the child buttons
              <div
                className="rich-text-popover rich-text-popover--merge"
                onMouseDown={preventDefault}
              >
                {mergeable.map((field) => (
                  <button
                    key={field.id}
                    type="button"
                    className="rich-text-popover-item"
                    onMouseDown={preventDefault}
                    onClick={() => insertMergeField(field)}
                  >
                    {'label' in field && field.label ? field.label : 'Untitled field'}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* biome-ignore lint/a11y/noStaticElementInteractions: contentEditable region — the standard rich-text-editor pattern (Slate, ProseMirror, etc. all use a contentEditable div, not an input/textarea, since those can't hold rich HTML formatting) */}
      <div
        ref={editorRef}
        className="rich-text-editor"
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emitChange}
        onBlur={emitChange}
      />
      {/* No dangerouslySetInnerHTML here on purpose — see the effect above. */}
    </div>
  );
}
