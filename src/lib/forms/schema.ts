import { z } from 'zod';

// Form schema contract (specs/02-form-builder.md) — this is the shape stored in
// `form_versions.schema` (JSONB). Zod is the actual enforcement (ARCHITECTURE.md §3.1:
// "never trust the client alone" applies to admin routes too, not just public submission
// routes — a malformed schema saved here would corrupt the renderer downstream in spec 03).
//
// Every consumer of a form schema — the builder UI, the publish route, and eventually the
// public renderer (spec 03) — should import types and the `formSchemaSchema` validator
// from this one file rather than re-declaring the shape, so the three never drift apart.

// ---------------------------------------------------------------------------
// Field types (v1 set — specs/02-form-builder.md "Scope")
// ---------------------------------------------------------------------------

export const FIELD_TYPES = [
  'short_text',
  'paragraph',
  'multi_choice',
  'checkbox',
  'dropdown',
  'date',
  'time',
  'email',
  'file_upload',
  'signature',
  'section_break',
  'divider',
  'column_layout',
  'static_text',
  'image',
  'address',
  'choice_matrix',
  'number',
  'phone',
  'website',
  'rating',
  'opinion_scale',
  'legal',
  'hidden',
] as const;

export const COLUMN_COUNTS = [2, 3, 4] as const;
export type ColumnCount = (typeof COLUMN_COUNTS)[number];

export type FieldType = (typeof FIELD_TYPES)[number];

// Field types that render a set of selectable options (multi_choice/dropdown are
// single-select, checkbox is multi-select) — the builder's settings panel shows an
// options editor only for these.
export const OPTION_FIELD_TYPES = [
  'multi_choice',
  'checkbox',
  'dropdown',
] as const satisfies readonly FieldType[];

// section_break/divider are visual, not real inputs — they never have an answer and
// "required" is meaningless for them. Excluding them from validation/conditional-logic
// target lists happens at the point of use (see conditional-logic.ts), not here.
export const LAYOUT_ONLY_FIELD_TYPES = [
  'section_break',
  'divider',
  'column_layout',
  'image',
  'static_text',
] as const satisfies readonly FieldType[];

export function isLayoutOnlyField(type: FieldType): boolean {
  return (LAYOUT_ONLY_FIELD_TYPES as readonly string[]).includes(type);
}

const fieldOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export type FieldOption = z.infer<typeof fieldOptionSchema>;

const textValidationSchema = z
  .object({
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().optional(),
  })
  .strict();

const dateValidationSchema = z
  .object({
    // ISO 8601 date strings (YYYY-MM-DD), not full timestamps — form dates (DOB,
    // appointment date, etc.) don't need time-of-day precision.
    minDate: z.string().date().optional(),
    maxDate: z.string().date().optional(),
  })
  .strict();

const fileValidationSchema = z
  .object({
    maxSizeMb: z.number().positive().max(100).optional(),
    // MIME types or extensions, e.g. "application/pdf", ".pdf" — kept as free-form
    // strings rather than an enum since the accepted set will grow with real forms.
    acceptedTypes: z.array(z.string().min(1)).optional(),
  })
  .strict();

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a 6-digit hex value, e.g. #00a960')
  .optional();

// Shared by the static_text field's heading/body "Alignment" controls and the form-level
// branding panel's "Title placement" control — same three positions, same labels.
export const TEXT_ALIGN_OPTIONS = ['left', 'center', 'right'] as const;
export type TextAlign = (typeof TEXT_ALIGN_OPTIONS)[number];
export const TEXT_ALIGN_LABEL: Record<TextAlign, string> = {
  left: 'Left',
  center: 'Center',
  right: 'Right',
};

// Shared by the static_text field's heading and body font-family controls — a small
// curated set of web-safe stacks rather than a free-text field, so every respondent's
// browser (and the PDF export renderer) renders the same thing without a font loader.
export const FONT_FAMILY_OPTIONS = ['default', 'sans-serif', 'serif', 'monospace'] as const;
export type FontFamily = (typeof FONT_FAMILY_OPTIONS)[number];
export const FONT_FAMILY_LABEL: Record<FontFamily, string> = {
  default: 'Default',
  'sans-serif': 'Sans-serif',
  serif: 'Serif',
  monospace: 'Monospace',
};
// 'default' intentionally maps to undefined so it falls through to the surrounding
// theme's font instead of forcing a specific stack.
export const FONT_FAMILY_CSS: Record<FontFamily, string | undefined> = {
  default: undefined,
  'sans-serif': 'Arial, Helvetica, sans-serif',
  serif: "Georgia, 'Times New Roman', serif",
  monospace: "'Courier New', Courier, monospace",
};

// Shared by the static_text field's heading and body "Size" controls — a plain pixel
// number rather than named steps, so an admin can dial in an exact size (e.g. to match
// another element on the page) instead of picking from a fixed set. Bounds keep it sane
// in the rendered form and PDF export; undefined falls through to the existing CSS
// default (1rem/16px for both heading and body — see .form-static-text-heading etc. in
// globals.css).
export const TEXT_FONT_SIZE_MIN_PX = 8;
export const TEXT_FONT_SIZE_MAX_PX = 120;

// Shared by the static_text field's heading and body "Font weight" controls — the
// standard CSS numeric weight scale, from thin to black, so an admin can go past a
// simple on/off bold and pick exactly how heavy the text is. 'default' maps to
// undefined, which falls through to the existing CSS default (700/bold for the heading,
// 400/normal for the body).
export const FONT_WEIGHT_OPTIONS = [
  'default',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
] as const;
export type FontWeightOption = (typeof FONT_WEIGHT_OPTIONS)[number];
export const FONT_WEIGHT_LABEL: Record<FontWeightOption, string> = {
  default: 'Default',
  '100': 'Thin (100)',
  '200': 'Extra Light (200)',
  '300': 'Light (300)',
  '400': 'Normal (400)',
  '500': 'Medium (500)',
  '600': 'Semi Bold (600)',
  '700': 'Bold (700)',
  '800': 'Extra Bold (800)',
  '900': 'Black (900)',
};

// Forms saved before headingFontSize/bodyFontSize switched from named steps to a plain px
// number, or before headingBold/bodyBold switched to headingFontWeight/bodyFontWeight,
// still have the old shape sitting in the DB's JSONB column. Rather than a one-off DB
// migration, this preprocessor rewrites a static_text field object from the legacy shape
// to the current one before it hits the field schema below, so old forms keep rendering
// the size/weight they were saved with instead of failing formSchemaSchema validation and
// silently falling back to an empty draft (see FormBuilderPage's safeParse failure
// branch). New-shape objects pass through untouched.
const LEGACY_HEADING_FONT_SIZE_PX: Record<string, number | undefined> = {
  default: undefined,
  small: 14,
  medium: 18,
  large: 22,
  'x-large': 28,
  'xx-large': 36,
};
const LEGACY_BODY_FONT_SIZE_PX: Record<string, number | undefined> = {
  default: undefined,
  small: 12,
  medium: 15,
  large: 17,
  'x-large': 20,
  'xx-large': 24,
};

function migrateLegacyStaticTextField(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value;
  const obj = value as Record<string, unknown>;
  const migrated: Record<string, unknown> = { ...obj };

  // Old defaults (heading bold, body normal) already match what 'default' resolves to
  // today, so only the non-default boolean needs an explicit numeric weight. Only fall
  // back to the legacy key if the current key isn't already present (new-shape data wins).
  if (obj.headingFontWeight === undefined && typeof obj.headingBold === 'boolean') {
    migrated.headingFontWeight = obj.headingBold === false ? '400' : undefined;
  }
  if (obj.bodyFontWeight === undefined && typeof obj.bodyBold === 'boolean') {
    migrated.bodyFontWeight = obj.bodyBold === true ? '700' : undefined;
  }
  if (obj.headingFontSize === undefined) {
    // no legacy value to migrate
  } else if (typeof obj.headingFontSize === 'string') {
    migrated.headingFontSize = LEGACY_HEADING_FONT_SIZE_PX[obj.headingFontSize];
  }
  if (obj.bodyFontSize === undefined) {
    // no legacy value to migrate
  } else if (typeof obj.bodyFontSize === 'string') {
    migrated.bodyFontSize = LEGACY_BODY_FONT_SIZE_PX[obj.bodyFontSize];
  }

  delete migrated.headingBold;
  delete migrated.bodyBold;
  return migrated;
}

const baseFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  required: z.boolean().default(false),
  helpText: z.string().optional(),
  width: z.enum(['full', 'half', 'third']).optional(),
  backgroundColor: hexColorSchema,
  borderColor: hexColorSchema,
  textColor: hexColorSchema,
  inputBackgroundColor: hexColorSchema,
});

const shortTextFieldSchema = baseFieldSchema.extend({
  type: z.literal('short_text'),
  validation: textValidationSchema.optional(),
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
});

const paragraphFieldSchema = baseFieldSchema.extend({
  type: z.literal('paragraph'),
  validation: textValidationSchema.optional(),
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
  // Textarea row count — undefined falls through to the existing 4-row CSS default.
  rows: z.number().int().min(2).max(20).optional(),
});

// Shared by multi_choice/checkbox/dropdown's "Randomize order" and "Add an 'Other'
// option" toggles — every option-bearing field type behaves identically for these two,
// so the properties (and the option-list-building logic in field-input.tsx that reads
// them) are written once here rather than duplicated per type.
const optionFieldExtras = {
  // Reshuffled once per render session (not on every re-render — see useMemo in
  // field-input.tsx) so the order doesn't jump around while a respondent is answering.
  randomizeOrder: z.boolean().optional(),
  // Appends a synthetic "Other" choice with a free-text box — see ALLOW_OTHER_OPTION_ID
  // in field-input.tsx for how its answer is distinguished from a real option id.
  allowOther: z.boolean().optional(),
};

const multiChoiceFieldSchema = baseFieldSchema.extend({
  type: z.literal('multi_choice'),
  options: z.array(fieldOptionSchema).min(1),
  defaultValue: z.string().optional(),
  ...optionFieldExtras,
});

const checkboxFieldSchema = baseFieldSchema.extend({
  type: z.literal('checkbox'),
  options: z.array(fieldOptionSchema).min(1),
  minSelected: z.number().int().nonnegative().optional(),
  maxSelected: z.number().int().positive().optional(),
  ...optionFieldExtras,
});

const dropdownFieldSchema = baseFieldSchema.extend({
  type: z.literal('dropdown'),
  options: z.array(fieldOptionSchema).min(1),
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
  ...optionFieldExtras,
});

export const DATE_DISPLAY_FORMATS = ['iso', 'us', 'uk'] as const;
export type DateDisplayFormat = (typeof DATE_DISPLAY_FORMATS)[number];
export const DATE_DISPLAY_FORMAT_LABEL: Record<DateDisplayFormat, string> = {
  iso: 'YYYY-MM-DD',
  us: 'MM/DD/YYYY',
  uk: 'DD/MM/YYYY',
};

const dateFieldSchema = baseFieldSchema.extend({
  type: z.literal('date'),
  validation: dateValidationSchema.optional(),
  // 'today' resolves at render time (not baked into the schema at save time) so a
  // published form always defaults to *the respondent's* today, not the day the admin
  // configured the field. A concrete ISO string pins it to one fixed date instead.
  defaultValue: z.union([z.literal('today'), z.string().date()]).optional(),
  displayFormat: z.enum(DATE_DISPLAY_FORMATS).optional(),
});

const timeFieldSchema = baseFieldSchema.extend({
  type: z.literal('time'),
});

const emailFieldSchema = baseFieldSchema.extend({
  type: z.literal('email'),
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
});

const fileUploadFieldSchema = baseFieldSchema.extend({
  type: z.literal('file_upload'),
  validation: fileValidationSchema.optional(),
  // When true, the answer becomes a string[] of SubmissionFile ids instead of a single
  // string — SubmissionFile already has no per-field uniqueness constraint (multiple
  // rows can share the same fieldKey), so this is a front-end-only capability, not a
  // data-model change. maxFiles undefined + multiple:true means "no fixed cap".
  multiple: z.boolean().optional(),
  maxFiles: z.number().int().min(2).max(20).optional(),
});

const signatureFieldSchema = baseFieldSchema.extend({
  type: z.literal('signature'),
});

const sectionBreakFieldSchema = baseFieldSchema.extend({
  type: z.literal('section_break'),
});

// A plain horizontal rule — distinct from section_break, which renders as a colored,
// labeled banner (effectively a "header"). The divider is the actual thin-line/spacer
// element, with an optional short caption.
//
// dividerWidthPx/thicknessPx are continuous pixel values rather than the discrete
// full/half/third `width` enum every other field uses — the builder canvas lets an admin
// drag a handle to resize this field directly (see the resize handles in field-card.tsx),
// which needs a real number to grow/shrink smoothly instead of snapping between presets.
export const DIVIDER_WIDTH_MIN_PX = 40;
export const DIVIDER_WIDTH_MAX_PX = 900;
export const DEFAULT_DIVIDER_WIDTH_PX = 300;
export const DIVIDER_THICKNESS_MIN_PX = 1;
export const DIVIDER_THICKNESS_MAX_PX = 24;
export const DEFAULT_DIVIDER_THICKNESS_PX = 2;
// Matches --color-border-strong in globals.css (the line's CSS default when no
// backgroundColor override is set) so the color-picker's "default" swatch isn't a lie.
export const DEFAULT_DIVIDER_COLOR = '#cbd5e1';

export const DIVIDER_CAPTION_POSITIONS = ['above', 'below'] as const;
export type DividerCaptionPosition = (typeof DIVIDER_CAPTION_POSITIONS)[number];

const dividerFieldSchema = baseFieldSchema.extend({
  type: z.literal('divider'),
  // Overrides base's required `label` — a divider's caption is optional; most are a bare
  // line with no text at all.
  label: z.string().optional(),
  dividerWidthPx: z.number().min(DIVIDER_WIDTH_MIN_PX).max(DIVIDER_WIDTH_MAX_PX).optional(),
  thicknessPx: z.number().min(DIVIDER_THICKNESS_MIN_PX).max(DIVIDER_THICKNESS_MAX_PX).optional(),
  // undefined defaults to 'above' (the original, only rendering position).
  captionPosition: z.enum(DIVIDER_CAPTION_POSITIONS).optional(),
  // Same shape as static_text's independent heading/body style props (see
  // staticTextFieldSchema above) — reuses the same shared TextStyleControls UI.
  captionFontWeight: z.enum(FONT_WEIGHT_OPTIONS).optional(),
  captionFontFamily: z.enum(FONT_FAMILY_OPTIONS).optional(),
  captionFontSize: z.number().min(TEXT_FONT_SIZE_MIN_PX).max(TEXT_FONT_SIZE_MAX_PX).optional(),
  captionAlign: z.enum(TEXT_ALIGN_OPTIONS).optional(),
  captionColor: hexColorSchema,
});

const columnLayoutFieldSchema = baseFieldSchema.extend({
  type: z.literal('column_layout'),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  // A slot holds `null` when empty — new column sections start with every slot empty
  // (the admin picks a field type per-slot in the builder) rather than pre-seeding a
  // real field, so `fieldIds.length` always equals `columns`, but entries may be null.
  fieldIds: z.array(z.string().min(1).nullable()),
});

// Not wrapped in a preprocess directly (that would turn it into a ZodEffects, which
// z.discriminatedUnion below can't accept as a member) — the legacy-shape migration is
// applied one level up, on formFieldSchema, before the value reaches this union member.
// See migrateLegacyStaticTextField above.
const staticTextFieldSchema = z.object({
  id: z.string().min(1),
  type: z.literal('static_text'),
  label: z.string().optional(),
  body: z.string().min(1),
  // Lets an admin use this field as a bare heading/label — e.g. a compact page title —
  // without the rich-text body rendering at all (an empty body still costs an empty
  // paragraph's worth of line-height; this removes it entirely). `body` itself stays
  // required and keeps whatever content was last entered, so toggling this back on
  // doesn't lose anything. undefined/true = show (matches every pre-existing field).
  showBody: z.boolean().optional(),
  required: z.boolean().default(false),
  width: z.enum(['full', 'half', 'third']).optional(),
  backgroundColor: hexColorSchema,
  borderColor: hexColorSchema,
  textColor: hexColorSchema,
  // Heading (the optional plain-text `label`) and body (the rich-text `body`) are styled
  // independently so an admin can, e.g., keep a very bold, large, colorful heading above a
  // smaller left-aligned body — see resolveStaticTextHeadingStyle/resolveStaticTextBodyStyle
  // in lib/forms/field-styles.ts, which turn these into per-element inline styles.
  headingFontWeight: z.enum(FONT_WEIGHT_OPTIONS).optional(),
  headingFontFamily: z.enum(FONT_FAMILY_OPTIONS).optional(),
  headingFontSize: z.number().min(TEXT_FONT_SIZE_MIN_PX).max(TEXT_FONT_SIZE_MAX_PX).optional(),
  headingAlign: z.enum(TEXT_ALIGN_OPTIONS).optional(),
  headingColor: hexColorSchema,
  bodyFontWeight: z.enum(FONT_WEIGHT_OPTIONS).optional(),
  bodyFontFamily: z.enum(FONT_FAMILY_OPTIONS).optional(),
  bodyFontSize: z.number().min(TEXT_FONT_SIZE_MIN_PX).max(TEXT_FONT_SIZE_MAX_PX).optional(),
  bodyAlign: z.enum(TEXT_ALIGN_OPTIONS).optional(),
  bodyColor: hexColorSchema,
});

// Named steps rather than a free pixel value (unlike static_text's font size) — an image's
// natural aspect ratio means a single number only controls one axis usefully, and named
// steps keep the settings-panel control to a plain select. 'default' (like
// FONT_WEIGHT_OPTIONS above) maps to undefined, which falls through to the existing CSS
// defaults in globals.css (72px max-height for a header logo, 120px for an inline image
// field) so existing forms render unchanged until an admin opts in.
export const IMAGE_SIZE_OPTIONS = ['default', 'small', 'medium', 'large', 'full'] as const;
export type ImageSize = (typeof IMAGE_SIZE_OPTIONS)[number];
export const IMAGE_SIZE_LABEL: Record<ImageSize, string> = {
  default: 'Default',
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  full: 'Full width',
};

// Space below the image/logo, before whatever renders next (form title, or the first
// field/section below an inline image). Kept separate from IMAGE_SIZE_OPTIONS because it
// controls the *container's* margin-bottom rather than the image itself — an admin sizing
// the image up doesn't necessarily want more space after it too. 'default' falls through to
// the existing CSS margins (1.25rem for a header logo, 0.5rem for an inline image field), so
// existing forms render unchanged until an admin opts in. See resolveImageSpacingStyle in
// field-styles.ts.
export const IMAGE_SPACING_OPTIONS = ['default', 'none', 'small', 'medium', 'large'] as const;
export type ImageSpacing = (typeof IMAGE_SPACING_OPTIONS)[number];
export const IMAGE_SPACING_LABEL: Record<ImageSpacing, string> = {
  default: 'Default',
  none: 'None',
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
};

// Horizontal placement within the field's container — matches JotForm/Google Forms'
// image alignment control. 'center' is the existing default rendering, so it's the
// implicit fallback when unset (no CSS behavior change for existing forms).
export const IMAGE_ALIGN_OPTIONS = ['left', 'center', 'right'] as const;
export type ImageAlign = (typeof IMAGE_ALIGN_OPTIONS)[number];
export const IMAGE_ALIGN_LABEL: Record<ImageAlign, string> = {
  left: 'Left',
  center: 'Center',
  right: 'Right',
};

const imageFieldSchema = baseFieldSchema.extend({
  type: z.literal('image'),
  imageStorageKey: z.string().min(1).optional(),
  alt: z.string().optional(),
  imageSize: z.enum(IMAGE_SIZE_OPTIONS).optional(),
  imageSpacing: z.enum(IMAGE_SPACING_OPTIONS).optional(),
  align: z.enum(IMAGE_ALIGN_OPTIONS).optional(),
  // Wraps the rendered image in an <a>, opened in a new tab — JotForm's "Link Image".
  // Left unset, the image renders as a plain <img> with no click behavior.
  linkUrl: z.string().url().optional(),
});

// Compound street/suburb/state/postcode field. The answer is stored as a single JSON
// string (parsed by the field's own input/validation/display code) rather than
// widening FormAnswers' value type — every other consumer of an answer value keeps
// treating it as an opaque `string | string[] | undefined`.
const addressFieldSchema = baseFieldSchema.extend({
  type: z.literal('address'),
  // Most single-country deployments (the common case) don't need a country selector
  // cluttering the address block — off by default, matching Typeform/JotForm.
  includeCountry: z.boolean().optional(),
});

// A ratings grid — one row per statement/item, one shared set of columns (e.g. a
// Likert scale) answered per row. Like address, the answer is a single JSON string
// (row id -> column id map), not a new value shape.
const choiceMatrixFieldSchema = baseFieldSchema.extend({
  type: z.literal('choice_matrix'),
  rows: z.array(fieldOptionSchema).min(1),
  columns: z.array(fieldOptionSchema).min(2),
});

const numberValidationSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
    // Purely a UX nicety for the <input type="number"> step attribute (e.g. 0.5 for
    // half-units) — never enforced server-side, since rejecting an off-step value a
    // respondent typed by hand would be a confusing, low-value validation failure.
    step: z.number().positive().optional(),
  })
  .strict();

const numberFieldSchema = baseFieldSchema.extend({
  type: z.literal('number'),
  validation: numberValidationSchema.optional(),
  placeholder: z.string().optional(),
  defaultValue: z.number().optional(),
  // Rendered adjacent to the input rather than baked into the stored value — e.g.
  // prefix "$" + suffix "/mo" around a plain numeric answer, matching Typeform/JotForm's
  // currency- and unit-style number fields without polluting the exported data.
  prefix: z.string().max(8).optional(),
  suffix: z.string().max(8).optional(),
});

// Deliberately a plain string, not a structured country-code + national-number pair —
// v1 has no phone-number library dependency, and a permissive format regex (see
// validate-answers.ts) covers the common "how big companies do it" case of collecting a
// contact number without forcing a specific international format on every respondent.
const phoneFieldSchema = baseFieldSchema.extend({
  type: z.literal('phone'),
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
  // A display hint only (e.g. "+1", "+61") shown ahead of the input to set respondent
  // expectations — not parsed, validated, or split out of the stored answer, keeping the
  // "plain string" shape above intact.
  defaultCountryCode: z.string().max(5).optional(),
});

const websiteFieldSchema = baseFieldSchema.extend({
  type: z.literal('website'),
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
});

// Bounds match what a star-rating control can sensibly render in a form width — undefined
// falls through to 5, matching every competitor's default (Typeform, JotForm, Google Forms).
export const RATING_MAX_MIN = 3;
export const RATING_MAX_MAX = 10;
export const DEFAULT_RATING_MAX = 5;

// Icon swap is purely cosmetic (all three render the same 1..maxRating click/tap
// control) — matches JotForm's star/heart and a thumbs option covering the common
// "simple approval" use case Typeform/JotForm both support via emoji rating.
export const RATING_ICON_OPTIONS = ['star', 'heart', 'thumb'] as const;
export type RatingIcon = (typeof RATING_ICON_OPTIONS)[number];
export const RATING_ICON_LABEL: Record<RatingIcon, string> = {
  star: 'Star',
  heart: 'Heart',
  thumb: 'Thumbs up',
};

const ratingFieldSchema = baseFieldSchema.extend({
  type: z.literal('rating'),
  maxRating: z.number().int().min(RATING_MAX_MIN).max(RATING_MAX_MAX).optional(),
  icon: z.enum(RATING_ICON_OPTIONS).optional(),
  // Hex color for the filled icon state — undefined falls through to the existing
  // --color-primary-derived CSS default, so existing forms render unchanged.
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

// An NPS-style 0-10 (or admin-chosen range) scale with optional end-point labels (e.g.
// "Not likely" / "Very likely") — the single most common "how likely are you to
// recommend..." field shape across every major form builder.
export const OPINION_SCALE_MIN_BOUND = 0;
export const OPINION_SCALE_MAX_BOUND = 10;
export const DEFAULT_OPINION_SCALE_MIN = 0;
export const DEFAULT_OPINION_SCALE_MAX = 10;

const opinionScaleFieldSchema = baseFieldSchema.extend({
  type: z.literal('opinion_scale'),
  scaleMin: z.number().int().min(OPINION_SCALE_MIN_BOUND).max(OPINION_SCALE_MAX_BOUND).optional(),
  scaleMax: z.number().int().min(OPINION_SCALE_MIN_BOUND).max(OPINION_SCALE_MAX_BOUND).optional(),
  minLabel: z.string().optional(),
  maxLabel: z.string().optional(),
  // Optional label under the scale's midpoint (e.g. "Neutral") — SurveyMonkey/Typeform
  // both support a middle anchor in addition to the two end labels.
  midLabel: z.string().optional(),
});

// A single "I agree to ..." consent checkbox with an optional link (Terms of Service,
// Privacy Policy) — kept as its own field type rather than reusing `checkbox` with one
// option, since consent text/link semantics (and legal record-keeping expectations) are
// different enough to deserve dedicated settings and a distinct submission-export label.
const legalFieldSchema = baseFieldSchema.extend({
  type: z.literal('legal'),
  consentText: z.string().min(1),
  linkLabel: z.string().optional(),
  linkUrl: z.string().optional(),
});

// Carries a value the respondent never sees or edits — either a fixed admin-set default,
// or (if `sourceParam` is set) whatever value arrives on the public form URL's query
// string under that param name (e.g. ?ref=partner_x), falling back to `defaultValue` when
// the param is absent. Common use: campaign/UTM tracking, a pre-filled record id linked
// from an external system. Still a real answer (stored, exported, usable in conditional
// logic and merge fields) — just never rendered as a visible input; see FieldInput and
// the "no visible UI" special-casing throughout the builder/renderer for why it isn't in
// LAYOUT_ONLY_FIELD_TYPES despite having no on-page presence.
const hiddenFieldSchema = baseFieldSchema.extend({
  type: z.literal('hidden'),
  sourceParam: z.string().optional(),
  defaultValue: z.string().optional(),
});

const formFieldUnionSchema = z.discriminatedUnion('type', [
  shortTextFieldSchema,
  paragraphFieldSchema,
  multiChoiceFieldSchema,
  checkboxFieldSchema,
  dropdownFieldSchema,
  dateFieldSchema,
  timeFieldSchema,
  emailFieldSchema,
  fileUploadFieldSchema,
  signatureFieldSchema,
  sectionBreakFieldSchema,
  dividerFieldSchema,
  columnLayoutFieldSchema,
  staticTextFieldSchema,
  imageFieldSchema,
  addressFieldSchema,
  choiceMatrixFieldSchema,
  numberFieldSchema,
  phoneFieldSchema,
  websiteFieldSchema,
  ratingFieldSchema,
  opinionScaleFieldSchema,
  legalFieldSchema,
  hiddenFieldSchema,
]);

// Preprocess step (rather than baking the migration into staticTextFieldSchema itself)
// so the individual field schemas above can stay plain ZodObjects, which
// z.discriminatedUnion requires — see migrateLegacyStaticTextField.
export const formFieldSchema = z.preprocess((value) => {
  if (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).type === 'static_text'
  ) {
    return migrateLegacyStaticTextField(value);
  }
  return value;
}, formFieldUnionSchema);

export type FormField = z.infer<typeof formFieldUnionSchema>;

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

const formPageSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  fields: z.array(z.string().min(1)),
});

export type FormPage = z.infer<typeof formPageSchema>;

// ---------------------------------------------------------------------------
// Conditional logic — single-condition show/hide only (spec 02 "Out of scope":
// no nested AND/OR chains in v1).
// ---------------------------------------------------------------------------

const CONDITION_OPERATORS = ['equals', 'not_equals', 'contains'] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

const conditionalRuleSchema = z.object({
  // The field this rule controls the visibility of.
  fieldId: z.string().min(1),
  showIf: z.object({
    // The field whose answer is inspected.
    fieldId: z.string().min(1),
    operator: z.enum(CONDITION_OPERATORS),
    // String for equals/not_equals against a single-value answer (short_text, dropdown,
    // multi_choice, date); string for "contains" against a checkbox (string[]) answer,
    // meaning "the checkbox answer array contains this value".
    value: z.string(),
  }),
});

export type ConditionalRule = z.infer<typeof conditionalRuleSchema>;

// ---------------------------------------------------------------------------
// Branding
// ---------------------------------------------------------------------------

// The submit button's size control on the Form settings modal — a fixed named scale
// (rather than a raw px input, unlike the static_text font-size control) since a button
// only needs a few sane presets, not pixel-precision.
export const SUBMIT_BUTTON_SIZE_OPTIONS = ['small', 'medium', 'large'] as const;
export type SubmitButtonSize = (typeof SUBMIT_BUTTON_SIZE_OPTIONS)[number];
export const SUBMIT_BUTTON_SIZE_LABEL: Record<SubmitButtonSize, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
};

const brandingSchema = z
  .object({
    primaryColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'primaryColor must be a 6-digit hex color, e.g. #00a960')
      .optional(),
    secondaryColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'secondaryColor must be a 6-digit hex color, e.g. #4a90d9')
      .optional(),
    // Whether the form-name hero heading is rendered at all — undefined/false means hidden;
    // an admin must explicitly opt in via the Form settings modal to show it.
    showTitle: z.boolean().optional(),
    titleAlign: z.enum(['left', 'center', 'right']).optional(),
    // Only the final "Submit" button on the last page — the intermediate "Next" button
    // on earlier pages of a multi-page form always keeps its own label, since renaming
    // it would be confusing (it doesn't submit anything yet).
    submitButtonText: z.string().min(1).max(60).optional(),
    submitButtonColor: hexColorSchema,
    submitButtonTextColor: hexColorSchema,
    submitButtonAlign: z.enum(['left', 'center', 'right']).optional(),
    submitButtonSize: z.enum(SUBMIT_BUTTON_SIZE_OPTIONS).optional(),
  })
  .strict();

export type FormBranding = z.infer<typeof brandingSchema>;

export const DEFAULT_FORM_PRIMARY_COLOR = '#00a960';
export const DEFAULT_FORM_SECONDARY_COLOR = '#4a90d9';
export const DEFAULT_SUBMIT_BUTTON_TEXT = 'Submit';

/** Preset swatches shown in the builder color picker. */
export const FIELD_COLOR_PRESETS = [
  '#00a960',
  '#059669',
  '#0ea5e9',
  '#4f46e5',
  '#7c6fd6',
  '#ca8a04',
  '#ea580c',
  '#dc2626',
  '#ffffff',
  '#f4f6fa',
  '#64748b',
  '#111827',
] as const;

export const DEFAULT_SECTION_COLOR = '#7c6fd6';
export const DEFAULT_FIELD_BORDER_COLOR = '#e2e8f0';
export const DEFAULT_FIELD_TEXT_COLOR = '#111827';
export const DEFAULT_FIELD_INPUT_BG_COLOR = '#ffffff';

export function getFieldBackgroundColor(field: FormField): string | undefined {
  if (!('backgroundColor' in field)) return undefined;
  return field.backgroundColor;
}

export function resolveSectionBreakColor(field: FormField): string {
  if (field.type !== 'section_break') return DEFAULT_SECTION_COLOR;
  return field.backgroundColor ?? DEFAULT_SECTION_COLOR;
}

// ---------------------------------------------------------------------------
// Top-level form schema
// ---------------------------------------------------------------------------

export const formSchemaSchema = z
  .object({
    pages: z.array(formPageSchema).min(1),
    fields: z.record(z.string(), formFieldSchema),
    conditionalLogic: z.array(conditionalRuleSchema),
    branding: brandingSchema,
  })
  .superRefine((schema, ctx) => {
    const fieldIds = new Set(Object.keys(schema.fields));

    // Every fieldId referenced by a page must exist in `fields`, and vice versa isn't
    // required (a field could theoretically be orphaned mid-edit, but every page
    // reference must resolve — a dangling reference is what would actually break the
    // renderer).
    for (const page of schema.pages) {
      for (const fieldId of page.fields) {
        if (!fieldIds.has(fieldId)) {
          ctx.addIssue({
            code: 'custom',
            message: `Page "${page.id}" references unknown field "${fieldId}"`,
            path: ['pages'],
          });
        }
      }
    }

    const topLevelFieldIds = new Set(schema.pages.flatMap((page) => page.fields));

    for (const field of Object.values(schema.fields)) {
      if (field.type !== 'column_layout') continue;

      if (field.fieldIds.length !== field.columns) {
        ctx.addIssue({
          code: 'custom',
          message: `Column layout "${field.id}" must have exactly ${field.columns} slot(s)`,
          path: ['fields', field.id],
        });
      }

      for (const childId of field.fieldIds) {
        if (childId === null) continue; // empty slot — valid, nothing to cross-check
        if (!fieldIds.has(childId)) {
          ctx.addIssue({
            code: 'custom',
            message: `Column layout "${field.id}" references unknown field "${childId}"`,
            path: ['fields', field.id],
          });
        }
        if (topLevelFieldIds.has(childId)) {
          ctx.addIssue({
            code: 'custom',
            message: `Field "${childId}" is nested in a column layout and also listed on a page`,
            path: ['fields', childId],
          });
        }
      }
    }

    for (const rule of schema.conditionalLogic) {
      if (!fieldIds.has(rule.fieldId)) {
        ctx.addIssue({
          code: 'custom',
          message: `Conditional rule references unknown target field "${rule.fieldId}"`,
          path: ['conditionalLogic'],
        });
      }
      if (!fieldIds.has(rule.showIf.fieldId)) {
        ctx.addIssue({
          code: 'custom',
          message: `Conditional rule references unknown trigger field "${rule.showIf.fieldId}"`,
          path: ['conditionalLogic'],
        });
      }
      if (rule.fieldId === rule.showIf.fieldId) {
        ctx.addIssue({
          code: 'custom',
          message: `Field "${rule.fieldId}" cannot have a conditional rule that depends on itself`,
          path: ['conditionalLogic'],
        });
      }
    }
  });

export type FormSchema = z.infer<typeof formSchemaSchema>;

/** A brand-new form/draft starts with one empty page and nothing else. */
/** Child field ids nested inside column layouts on a page (not listed in page.fields). */
export function getNestedFieldIdsOnPage(
  page: FormPage,
  fields: Record<string, FormField>,
): string[] {
  const nested: string[] = [];
  for (const fieldId of page.fields) {
    const field = fields[fieldId];
    if (field?.type === 'column_layout') {
      nested.push(...field.fieldIds.filter((id): id is string => id !== null));
    }
  }
  return nested;
}

/** Whether a field appears on a page, including inside a column layout. */
export function pageContainsField(
  page: FormPage,
  fieldId: string,
  fields: Record<string, FormField>,
): boolean {
  if (page.fields.includes(fieldId)) return true;
  return getNestedFieldIdsOnPage(page, fields).includes(fieldId);
}

/** All field ids on a page — top-level entries plus children of column layouts. */
export function expandPageFieldIds(page: FormPage, fields: Record<string, FormField>): string[] {
  const ids: string[] = [];
  for (const fieldId of page.fields) {
    ids.push(fieldId);
    const field = fields[fieldId];
    if (field?.type === 'column_layout') {
      ids.push(...field.fieldIds.filter((id): id is string => id !== null));
    }
  }
  return ids;
}

/** Every field id removed when deleting a page (including nested column children). */
export function collectPageFieldIds(page: FormPage, fields: Record<string, FormField>): string[] {
  return expandPageFieldIds(page, fields);
}

export function createEmptyFormSchema(firstPageTitle = 'Page 1'): FormSchema {
  return {
    pages: [{ id: crypto.randomUUID(), title: firstPageTitle, fields: [] }],
    fields: {},
    conditionalLogic: [],
    branding: {},
  };
}
