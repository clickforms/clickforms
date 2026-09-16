import type { CSSProperties } from 'react';
import {
  SubmissionFieldDisplay,
  submissionFieldWidthClass,
} from '@/components/submission-export/submission-field-display';
import type { FormAnswers } from '@/lib/forms/conditional-logic';
import { getVisibleFieldIds } from '@/lib/forms/conditional-logic';
import { resolveImageSpacingStyle, resolveImageStyle } from '@/lib/forms/field-styles';
import { partitionHeaderLogos, splitFormTitle } from '@/lib/forms/form-title';
import type { ResolvedSubmissionFile } from '@/lib/forms/format-submission-answer';
import {
  DEFAULT_FORM_PRIMARY_COLOR,
  DEFAULT_FORM_SECONDARY_COLOR,
  type FormSchema,
} from '@/lib/forms/schema';
import type { SubmissionExportAssets } from '@/lib/forms/submission-export-assets';

interface SubmissionFormExportDocumentProps {
  formName: string;
  schema: FormSchema;
  answers: FormAnswers;
  assets: SubmissionExportAssets;
  resolveFiles: (fieldId: string) => ResolvedSubmissionFile[];
}

export function SubmissionFormExportDocument({
  formName,
  schema,
  answers,
  assets,
  resolveFiles,
}: SubmissionFormExportDocumentProps) {
  const visibleFieldIds = getVisibleFieldIds(schema, answers);
  const { primary: titlePrimary, secondary: titleSecondary } = splitFormTitle(formName);
  const isMultiPage = schema.pages.length > 1;
  const showFormTitle = schema.branding.showTitle === true;
  const titleAlign = schema.branding.titleAlign ?? 'center';
  const primaryColor = schema.branding.primaryColor ?? DEFAULT_FORM_PRIMARY_COLOR;
  const secondaryColor = schema.branding.secondaryColor ?? DEFAULT_FORM_SECONDARY_COLOR;

  const firstPage = schema.pages[0];
  const firstPageFieldIds = firstPage
    ? firstPage.fields.filter((fieldId) => visibleFieldIds.has(fieldId))
    : [];
  const { headerLogoIds } = partitionHeaderLogos(firstPageFieldIds, schema.fields);

  // Uploaded images embed by default (embedInExport !== false — see the schema comment on
  // fileUploadFieldSchema.embedInExport) but always land in a trailing "Attachments"
  // section rather than inline at the field's position, so a large photo/scan never
  // disrupts the form's own visual flow. The section is forced onto its own page via CSS
  // (break-before: page below) so it's always the last thing in the export.
  const attachments: {
    fieldId: string;
    fieldLabel: string;
    file: ResolvedSubmissionFile;
    dataUrl: string;
  }[] = [];
  for (const field of Object.values(schema.fields)) {
    if (field.type !== 'file_upload') continue;
    if (!visibleFieldIds.has(field.id)) continue;
    if (field.embedInExport === false) continue;
    for (const file of resolveFiles(field.id)) {
      const dataUrl = assets.submissionFiles[file.id];
      if (dataUrl) attachments.push({ fieldId: field.id, fieldLabel: field.label, file, dataUrl });
    }
  }

  return (
    <div
      className="export-form"
      style={
        {
          '--color-primary': primaryColor,
          '--form-secondary-color': secondaryColor,
        } as CSSProperties
      }
    >
      <div className="export-form-card">
        <header className="export-form-hero" style={{ textAlign: titleAlign }}>
          {headerLogoIds.map((fieldId) => {
            const field = schema.fields[fieldId];
            const src = field?.type === 'image' ? assets.fieldImages[fieldId] : null;
            if (field?.type !== 'image' || !src) return null;
            return (
              <div
                key={fieldId}
                className="export-form-logo"
                style={resolveImageSpacingStyle(field)}
              >
                {/* biome-ignore lint/performance/noImgElement: dynamic/presigned image URLs; next/image is a poor fit here */}
                <img src={src} alt={field.alt ?? field.label} style={resolveImageStyle(field)} />
              </div>
            );
          })}
          {showFormTitle ? (
            <h1 className="export-form-title">
              <span className="export-form-title-primary">{titlePrimary}</span>
              {titleSecondary ? (
                <>
                  {' '}
                  <span className="export-form-title-secondary">{titleSecondary}</span>
                </>
              ) : null}
            </h1>
          ) : null}
        </header>

        {schema.pages.map((page) => {
          const pageFieldIds = page.fields.filter((fieldId) => visibleFieldIds.has(fieldId));
          const { bodyFieldIds } = partitionHeaderLogos(pageFieldIds, schema.fields);
          const pageUsesSectionBreaks = page.fields.some(
            (fieldId) => schema.fields[fieldId]?.type === 'section_break',
          );
          const showPageTitle = isMultiPage && !pageUsesSectionBreaks;

          if (bodyFieldIds.length === 0) return null;

          return (
            <section key={page.id} className="export-form-page">
              {showPageTitle ? <h2 className="export-form-page-title">{page.title}</h2> : null}
              <div className="export-field-list">
                {bodyFieldIds.map((fieldId) => {
                  const field = schema.fields[fieldId];
                  if (!field) return null;

                  if (field.type === 'column_layout') {
                    const visibleChildren = field.fieldIds.filter(
                      (childId): childId is string =>
                        childId !== null && visibleFieldIds.has(childId),
                    );
                    if (visibleChildren.length === 0) return null;
                    return (
                      <div
                        key={fieldId}
                        className={`export-field-cell ${submissionFieldWidthClass(field)}`}
                      >
                        <div className="export-column-layout">
                          <div
                            className={`export-column-layout-grid export-column-layout-grid--${field.columns}`}
                          >
                            {visibleChildren.map((childId) => {
                              const child = schema.fields[childId];
                              if (!child) return null;
                              return (
                                <div key={childId} className="export-field-cell">
                                  <SubmissionFieldDisplay
                                    field={child}
                                    value={answers[childId]}
                                    allFields={schema.fields}
                                    answers={answers}
                                    assets={assets}
                                    resolveFiles={resolveFiles}
                                    disableOptionGrid
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={fieldId}
                      className={`export-field-cell ${submissionFieldWidthClass(field)}`}
                    >
                      <SubmissionFieldDisplay
                        field={field}
                        value={answers[fieldId]}
                        allFields={schema.fields}
                        answers={answers}
                        assets={assets}
                        resolveFiles={resolveFiles}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {attachments.length > 0 ? (
          <section className="export-attachments-section">
            <h2 className="export-form-page-title">Attachments</h2>
            {attachments.map(({ fieldId, fieldLabel, file, dataUrl }) => (
              <div key={`${fieldId}-${file.id}`} className="export-attachment-item">
                <p className="export-attachment-caption">
                  {fieldLabel} — {file.filename}
                </p>
                {/* biome-ignore lint/performance/noImgElement: dynamic/presigned image URLs; next/image is a poor fit here */}
                <img className="export-attachment-image" src={dataUrl} alt={file.filename} />
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}
