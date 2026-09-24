import { Extension } from '@tiptap/core';
import '@tiptap/extension-text-style';

// Tiptap doesn't ship a stable official font-size extension for v3 (only a `next`
// pre-release), so this follows the well-documented community recipe instead: add a
// `fontSize` attribute to the existing TextStyle mark (already in use for text/highlight
// color — see rich-text-editor.tsx) rather than introducing a whole new mark. TextStyle
// renders as a plain `<span style="...">`, so this just appends `font-size: Npx` to that
// same inline style attribute alongside color, exactly like Tiptap's own FontFamily
// extension does for `font-family`.
export interface FontSizeOptions {
  types: string[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      /** Sets the font size (CSS value, e.g. "18px") on the current selection. */
      setFontSize: (fontSize: string) => ReturnType;
      /** Removes any explicit font size, falling back to the surrounding text's default. */
      unsetFontSize: () => ReturnType;
    };
  }
}

export const FontSize = Extension.create<FontSizeOptions>({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
        },
    };
  },
});
