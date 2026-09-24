import { Node } from '@tiptap/core';

// A custom Tiptap node for the "Insert form answers" merge-field chips (see
// src/lib/forms/merge-fields.ts for what these are and how they get resolved into real
// answer text on the public form / preview). Modeled as an atom inline node — a single
// indivisible unit the cursor skips over rather than steps into, like an emoji or an
// @-mention chip — so a respondent's answer label can never be partially edited or split
// by the caret.
//
// parseHTML/renderHTML deliberately preserve the exact markup shape the *previous*,
// hand-built contentEditable editor produced (`<span class="merge-token"
// data-field-id="...">Label</span>`, attributes in that literal order) rather than
// whatever Tiptap's own defaults would pick. Two reasons this matters:
//   1. Every static_text field body already stored in the database was written by that
//      old editor. Loading one into this new editor has to recognize its merge-token
//      spans as real merge-token nodes (parseHTML), not inert text.
//   2. resolveMergeFieldsForRespondent/resolveMergeFieldsForPreview (merge-fields.ts)
//      regex-match this markup outside of any editor — in the public renderer and the
//      builder canvas preview. Its regex is attribute-order-agnostic (hardened
//      specifically for this), but keeping the literal order identical here is the
//      simplest way to guarantee both old and new content round-trip byte-for-byte.
export interface MergeTokenAttributes {
  fieldId: string;
  label: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mergeToken: {
      /** Inserts a merge-token chip at the current selection. */
      insertMergeToken: (attrs: MergeTokenAttributes) => ReturnType;
    };
  }
}

export const MergeToken = Node.create({
  name: 'mergeToken',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      fieldId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-field-id'),
        renderHTML: () => ({}),
      },
      label: {
        default: '',
        parseHTML: (element) => element.textContent ?? '',
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span.merge-token[data-field-id]' }];
  },

  renderHTML({ node }) {
    return [
      'span',
      {
        class: 'merge-token',
        'data-field-id': node.attrs.fieldId,
        contenteditable: 'false',
      },
      node.attrs.label,
    ];
  },

  renderText({ node }) {
    return node.attrs.label;
  },

  addCommands() {
    return {
      insertMergeToken:
        (attrs: MergeTokenAttributes) =>
        ({ chain }) => {
          return chain().insertContent({ type: this.name, attrs }).run();
        },
    };
  },
});
