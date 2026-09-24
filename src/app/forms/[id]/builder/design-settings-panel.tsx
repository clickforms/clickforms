'use client';

import { FieldColorPicker } from '@/app/forms/[id]/builder/field-color-picker';
import {
  DEFAULT_FIELD_TEXT_COLOR,
  DEFAULT_FORM_PRIMARY_COLOR,
  DEFAULT_SUBMIT_BUTTON_TEXT,
  DEFAULT_TABLE_THEME_FIELD_COLUMN_LABEL,
  DEFAULT_TABLE_THEME_VALUE_COLUMN_LABEL,
  FONT_FAMILY_LABEL,
  FONT_FAMILY_OPTIONS,
  type FontFamily,
  type FormBranding,
  LAYOUT_STYLE_LABEL,
  LAYOUT_STYLE_OPTIONS,
  SUBMIT_BUTTON_SIZE_LABEL,
  SUBMIT_BUTTON_SIZE_OPTIONS,
  TEXT_ALIGN_LABEL,
  TEXT_ALIGN_OPTIONS,
} from '@/lib/forms/schema';

// The form-wide branding/theme controls — title visibility, layout style (incl. the
// print-style table theme), and submit button appearance. Extracted out of
// builder-client.tsx's old "Form settings" modal so the exact same controls can render
// both there (kept for mobile, where the new Design rail tab is hidden below 900px — see
// .builder-palette's mobile breakpoint) and inline as the rail's "Design" tab body. No
// local state of its own — everything reads/writes straight through to schema.branding
// via onUpdateBranding, same as before.

interface DesignSettingsPanelProps {
  branding: FormBranding;
  canEdit: boolean;
  onUpdateBranding: (patch: Partial<FormBranding>) => void;
}

export function DesignSettingsPanel({
  branding,
  canEdit,
  onUpdateBranding,
}: DesignSettingsPanelProps) {
  return (
    <>
      <div className="settings-section">
        <p className="settings-section-title">Typography</p>
        <label className="settings-field">
          <span className="settings-label">Font family</span>
          <select
            className="text-input"
            disabled={!canEdit}
            value={branding.fontFamily ?? 'default'}
            onChange={(event) => onUpdateBranding({ fontFamily: event.target.value as FontFamily })}
          >
            {FONT_FAMILY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {FONT_FAMILY_LABEL[option]}
              </option>
            ))}
          </select>
        </label>
        <p className="settings-field-hint">
          Applies to every field's label, help text and input by default. Any field with its own
          font setting (like Formatted Text or a Table's label) keeps its own choice.
        </p>
      </div>
      <div className="settings-section">
        <p className="settings-section-title">Form title</p>
        <label className="settings-toggle-row">
          <span className="settings-label">Show form title</span>
          <input
            type="checkbox"
            checked={branding.showTitle === true}
            disabled={!canEdit}
            onChange={(event) => onUpdateBranding({ showTitle: event.target.checked })}
          />
        </label>
        {branding.showTitle === true ? (
          <div className="settings-width-options">
            {TEXT_ALIGN_OPTIONS.map((align) => (
              <label key={align} className="settings-width-option">
                <input
                  type="radio"
                  name="form-title-align"
                  checked={(branding.titleAlign ?? 'center') === align}
                  disabled={!canEdit}
                  onChange={() => onUpdateBranding({ titleAlign: align })}
                />
                {TEXT_ALIGN_LABEL[align]}
              </label>
            ))}
          </div>
        ) : null}
      </div>
      <div className="settings-section">
        <p className="settings-section-title">Layout</p>
        <div className="settings-width-options">
          {LAYOUT_STYLE_OPTIONS.map((style) => (
            <label key={style} className="settings-width-option">
              <input
                type="radio"
                name="form-layout-style"
                checked={(branding.layoutStyle ?? 'default') === style}
                disabled={!canEdit}
                onChange={() => onUpdateBranding({ layoutStyle: style })}
              />
              {LAYOUT_STYLE_LABEL[style]}
            </label>
          ))}
        </div>
        <p className="settings-field-hint">
          Table lays out every question as one continuous label/answer table, matching a printed
          form.
        </p>
        {branding.layoutStyle === 'table' ? (
          <>
            <div className="settings-inline-fields">
              <label className="settings-field">
                <span className="settings-label">Label column header</span>
                <input
                  type="text"
                  className="text-input"
                  placeholder={DEFAULT_TABLE_THEME_FIELD_COLUMN_LABEL}
                  disabled={!canEdit}
                  value={branding.tableThemeFieldColumnLabel ?? ''}
                  onChange={(event) =>
                    onUpdateBranding({
                      tableThemeFieldColumnLabel: event.target.value || undefined,
                    })
                  }
                />
              </label>
              <label className="settings-field">
                <span className="settings-label">Answer column header</span>
                <input
                  type="text"
                  className="text-input"
                  placeholder={DEFAULT_TABLE_THEME_VALUE_COLUMN_LABEL}
                  disabled={!canEdit}
                  value={branding.tableThemeValueColumnLabel ?? ''}
                  onChange={(event) =>
                    onUpdateBranding({
                      tableThemeValueColumnLabel: event.target.value || undefined,
                    })
                  }
                />
              </label>
            </div>
            <FieldColorPicker
              label="Header background"
              value={branding.tableThemeHeaderColor}
              defaultColor="#ffffff"
              canEdit={canEdit}
              onChange={(color) => onUpdateBranding({ tableThemeHeaderColor: color })}
            />
            <FieldColorPicker
              label="Header text color"
              value={branding.tableThemeHeaderTextColor}
              defaultColor={DEFAULT_FIELD_TEXT_COLOR}
              canEdit={canEdit}
              onChange={(color) => onUpdateBranding({ tableThemeHeaderTextColor: color })}
            />
            <FieldColorPicker
              label="Answer cell background"
              value={branding.tableThemeValueColor}
              defaultColor="#ffffff"
              canEdit={canEdit}
              onChange={(color) => onUpdateBranding({ tableThemeValueColor: color })}
            />
          </>
        ) : null}
      </div>
      <div className="settings-section">
        <p className="settings-section-title">Submit button</p>
        <label className="settings-field">
          <span className="settings-label">Button text</span>
          <input
            type="text"
            className="text-input"
            value={branding.submitButtonText ?? ''}
            placeholder={DEFAULT_SUBMIT_BUTTON_TEXT}
            disabled={!canEdit}
            onChange={(event) =>
              onUpdateBranding({ submitButtonText: event.target.value || undefined })
            }
          />
        </label>
        <FieldColorPicker
          label="Button color"
          value={branding.submitButtonColor}
          defaultColor={DEFAULT_FORM_PRIMARY_COLOR}
          canEdit={canEdit}
          onChange={(color) => onUpdateBranding({ submitButtonColor: color })}
        />
        <FieldColorPicker
          label="Text color"
          value={branding.submitButtonTextColor}
          defaultColor="#ffffff"
          canEdit={canEdit}
          onChange={(color) => onUpdateBranding({ submitButtonTextColor: color })}
        />
        <p className="settings-section-title">Alignment</p>
        <div className="settings-width-options">
          {TEXT_ALIGN_OPTIONS.map((align) => (
            <label key={align} className="settings-width-option">
              <input
                type="radio"
                name="submit-button-align"
                checked={(branding.submitButtonAlign ?? 'center') === align}
                disabled={!canEdit}
                onChange={() => onUpdateBranding({ submitButtonAlign: align })}
              />
              {TEXT_ALIGN_LABEL[align]}
            </label>
          ))}
        </div>
        <p className="settings-section-title">Size</p>
        <div className="settings-width-options">
          {SUBMIT_BUTTON_SIZE_OPTIONS.map((size) => (
            <label key={size} className="settings-width-option">
              <input
                type="radio"
                name="submit-button-size"
                checked={(branding.submitButtonSize ?? 'medium') === size}
                disabled={!canEdit}
                onChange={() => onUpdateBranding({ submitButtonSize: size })}
              />
              {SUBMIT_BUTTON_SIZE_LABEL[size]}
            </label>
          ))}
        </div>
      </div>
    </>
  );
}
