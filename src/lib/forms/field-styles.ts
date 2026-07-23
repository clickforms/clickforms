import type { CSSProperties } from 'react';
import {
  DEFAULT_DIVIDER_THICKNESS_PX,
  DEFAULT_DIVIDER_WIDTH_PX,
  FONT_FAMILY_CSS,
  type FontFamily,
  type FontWeightOption,
  type FormField,
  type ImageSize,
  type ImageSpacing,
  type TextAlign,
} from '@/lib/forms/schema';

type ColoredField = FormField & {
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  inputBackgroundColor?: string;
};

// static_text's heading (the optional plain-text `label`) and body (the rich-text
// `body`) are styled independently — see resolveStaticTextHeadingStyle/
// resolveStaticTextBodyStyle below.
type StaticTextStyledField = FormField & {
  headingFontWeight?: FontWeightOption;
  headingFontFamily?: FontFamily;
  headingFontSize?: number;
  headingAlign?: TextAlign;
  headingColor?: string;
  bodyFontWeight?: FontWeightOption;
  bodyFontFamily?: FontFamily;
  bodyFontSize?: number;
  bodyAlign?: TextAlign;
  bodyColor?: string;
};

// 'default'/undefined falls through to the existing CSS default (.form-static-text-heading
// etc. in globals.css: 700 for heading, 400 for body).
function resolveFontWeight(option: FontWeightOption | undefined): number | undefined {
  if (!option || option === 'default') return undefined;
  return Number(option);
}

function asColoredField(field: FormField): ColoredField {
  return field as ColoredField;
}

function asStaticTextStyledField(field: FormField): StaticTextStyledField {
  return field as StaticTextStyledField;
}

export function fieldHasCustomAppearance(field: FormField): boolean {
  const colored = asColoredField(field);
  return Boolean(
    colored.backgroundColor ||
      colored.borderColor ||
      colored.textColor ||
      colored.inputBackgroundColor,
  );
}

/** Styles for the field card / instruction block container. */
export function resolveFieldContainerStyle(field: FormField): CSSProperties {
  const colored = asColoredField(field);
  const style: CSSProperties = {};

  if (colored.backgroundColor) {
    style.backgroundColor = colored.backgroundColor;
  }
  if (colored.borderColor) {
    style.borderColor = colored.borderColor;
    style.borderWidth = '1px';
    style.borderStyle = 'solid';
  }
  if (colored.textColor) {
    style.color = colored.textColor;
  }

  return style;
}

/** Styles for a static_text field's optional heading (the plain-text `label`, rendered
 * as a <p>) — independent of resolveStaticTextBodyStyle so heading and body can each
 * have their own bold/font/alignment. */
export function resolveStaticTextHeadingStyle(field: FormField): CSSProperties {
  const styled = asStaticTextStyledField(field);
  const style: CSSProperties = {};

  const fontWeight = resolveFontWeight(styled.headingFontWeight);
  if (fontWeight !== undefined) {
    style.fontWeight = fontWeight;
  }
  if (styled.headingFontFamily) {
    const fontFamily = FONT_FAMILY_CSS[styled.headingFontFamily];
    if (fontFamily) style.fontFamily = fontFamily;
  }
  if (styled.headingFontSize) {
    style.fontSize = `${styled.headingFontSize}px`;
  }
  if (styled.headingColor) {
    style.color = styled.headingColor;
  }
  if (styled.headingAlign) {
    style.textAlign = styled.headingAlign;
  }

  return style;
}

/** Styles for a static_text field's rich-text body container — sets block-level
 * defaults (bold/font/alignment) that apply to the whole body, on top of whatever
 * per-selection formatting the admin already applied in the rich text editor. */
export function resolveStaticTextBodyStyle(field: FormField): CSSProperties {
  const styled = asStaticTextStyledField(field);
  const style: CSSProperties = {};

  const fontWeight = resolveFontWeight(styled.bodyFontWeight);
  if (fontWeight !== undefined) {
    style.fontWeight = fontWeight;
  }
  if (styled.bodyFontFamily) {
    const fontFamily = FONT_FAMILY_CSS[styled.bodyFontFamily];
    if (fontFamily) style.fontFamily = fontFamily;
  }
  if (styled.bodyFontSize) {
    style.fontSize = `${styled.bodyFontSize}px`;
  }
  if (styled.bodyColor) {
    style.color = styled.bodyColor;
  }
  if (styled.bodyAlign) {
    style.textAlign = styled.bodyAlign;
  }

  return style;
}

/** Styles for section break banners. */
export function resolveSectionBreakStyle(field: FormField): CSSProperties {
  const colored = asColoredField(field);
  const style: CSSProperties = {};

  if (colored.backgroundColor) {
    style.backgroundColor = colored.backgroundColor;
  }

  if (colored.borderColor) {
    style.borderColor = colored.borderColor;
    style.borderWidth = '1px';
    style.borderStyle = 'solid';
  }
  if (colored.textColor) {
    style.color = colored.textColor;
  }

  return style;
}

type DividerField = FormField & { dividerWidthPx?: number; thicknessPx?: number };

/** Width of a divider's line, in px — the container it sits in is always full-row, but the
 * rule itself can be narrower and is centered (see .divider-line in globals.css). Drag-resized
 * on the canvas (see the resize handles in field-card.tsx), hence a real px number rather than
 * the full/half/third `width` enum every other field type uses. */
export function resolveDividerWrapStyle(field: FormField): CSSProperties {
  const divider = field as DividerField;
  return { width: `${divider.dividerWidthPx ?? DEFAULT_DIVIDER_WIDTH_PX}px` };
}

/** Thickness (and optional custom color) of a divider's line itself. */
export function resolveDividerLineStyle(field: FormField): CSSProperties {
  const divider = field as DividerField;
  const colored = asColoredField(field);
  const style: CSSProperties = {
    height: `${divider.thicknessPx ?? DEFAULT_DIVIDER_THICKNESS_PX}px`,
  };
  if (colored.backgroundColor) {
    style.backgroundColor = colored.backgroundColor;
  }
  return style;
}

type DividerCaptionStyledField = FormField & {
  captionFontWeight?: FontWeightOption;
  captionFontFamily?: FontFamily;
  captionFontSize?: number;
  captionAlign?: TextAlign;
  captionColor?: string;
};

/** Styles for a divider's optional caption — same shape as static_text's independent
 * heading/body style props (see resolveStaticTextHeadingStyle above), reusing the same
 * shared TextStyleControls settings-panel UI. */
export function resolveDividerCaptionStyle(field: FormField): CSSProperties {
  const styled = field as DividerCaptionStyledField;
  const style: CSSProperties = {};

  const fontWeight = resolveFontWeight(styled.captionFontWeight);
  if (fontWeight !== undefined) {
    style.fontWeight = fontWeight;
  }
  if (styled.captionFontFamily) {
    const fontFamily = FONT_FAMILY_CSS[styled.captionFontFamily];
    if (fontFamily) style.fontFamily = fontFamily;
  }
  if (styled.captionFontSize) {
    style.fontSize = `${styled.captionFontSize}px`;
  }
  if (styled.captionColor) {
    style.color = styled.captionColor;
  }
  if (styled.captionAlign) {
    style.textAlign = styled.captionAlign;
  }

  return style;
}

// Applied on top of the CSS defaults (.form-renderer-logo-img / .form-image-field-img /
// etc. in globals.css), which stay in place as the 'undefined' (no imageSize set) case so
// existing forms keep rendering exactly as before. `full` clears the cap entirely rather
// than picking a large fixed number, since "as big as the layout allows" is what an admin
// reaching for the top step of the scale usually wants.
const IMAGE_SIZE_MAX_HEIGHT_PX: Record<Exclude<ImageSize, 'default' | 'full'>, number> = {
  small: 72,
  medium: 160,
  large: 280,
};

/** Max-height override for an image field/header logo — see resolveFieldInputStyle above
 * for the general per-field style pattern this follows. */
export function resolveImageStyle(field: FormField): CSSProperties {
  const imageSize = (field as FormField & { imageSize?: ImageSize }).imageSize;
  if (!imageSize || imageSize === 'default') return {};
  if (imageSize === 'full') return { maxHeight: 'none', maxWidth: '100%' };
  return { maxHeight: `${IMAGE_SIZE_MAX_HEIGHT_PX[imageSize]}px`, maxWidth: '100%' };
}

// Overrides the container's margin-bottom (.form-renderer-logo's 1.25rem, .form-image-field's
// 0.5rem, etc. in globals.css) so an admin can close the gap between a logo/image and whatever
// renders next, instead of it being a fixed value baked into the CSS. 'none' collapses it to 0
// rather than just being unset, since that's the whole point of the option existing.
const IMAGE_SPACING_PX: Record<Exclude<ImageSpacing, 'default'>, number> = {
  none: 0,
  small: 8,
  medium: 20,
  large: 40,
};

/** Margin-bottom override for the container wrapping an image field/header logo — see
 * resolveImageStyle above for the sizing counterpart to this spacing control. */
export function resolveImageSpacingStyle(field: FormField): CSSProperties {
  const imageSpacing = (field as FormField & { imageSpacing?: ImageSpacing }).imageSpacing;
  if (!imageSpacing || imageSpacing === 'default') return {};
  return { marginBottom: `${IMAGE_SPACING_PX[imageSpacing]}px` };
}

/** Styles for inputs, textareas, and other answer controls. */
export function resolveFieldInputStyle(field: FormField): CSSProperties {
  const colored = asColoredField(field);
  const style: CSSProperties = {};

  if (colored.inputBackgroundColor) {
    style.backgroundColor = colored.inputBackgroundColor;
  }
  if (colored.borderColor) {
    style.borderColor = colored.borderColor;
  }

  return style;
}
