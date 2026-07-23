'use client';

import { FieldColorPicker } from '@/app/forms/[id]/builder/field-color-picker';
import type { FieldPatch } from '@/app/forms/[id]/builder/schema-mutations';
import {
  DEFAULT_DIVIDER_COLOR,
  DEFAULT_FIELD_BORDER_COLOR,
  DEFAULT_FIELD_INPUT_BG_COLOR,
  DEFAULT_FIELD_TEXT_COLOR,
  DEFAULT_SECTION_COLOR,
  type FormField,
  isLayoutOnlyField,
} from '@/lib/forms/schema';

interface FieldColorSettingsProps {
  field: FormField;
  canEdit: boolean;
  onUpdateField: (fieldId: string, patch: FieldPatch) => void;
}

export function FieldColorSettings({ field, canEdit, onUpdateField }: FieldColorSettingsProps) {
  const isSectionBreak = field.type === 'section_break';
  const isStaticText = field.type === 'static_text';
  const isImage = field.type === 'image';
  const isDivider = field.type === 'divider';
  const hasInputControls = !isLayoutOnlyField(field.type) && !isImage;

  const colored = field as FormField & {
    backgroundColor?: string;
    borderColor?: string;
    textColor?: string;
    inputBackgroundColor?: string;
  };

  // A divider has no border or input surface of its own — its "background" swatch
  // (backgroundColor) is really the line's own color, so it gets a single, differently
  // labeled picker instead of the full background/border/text/input set below.
  if (isDivider) {
    return (
      <div className="field-color-settings">
        <FieldColorPicker
          label="Line color"
          value={colored.backgroundColor}
          defaultColor={colored.backgroundColor ?? DEFAULT_DIVIDER_COLOR}
          canEdit={canEdit}
          onChange={(backgroundColor) => onUpdateField(field.id, { backgroundColor })}
        />
      </div>
    );
  }

  const backgroundDefault = isSectionBreak ? DEFAULT_SECTION_COLOR : '#ffffff';

  return (
    <div className="field-color-settings">
      <FieldColorPicker
        label={isSectionBreak ? 'Section background' : 'Background'}
        value={colored.backgroundColor}
        defaultColor={
          isSectionBreak ? (colored.backgroundColor ?? DEFAULT_SECTION_COLOR) : backgroundDefault
        }
        canEdit={canEdit}
        onChange={(backgroundColor) => onUpdateField(field.id, { backgroundColor })}
      />
      <FieldColorPicker
        label="Border"
        value={colored.borderColor}
        defaultColor={DEFAULT_FIELD_BORDER_COLOR}
        canEdit={canEdit}
        onChange={(borderColor) => onUpdateField(field.id, { borderColor })}
      />
      {/* static_text has independent "Color" pickers per heading/body in its Heading
       * style / Body style sections instead — a shared swatch here would be redundant
       * and wouldn't actually apply once a heading/body color is set (those take
       * precedence as more specific inline styles). */}
      {!isStaticText ? (
        <FieldColorPicker
          label="Label & text"
          value={colored.textColor}
          defaultColor={DEFAULT_FIELD_TEXT_COLOR}
          canEdit={canEdit}
          onChange={(textColor) => onUpdateField(field.id, { textColor })}
        />
      ) : null}
      {hasInputControls ? (
        <FieldColorPicker
          label="Input area"
          value={colored.inputBackgroundColor}
          defaultColor={DEFAULT_FIELD_INPUT_BG_COLOR}
          canEdit={canEdit}
          onChange={(inputBackgroundColor) => onUpdateField(field.id, { inputBackgroundColor })}
        />
      ) : null}
    </div>
  );
}
