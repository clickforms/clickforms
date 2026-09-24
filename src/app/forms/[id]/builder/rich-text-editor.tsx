'use client';

import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { Color } from '@tiptap/extension-color';
import { FontFamily as FontFamilyExtension } from '@tiptap/extension-font-family';
import { Highlight } from '@tiptap/extension-highlight';
import { Image } from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { TableKit } from '@tiptap/extension-table';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { common, createLowlight } from 'lowlight';
import { useEffect, useRef, useState } from 'react';
import { FieldColorPicker } from '@/app/forms/[id]/builder/field-color-picker';
import { MergeToken } from '@/app/forms/[id]/builder/merge-token-node';
import { FontSize } from '@/app/forms/[id]/builder/rich-text-font-size';
import { mergeableFields } from '@/lib/forms/merge-fields';
import {
  FONT_FAMILY_CSS,
  FONT_FAMILY_LABEL,
  FONT_FAMILY_OPTIONS,
  type FormField,
} from '@/lib/forms/schema';

// Text/highlight color default when nothing's applied yet -- matches the neutral ink used
// elsewhere (DrawOnImagePad's default stroke) and a soft yellow in the highlight family
// shown by the toolbar's own swatch icon (see .rich-text-highlight-swatch-icon).
const DEFAULT_TEXT_COLOR = '#1a1a1a';
const DEFAULT_HIGHLIGHT_COLOR = '#fde68a';

// A comprehensive WYSIWYG editor for the "Formatted Text" field's body, built on Tiptap
// (headless, MIT-licensed, https://tiptap.dev) rather than the browser's deprecated
// document.execCommand API this editor used to run on. Tiptap wraps ProseMirror — every
// mark/node toggle below goes through its command chain (editor.chain().focus()...run()),
// and undo/redo, list handling, and paste sanitization all come from the library instead
// of being hand-rolled.
//
// The one genuinely custom piece is the "Insert form answers" merge-field chip — see
// merge-token-node.ts for why it's modeled as an atom node, and merge-fields.ts for how
// its HTML gets resolved into real answer text outside the editor (public renderer,
// builder canvas preview). rich-text-font-size.ts is the other local addition — Tiptap has
// no stable official font-size extension for v3, so it follows the documented community
// recipe of adding a fontSize attribute to the existing TextStyle mark. Everything else
// here is stock Tiptap extensions: tables (TableKit), inline images (Image), and
// syntax-highlighted code blocks (CodeBlockLowlight, replacing StarterKit's plain
// bundled codeBlock — see `codeBlock: false` below) round out the toolbar so it covers
// the same ground as most full-featured document editors.
//
// Selection-preservation note: unlike the old execCommand-based editor, Tiptap tracks its
// selection in ProseMirror's own document state, not the browser's Selection/Range — that
// state survives the editor losing DOM focus (e.g. while a toolbar popover is open), so
// `.chain().focus()` reliably resumes at the right place. The onMouseDown={preventDefault}
// on toolbar controls is kept anyway, purely so clicking a button doesn't visibly collapse
// the text selection the user is looking at.

const lowlight = createLowlight(common);

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  fields: Record<string, FormField>;
  excludeFieldId: string;
}

type Popover =
  | 'format'
  | 'color'
  | 'highlight'
  | 'merge'
  | 'table'
  | 'fontFamily'
  | 'fontSize'
  | null;

const BLOCK_FORMATS: { label: string; level: 2 | 3 | 4 | null }[] = [
  { label: 'Paragraph', level: null },
  { label: 'Heading 1', level: 2 },
  { label: 'Heading 2', level: 3 },
  { label: 'Heading 3', level: 4 },
];

const FONT_SIZE_OPTIONS = [
  '8px',
  '9px',
  '10px',
  '11px',
  '12px',
  '14px',
  '16px',
  '18px',
  '20px',
  '24px',
  '32px',
  '48px',
];

function preventDefault(event: React.MouseEvent) {
  event.preventDefault();
}

function ToolbarButton({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`rich-text-toolbar-button ${active ? 'rich-text-toolbar-button--active' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={preventDefault}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// Inline SVGs for the handful of toolbar controls that previously used obscure Unicode
// glyphs (align left/center/right/justify were rendering as blank boxes in most fonts —
// see field-settings-panel.tsx / builder-rail.tsx for this codebase's usual inline-icon
// convention, followed here) plus icons for the newly-added table/image/code-block
// controls. Bold/Italic/Underline/Strike/lists/quote/hr/undo/redo intentionally keep their
// existing real-HTML or well-supported-Unicode glyphs — those already render correctly.

function AlignLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <line
        x1="1"
        y1="3"
        x2="13"
        y2="3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <line
        x1="1"
        y1="7"
        x2="9"
        y2="7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <line
        x1="1"
        y1="11"
        x2="11"
        y2="11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AlignCenterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <line
        x1="1"
        y1="3"
        x2="13"
        y2="3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <line
        x1="3"
        y1="7"
        x2="11"
        y2="7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <line
        x1="2"
        y1="11"
        x2="12"
        y2="11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AlignRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <line
        x1="1"
        y1="3"
        x2="13"
        y2="3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <line
        x1="5"
        y1="7"
        x2="13"
        y2="7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <line
        x1="3"
        y1="11"
        x2="13"
        y2="11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AlignJustifyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <line
        x1="1"
        y1="3"
        x2="13"
        y2="3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <line
        x1="1"
        y1="7"
        x2="13"
        y2="7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <line
        x1="1"
        y1="11"
        x2="13"
        y2="11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M6 8L8 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path
        d="M5.5 9.3L4 10.8a2 2 0 01-2.8-2.8l1.8-1.8a2 2 0 012.8 0"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M8.5 4.7L10 3.2a2 2 0 012.8 2.8l-1.8 1.8a2 2 0 01-2.8 0"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClearFormatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 2.5h7M5.5 2.5v6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path
        d="M8 8.5l4.5 4.5M12.5 8.5L8 13"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1.5" y="2" width="11" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <line x1="1.5" y1="5.3" x2="12.5" y2="5.3" stroke="currentColor" strokeWidth="1.1" />
      <line x1="1.5" y1="8.7" x2="12.5" y2="8.7" stroke="currentColor" strokeWidth="1.1" />
      <line x1="5.7" y1="2" x2="5.7" y2="12" stroke="currentColor" strokeWidth="1.1" />
      <line x1="9.3" y1="2" x2="9.3" y2="12" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1.5" y="2.5" width="11" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="5" cy="5.5" r="1.1" stroke="currentColor" strokeWidth="1.1" />
      <path
        d="M2 10.5l3.2-3.2a1 1 0 011.4 0L9 9.7M8.3 9l1.4-1.4a1 1 0 011.4 0L12.5 9.7"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CodeBlockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M4.5 3.5L1.3 7l3.2 3.5M9.5 3.5L12.7 7l-3.2 3.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RichTextEditor({
  value,
  onChange,
  disabled,
  fields,
  excludeFieldId,
}: RichTextEditorProps) {
  const lastEmittedRef = useRef<string>(value);
  const [openPopover, setOpenPopover] = useState<Popover>(null);

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: !disabled,
      content: value,
      editorProps: {
        attributes: { class: 'rich-text-editor' },
      },
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3, 4] },
          link: {
            openOnClick: false,
            autolink: true,
            HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
          },
          // Replaced by CodeBlockLowlight below so code blocks get real syntax
          // highlighting instead of StarterKit's plain, unstyled <pre><code>.
          codeBlock: false,
        }),
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Superscript,
        Subscript,
        Placeholder.configure({ placeholder: 'Add your text here.' }),
        MergeToken,
        FontFamilyExtension,
        FontSize,
        Image,
        TableKit.configure({ table: { resizable: true } }),
        CodeBlockLowlight.configure({ lowlight }),
      ],
      onUpdate: ({ editor: updatedEditor }) => {
        const html = updatedEditor.getHTML();
        lastEmittedRef.current = html;
        onChange(html);
      },
    },
    [],
  );

  // Keep the editor's editable state in sync with the disabled prop without recreating
  // the whole editor instance (recreating would lose undo history and the caret position).
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  // Only (re-)sync content when `value` changed for a reason other than this editor's own
  // onUpdate (e.g. switching which field is selected) — otherwise every keystroke would
  // reset the document and throw the caret back to the start. emitUpdate: false stops this
  // programmatic sync from re-triggering onUpdate and looping back into onChange.
  useEffect(() => {
    if (!editor) return;
    if (value === lastEmittedRef.current) return;
    editor.commands.setContent(value, { emitUpdate: false });
    lastEmittedRef.current = value;
  }, [editor, value]);

  const state = useEditorState({
    editor,
    selector: (ctx) => {
      const e = ctx.editor;
      if (!e) return null;
      return {
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        isBold: e.isActive('bold'),
        isItalic: e.isActive('italic'),
        isUnderline: e.isActive('underline'),
        isStrike: e.isActive('strike'),
        isSuperscript: e.isActive('superscript'),
        isSubscript: e.isActive('subscript'),
        isBulletList: e.isActive('bulletList'),
        isOrderedList: e.isActive('orderedList'),
        isBlockquote: e.isActive('blockquote'),
        isCodeBlock: e.isActive('codeBlock'),
        isLink: e.isActive('link'),
        isTable: e.isActive('table'),
        canMergeCells: e.can().mergeCells(),
        canSplitCell: e.can().splitCell(),
        activeAlign: (['left', 'center', 'right', 'justify'] as const).find((align) =>
          e.isActive({ textAlign: align }),
        ),
        activeHeadingLevel: BLOCK_FORMATS.find(
          (format) => format.level !== null && e.isActive('heading', { level: format.level }),
        )?.level,
        isParagraph: e.isActive('paragraph') && !e.isActive('heading'),
        activeFontFamily: (e.getAttributes('textStyle').fontFamily as string | undefined) ?? null,
        activeFontSize: (e.getAttributes('textStyle').fontSize as string | undefined) ?? null,
        activeColor: (e.getAttributes('textStyle').color as string | undefined) ?? null,
        activeHighlight: (e.getAttributes('highlight').color as string | undefined) ?? null,
      };
    },
  });

  if (!editor || !state) {
    return <div className="rich-text-editor-wrap rich-text-editor-wrap--loading" />;
  }

  function insertLink() {
    const previousUrl = editor?.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL (e.g. https://example.com)', previousUrl ?? '');
    if (url === null) return;
    if (url === '') {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  function insertImage() {
    const url = window.prompt('Image URL (e.g. https://example.com/photo.jpg)');
    if (!url) return;
    editor?.chain().focus().setImage({ src: url }).run();
  }

  function insertMergeField(field: FormField) {
    const label = 'label' in field && field.label ? field.label : 'Untitled field';
    editor?.chain().focus().insertMergeToken({ fieldId: field.id, label }).run();
    setOpenPopover(null);
  }

  const mergeable = mergeableFields(fields, excludeFieldId);
  const activeFormat = BLOCK_FORMATS.find((format) =>
    format.level === null ? state.isParagraph : state.activeHeadingLevel === format.level,
  );
  const activeFontFamilyOption =
    FONT_FAMILY_OPTIONS.find((option) => FONT_FAMILY_CSS[option] === state.activeFontFamily) ??
    'default';

  return (
    <div className="rich-text-editor-wrap">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: mousedown here only preventDefaults so toolbar clicks don't steal selection from the editor; the real controls are the child buttons */}
      <div className="rich-text-toolbar" onMouseDown={preventDefault}>
        <div className="rich-text-toolbar-group">
          <ToolbarButton
            label="Undo"
            disabled={!state.canUndo}
            onClick={() => editor.chain().focus().undo().run()}
          >
            ↺
          </ToolbarButton>
          <ToolbarButton
            label="Redo"
            disabled={!state.canRedo}
            onClick={() => editor.chain().focus().redo().run()}
          >
            ↻
          </ToolbarButton>
        </div>

        <div className="rich-text-toolbar-group rich-text-toolbar-group--popover">
          <button
            type="button"
            className="rich-text-toolbar-button rich-text-toolbar-button--wide"
            onMouseDown={preventDefault}
            onClick={() => setOpenPopover(openPopover === 'format' ? null : 'format')}
          >
            {activeFormat?.label ?? 'Paragraph'} ▾
          </button>
          {openPopover === 'format' && (
            // biome-ignore lint/a11y/noStaticElementInteractions: mousedown here only preventDefaults so the popover click doesn't steal selection from the editor; the real controls are the child buttons
            <div className="rich-text-popover" onMouseDown={preventDefault}>
              {BLOCK_FORMATS.map((format) => (
                <button
                  key={format.label}
                  type="button"
                  className="rich-text-popover-item"
                  onMouseDown={preventDefault}
                  onClick={() => {
                    if (format.level === null) {
                      editor.chain().focus().setParagraph().run();
                    } else {
                      editor.chain().focus().toggleHeading({ level: format.level }).run();
                    }
                    setOpenPopover(null);
                  }}
                >
                  {format.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rich-text-toolbar-group rich-text-toolbar-group--popover">
          <button
            type="button"
            className="rich-text-toolbar-button rich-text-toolbar-button--wide"
            onMouseDown={preventDefault}
            onClick={() => setOpenPopover(openPopover === 'fontFamily' ? null : 'fontFamily')}
          >
            {FONT_FAMILY_LABEL[activeFontFamilyOption]} ▾
          </button>
          {openPopover === 'fontFamily' && (
            // biome-ignore lint/a11y/noStaticElementInteractions: mousedown here only preventDefaults so the popover click doesn't steal selection from the editor; the real controls are the child buttons
            <div
              className="rich-text-popover rich-text-popover--scrollable"
              onMouseDown={preventDefault}
            >
              {FONT_FAMILY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="rich-text-popover-item"
                  onMouseDown={preventDefault}
                  onClick={() => {
                    const css = FONT_FAMILY_CSS[option];
                    if (css) {
                      editor.chain().focus().setFontFamily(css).run();
                    } else {
                      editor.chain().focus().unsetFontFamily().run();
                    }
                    setOpenPopover(null);
                  }}
                >
                  <span style={{ fontFamily: FONT_FAMILY_CSS[option] }}>
                    {FONT_FAMILY_LABEL[option]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rich-text-toolbar-group rich-text-toolbar-group--popover">
          <button
            type="button"
            className="rich-text-toolbar-button rich-text-toolbar-button--wide"
            onMouseDown={preventDefault}
            onClick={() => setOpenPopover(openPopover === 'fontSize' ? null : 'fontSize')}
          >
            {state.activeFontSize ?? 'Size'} ▾
          </button>
          {openPopover === 'fontSize' && (
            // biome-ignore lint/a11y/noStaticElementInteractions: mousedown here only preventDefaults so the popover click doesn't steal selection from the editor; the real controls are the child buttons
            <div
              className="rich-text-popover rich-text-popover--scrollable"
              onMouseDown={preventDefault}
            >
              <button
                type="button"
                className="rich-text-popover-item"
                onMouseDown={preventDefault}
                onClick={() => {
                  editor.chain().focus().unsetFontSize().run();
                  setOpenPopover(null);
                }}
              >
                Default
              </button>
              {FONT_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  type="button"
                  className="rich-text-popover-item"
                  onMouseDown={preventDefault}
                  onClick={() => {
                    editor.chain().focus().setFontSize(size).run();
                    setOpenPopover(null);
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rich-text-toolbar-group">
          <ToolbarButton
            label="Bold"
            active={state.isBold}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton
            label="Italic"
            active={state.isItalic}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton
            label="Underline"
            active={state.isUnderline}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <span style={{ textDecoration: 'underline' }}>U</span>
          </ToolbarButton>
          <ToolbarButton
            label="Strikethrough"
            active={state.isStrike}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <span style={{ textDecoration: 'line-through' }}>S</span>
          </ToolbarButton>
        </div>

        <div className="rich-text-toolbar-group">
          <ToolbarButton
            label="Superscript"
            active={state.isSuperscript}
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
          >
            x²
          </ToolbarButton>
          <ToolbarButton
            label="Subscript"
            active={state.isSubscript}
            onClick={() => editor.chain().focus().toggleSubscript().run()}
          >
            x₂
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
            // biome-ignore lint/a11y/noStaticElementInteractions: mousedown here only preventDefaults so the popover click doesn't steal selection from the editor; the real controls are the child inputs
            <div
              className="rich-text-popover rich-text-popover--color"
              onMouseDown={preventDefault}
            >
              <FieldColorPicker
                label="Text color"
                value={state.activeColor ?? undefined}
                defaultColor={DEFAULT_TEXT_COLOR}
                canEdit
                onChange={(color) => {
                  if (color) {
                    editor.chain().focus().setColor(color).run();
                  } else {
                    editor.chain().focus().unsetColor().run();
                  }
                }}
              />
            </div>
          )}
        </div>

        <div className="rich-text-toolbar-group rich-text-toolbar-group--popover">
          <ToolbarButton
            label="Highlight color"
            onClick={() => setOpenPopover(openPopover === 'highlight' ? null : 'highlight')}
          >
            <span className="rich-text-highlight-swatch-icon" />
          </ToolbarButton>
          {openPopover === 'highlight' && (
            // biome-ignore lint/a11y/noStaticElementInteractions: mousedown here only preventDefaults so the popover click doesn't steal selection from the editor; the real controls are the child inputs
            <div
              className="rich-text-popover rich-text-popover--color"
              onMouseDown={preventDefault}
            >
              <FieldColorPicker
                label="Highlight color"
                value={state.activeHighlight ?? undefined}
                defaultColor={DEFAULT_HIGHLIGHT_COLOR}
                canEdit
                onChange={(color) => {
                  if (color) {
                    editor.chain().focus().setHighlight({ color }).run();
                  } else {
                    editor.chain().focus().unsetHighlight().run();
                  }
                }}
              />
            </div>
          )}
        </div>

        <div className="rich-text-toolbar-group">
          <ToolbarButton
            label="Align left"
            active={state.activeAlign === 'left' || state.activeAlign === undefined}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
          >
            <AlignLeftIcon />
          </ToolbarButton>
          <ToolbarButton
            label="Align center"
            active={state.activeAlign === 'center'}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
          >
            <AlignCenterIcon />
          </ToolbarButton>
          <ToolbarButton
            label="Align right"
            active={state.activeAlign === 'right'}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
          >
            <AlignRightIcon />
          </ToolbarButton>
          <ToolbarButton
            label="Justify"
            active={state.activeAlign === 'justify'}
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          >
            <AlignJustifyIcon />
          </ToolbarButton>
        </div>

        <div className="rich-text-toolbar-group">
          <ToolbarButton
            label="Numbered list"
            active={state.isOrderedList}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            1.
          </ToolbarButton>
          <ToolbarButton
            label="Bulleted list"
            active={state.isBulletList}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            •
          </ToolbarButton>
          <ToolbarButton
            label="Quote"
            active={state.isBlockquote}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            "
          </ToolbarButton>
          <ToolbarButton
            label="Horizontal rule"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            ―
          </ToolbarButton>
          <ToolbarButton
            label="Code block"
            active={state.isCodeBlock}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          >
            <CodeBlockIcon />
          </ToolbarButton>
        </div>

        <div className="rich-text-toolbar-group">
          <ToolbarButton label="Insert link" active={state.isLink} onClick={insertLink}>
            <LinkIcon />
          </ToolbarButton>
          <ToolbarButton label="Insert image" onClick={insertImage}>
            <ImageIcon />
          </ToolbarButton>
          <ToolbarButton
            label="Clear formatting"
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          >
            <ClearFormatIcon />
          </ToolbarButton>
        </div>

        <div className="rich-text-toolbar-group rich-text-toolbar-group--popover">
          <ToolbarButton
            label="Table"
            active={state.isTable}
            onClick={() => setOpenPopover(openPopover === 'table' ? null : 'table')}
          >
            <TableIcon />
          </ToolbarButton>
          {openPopover === 'table' && (
            // biome-ignore lint/a11y/noStaticElementInteractions: mousedown here only preventDefaults so the popover click doesn't steal selection from the editor; the real controls are the child buttons
            <div className="rich-text-popover" onMouseDown={preventDefault}>
              {!state.isTable ? (
                <button
                  type="button"
                  className="rich-text-popover-item"
                  onMouseDown={preventDefault}
                  onClick={() => {
                    editor
                      .chain()
                      .focus()
                      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                      .run();
                    setOpenPopover(null);
                  }}
                >
                  Insert table
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="rich-text-popover-item"
                    onMouseDown={preventDefault}
                    onClick={() => {
                      editor.chain().focus().addColumnBefore().run();
                      setOpenPopover(null);
                    }}
                  >
                    Insert column before
                  </button>
                  <button
                    type="button"
                    className="rich-text-popover-item"
                    onMouseDown={preventDefault}
                    onClick={() => {
                      editor.chain().focus().addColumnAfter().run();
                      setOpenPopover(null);
                    }}
                  >
                    Insert column after
                  </button>
                  <button
                    type="button"
                    className="rich-text-popover-item"
                    onMouseDown={preventDefault}
                    onClick={() => {
                      editor.chain().focus().deleteColumn().run();
                      setOpenPopover(null);
                    }}
                  >
                    Delete column
                  </button>
                  <button
                    type="button"
                    className="rich-text-popover-item"
                    onMouseDown={preventDefault}
                    onClick={() => {
                      editor.chain().focus().addRowBefore().run();
                      setOpenPopover(null);
                    }}
                  >
                    Insert row before
                  </button>
                  <button
                    type="button"
                    className="rich-text-popover-item"
                    onMouseDown={preventDefault}
                    onClick={() => {
                      editor.chain().focus().addRowAfter().run();
                      setOpenPopover(null);
                    }}
                  >
                    Insert row after
                  </button>
                  <button
                    type="button"
                    className="rich-text-popover-item"
                    onMouseDown={preventDefault}
                    onClick={() => {
                      editor.chain().focus().deleteRow().run();
                      setOpenPopover(null);
                    }}
                  >
                    Delete row
                  </button>
                  <button
                    type="button"
                    className="rich-text-popover-item"
                    disabled={!state.canMergeCells}
                    onMouseDown={preventDefault}
                    onClick={() => {
                      editor.chain().focus().mergeCells().run();
                      setOpenPopover(null);
                    }}
                  >
                    Merge cells
                  </button>
                  <button
                    type="button"
                    className="rich-text-popover-item"
                    disabled={!state.canSplitCell}
                    onMouseDown={preventDefault}
                    onClick={() => {
                      editor.chain().focus().splitCell().run();
                      setOpenPopover(null);
                    }}
                  >
                    Split cell
                  </button>
                  <button
                    type="button"
                    className="rich-text-popover-item rich-text-popover-item--danger"
                    onMouseDown={preventDefault}
                    onClick={() => {
                      editor.chain().focus().deleteTable().run();
                      setOpenPopover(null);
                    }}
                  >
                    Delete table
                  </button>
                </>
              )}
            </div>
          )}
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

      <EditorContent editor={editor} />
    </div>
  );
}
