'use client';

import type { CSSProperties } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FieldInput } from '@/app/f/[slug]/field-input';
import type { FormAnswers } from '@/lib/forms/conditional-logic';
import { getVisibleFieldIds } from '@/lib/forms/conditional-logic';
import { getFieldImageSrc } from '@/lib/forms/field-image';
import { resolveImageSpacingStyle, resolveImageStyle } from '@/lib/forms/field-styles';
import { getFieldWidthClass } from '@/lib/forms/field-width';
import { partitionHeaderLogos, splitFormTitle } from '@/lib/forms/form-title';
import {
  DEFAULT_FORM_PRIMARY_COLOR,
  DEFAULT_FORM_SECONDARY_COLOR,
  DEFAULT_SUBMIT_BUTTON_TEXT,
  type FormSchema,
  pageContainsField,
} from '@/lib/forms/schema';
import type { AnswerErrors } from '@/lib/forms/validate-answers';
import { validateAnswers, validatePageAnswers } from '@/lib/forms/validate-answers';

// Public, unauthenticated multi-page form wizard (specs/03-form-renderer.md). Progress
// lives only in React state — no localStorage/sessionStorage — so a refresh loses
// in-progress answers on purpose (save-and-resume-by-email is explicitly deferred).
//
// The submission row is created lazily, on first file/signature upload or on final
// Submit — never just from opening the form. It used to be created eagerly in a
// mount effect, which meant every page load (including every click of the admin's
// "Preview form" link, which opens this exact same public URL) permanently wrote an
// empty 'in_progress' Submission row, silently flooding the Responses table.

interface FormRendererClientProps {
  slug: string;
  /** Only needed by the admin-only preview route so image fields can resolve against the
   * draft version instead of the slug route, which requires the form to be published (see
   * lib/forms/field-image.ts). Unused on the real public /f/[slug] page. */
  formId?: string;
  formName: string;
  // Available for bookkeeping, but every API route below derives the effective
  // formVersionId itself from the submission row it created, so nothing here needs to
  // pass it back.
  formVersionId: string;
  schema: FormSchema;
  // Set by the admin-only /f/[slug]/preview route (see that page for why it exists —
  // in short, it's the only way to preview a draft that hasn't been published yet).
  // Every network side effect below is short-circuited so a preview never creates a real
  // Submission row, presigns a real upload, or requires the form to be published.
  previewMode?: boolean;
}

interface PresignResponse {
  uploadUrl?: string;
  storageKey?: string;
  error?: string;
}

interface ConfirmResponse {
  fileId?: string;
  error?: string;
}

interface SubmitResponse {
  submissionId?: string;
  status?: string;
  error?: string;
  fieldErrors?: AnswerErrors;
}

export function FormRendererClient({
  slug,
  formId,
  formName,
  schema,
  previewMode = false,
}: FormRendererClientProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [errors, setErrors] = useState<AnswerErrors>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Lazily creates (once) and caches the submission row's id. Guarded by a ref rather
  // than state so concurrent callers (e.g. two file fields uploaded in quick
  // succession) await the same in-flight request instead of each firing their own
  // POST. Cleared on failure so the next attempt can retry.
  const submissionIdRef = useRef<string | null>(null);
  const submissionPromiseRef = useRef<Promise<string> | null>(null);

  const ensureSubmissionId = useCallback((): Promise<string> => {
    if (previewMode) {
      return Promise.resolve('preview');
    }
    if (submissionIdRef.current) {
      return Promise.resolve(submissionIdRef.current);
    }
    if (!submissionPromiseRef.current) {
      submissionPromiseRef.current = (async () => {
        try {
          const res = await fetch(`/api/f/${slug}/submissions`, { method: 'POST' });
          const data: { submissionId?: string; error?: string } = await res.json();
          if (!res.ok || !data.submissionId) {
            throw new Error(data.error ?? "Couldn't start this form. Please try again.");
          }
          submissionIdRef.current = data.submissionId;
          return data.submissionId;
        } catch (err) {
          submissionPromiseRef.current = null;
          throw err;
        }
      })();
    }
    return submissionPromiseRef.current;
  }, [slug, previewMode]);

  const visibleFieldIds = useMemo(() => getVisibleFieldIds(schema, answers), [schema, answers]);

  const handleAnswerChange = useCallback(
    (fieldId: string, value: string | string[] | undefined) => {
      setAnswers((prev) => ({ ...prev, [fieldId]: value }));
      setErrors((prev) => {
        if (!(fieldId in prev)) return prev;
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    },
    [],
  );

  const uploadFile = useCallback(
    async (fieldId: string, file: File): Promise<string> => {
      // No real submission to attach an upload to, and no S3 bucket to presign against —
      // a local object URL is enough for the field to show "uploaded" and preview the file.
      if (previewMode) {
        return URL.createObjectURL(file);
      }

      const submissionId = await ensureSubmissionId();

      const presignRes = await fetch(`/api/f/${slug}/submissions/${submissionId}/uploads/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldId,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        }),
      });
      const presignData: PresignResponse = await presignRes.json();
      if (!presignRes.ok || !presignData.uploadUrl || !presignData.storageKey) {
        throw new Error(presignData.error ?? 'Could not start the upload. Please try again.');
      }

      const putRes = await fetch(presignData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error('Uploading the file failed. Please try again.');
      }

      const confirmRes = await fetch(`/api/f/${slug}/submissions/${submissionId}/uploads/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldId,
          storageKey: presignData.storageKey,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        }),
      });
      const confirmData: ConfirmResponse = await confirmRes.json();
      if (!confirmRes.ok || !confirmData.fileId) {
        throw new Error(confirmData.error ?? 'Could not finish the upload. Please try again.');
      }

      return confirmData.fileId;
    },
    [ensureSubmissionId, previewMode, slug],
  );

  const findPageIndexForField = useCallback(
    (fieldId: string): number => {
      const index = schema.pages.findIndex((page) =>
        pageContainsField(page, fieldId, schema.fields),
      );
      return index === -1 ? 0 : index;
    },
    [schema],
  );

  const submitForm = useCallback(async () => {
    setSubmitError(null);

    // Full pre-check across every currently-visible field — catches the case where an
    // earlier page's answer made a later-page field visible/required.
    const allErrors = validateAnswers(schema, answers);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      const firstFieldId = Object.keys(allErrors)[0];
      if (firstFieldId) setPageIndex(findPageIndexForField(firstFieldId));
      return;
    }

    if (previewMode) {
      setSubmitted(true);
      return;
    }

    setSubmitting(true);
    try {
      const submissionId = await ensureSubmissionId();
      const res = await fetch(`/api/f/${slug}/submissions/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const data: SubmitResponse = await res.json();

      if (res.ok) {
        setSubmitted(true);
        return;
      }

      if (data.fieldErrors) {
        setErrors(data.fieldErrors);
        const firstFieldId = Object.keys(data.fieldErrors)[0];
        if (firstFieldId) setPageIndex(findPageIndexForField(firstFieldId));
      }
      setSubmitError(data.error ?? 'Something went wrong. Please try again.');
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [answers, ensureSubmissionId, findPageIndexForField, previewMode, schema, slug]);

  const handleNextOrSubmit = useCallback(async () => {
    const page = schema.pages[pageIndex];
    if (!page) return;

    const pageErrors = validatePageAnswers(schema, page, answers);
    if (Object.keys(pageErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...pageErrors }));
      return;
    }

    if (pageIndex < schema.pages.length - 1) {
      setPageIndex((i) => i + 1);
      return;
    }

    await submitForm();
  }, [answers, pageIndex, schema, submitForm]);

  const handleBack = useCallback(() => {
    setSubmitError(null);
    setPageIndex((i) => Math.max(0, i - 1));
  }, []);

  if (submitted) {
    return (
      <div className="form-renderer">
        <div className="form-renderer-body form-success">
          {previewMode ? (
            <>
              <h1>Preview complete</h1>
              <p>Nothing was saved — this is only a preview.</p>
              <p className="form-field-help">
                Use View form (or the published link) to submit a real response.
              </p>
            </>
          ) : (
            <>
              <h1>Thanks!</h1>
              <p>Your response has been submitted.</p>
              <p className="form-field-help">You can safely close this window now.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const currentPage = schema.pages[pageIndex];
  if (!currentPage) {
    return null;
  }

  const visibleFieldsOnPage = currentPage.fields.filter((fieldId) => visibleFieldIds.has(fieldId));
  const { headerLogoIds, bodyFieldIds } = partitionHeaderLogos(visibleFieldsOnPage, schema.fields);
  const { primary: titlePrimary, secondary: titleSecondary } = splitFormTitle(formName);
  const isLastPage = pageIndex === schema.pages.length - 1;
  const isMultiPage = schema.pages.length > 1;
  const pageUsesSectionBreaks = currentPage.fields.some(
    (fieldId) => schema.fields[fieldId]?.type === 'section_break',
  );
  const showPageTitle = isMultiPage && !pageUsesSectionBreaks;
  const showFormTitle = schema.branding.showTitle === true;
  const titleAlign = schema.branding.titleAlign ?? 'center';
  const primaryColor = schema.branding.primaryColor ?? DEFAULT_FORM_PRIMARY_COLOR;
  const secondaryColor = schema.branding.secondaryColor ?? DEFAULT_FORM_SECONDARY_COLOR;
  const brandStyle = {
    '--color-primary': primaryColor,
    '--form-secondary-color': secondaryColor,
  } as CSSProperties;
  const submitButtonText = schema.branding.submitButtonText?.trim() || DEFAULT_SUBMIT_BUTTON_TEXT;
  const submitButtonSizeClass = `form-submit-button--${schema.branding.submitButtonSize ?? 'medium'}`;
  const submitButtonStyle: CSSProperties = {
    ...(schema.branding.submitButtonColor
      ? { backgroundColor: schema.branding.submitButtonColor }
      : null),
    ...(schema.branding.submitButtonTextColor
      ? { color: schema.branding.submitButtonTextColor }
      : null),
  };
  const submitButtonAlign = schema.branding.submitButtonAlign ?? 'center';
  const formActionsPrimaryStyle: CSSProperties = {
    justifyContent:
      submitButtonAlign === 'left'
        ? 'flex-start'
        : submitButtonAlign === 'right'
          ? 'flex-end'
          : 'center',
  };

  return (
    <div className="form-renderer" style={brandStyle}>
      <div className="form-renderer-body">
        <header className="form-renderer-hero" style={{ textAlign: titleAlign }}>
          {headerLogoIds.map((fieldId) => {
            const field = schema.fields[fieldId];
            if (field?.type !== 'image' || !field.imageStorageKey) return null;
            const src = getFieldImageSrc({
              slug,
              formId,
              fieldId: field.id,
              preferFormId: previewMode,
            });
            if (!src) return null;
            return (
              <div
                key={fieldId}
                className="form-renderer-logo"
                style={resolveImageSpacingStyle(field)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={field.alt ?? field.label}
                  className="form-renderer-logo-img"
                  style={resolveImageStyle(field)}
                />
              </div>
            );
          })}
          {showFormTitle ? (
            <h1 className="form-renderer-title">
              <span className="form-renderer-title-primary">{titlePrimary}</span>
              {titleSecondary ? (
                <>
                  {' '}
                  <span className="form-renderer-title-secondary">{titleSecondary}</span>
                </>
              ) : null}
            </h1>
          ) : null}
          {isMultiPage ? (
            <p className="form-renderer-progress">
              Page {pageIndex + 1} of {schema.pages.length}
            </p>
          ) : null}
        </header>

        <div className="form-renderer-content">
          {showPageTitle ? <h2 className="form-page-title">{currentPage.title}</h2> : null}

          {submitError ? <div className="form-error">{submitError}</div> : null}

          <div className="form-field-group-list">
            {bodyFieldIds.map((fieldId) => {
              const field = schema.fields[fieldId];
              if (!field) return null;

              if (field.type === 'column_layout') {
                if (!visibleFieldIds.has(fieldId)) return null;
                const visibleChildren = field.fieldIds.filter(
                  (childId): childId is string => childId !== null && visibleFieldIds.has(childId),
                );
                if (visibleChildren.length === 0) return null;

                return (
                  <div key={fieldId} className="form-column-layout field-width--full">
                    <div
                      className={`form-column-layout-grid form-column-layout-grid--${field.columns}`}
                    >
                      {visibleChildren.map((childId) => {
                        const child = schema.fields[childId];
                        if (!child) return null;
                        return (
                          <div key={childId} className="form-field-cell">
                            <FieldInput
                              slug={slug}
                              formId={formId}
                              previewMode={previewMode}
                              field={child}
                              value={answers[childId]}
                              error={errors[childId]}
                              onChange={(value) => handleAnswerChange(childId, value)}
                              onUploadFile={uploadFile}
                              allFields={schema.fields}
                              answers={answers}
                              disableOptionGrid
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              return (
                <div key={fieldId} className={`form-field-cell ${getFieldWidthClass(field)}`}>
                  <FieldInput
                    slug={slug}
                    formId={formId}
                    previewMode={previewMode}
                    field={field}
                    value={answers[fieldId]}
                    error={errors[fieldId]}
                    onChange={(value) => handleAnswerChange(fieldId, value)}
                    onUploadFile={uploadFile}
                    allFields={schema.fields}
                    answers={answers}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="form-actions">
          <div className="form-actions-primary" style={formActionsPrimaryStyle}>
            {pageIndex > 0 ? (
              <button
                type="button"
                className="button button--ghost"
                onClick={handleBack}
                disabled={submitting}
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              className={`button form-submit-button ${isLastPage ? submitButtonSizeClass : ''}`}
              style={isLastPage ? submitButtonStyle : undefined}
              onClick={() => void handleNextOrSubmit()}
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : isLastPage ? submitButtonText : 'Next'}
            </button>
          </div>
          {isLastPage ? (
            <button
              type="button"
              className="form-save-later"
              disabled
              title="Save and resume by email — coming soon"
            >
              Save and Complete Later
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
