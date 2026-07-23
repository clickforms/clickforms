import type { SubmissionStatus } from '@prisma/client';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { SubmissionAnswersEditor } from '@/app/forms/[id]/submissions/[submissionId]/submission-answers-editor';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
import type { FormAnswers } from '@/lib/forms/conditional-logic';
import { getFieldImageSrc } from '@/lib/forms/field-image';
import {
  resolveDividerCaptionStyle,
  resolveDividerLineStyle,
  resolveDividerWrapStyle,
  resolveFieldContainerStyle,
  resolveImageSpacingStyle,
  resolveImageStyle,
  resolveSectionBreakStyle,
} from '@/lib/forms/field-styles';
import { formatSubmissionAnswer } from '@/lib/forms/format-submission-answer';
import { resolveMergeFieldsForRespondent } from '@/lib/forms/merge-fields';
import {
  createEmptyFormSchema,
  type FormField,
  type FormSchema,
  formSchemaSchema,
} from '@/lib/forms/schema';
import {
  buildSubmissionFileMaps,
  createDownloadUrlMap,
  createSubmissionFileResolver,
  parseSubmissionAnswers,
} from '@/lib/forms/submission-files';
import { canEditForm } from '@/lib/user-roles';

interface PageProps {
  params: Promise<{ id: string; submissionId: string }>;
}

const SUBMISSION_STATUS_BADGE: Record<SubmissionStatus, { label: string; className: string }> = {
  in_progress: { label: 'In progress', className: 'badge--neutral' },
  submitted: { label: 'Submitted', className: 'badge--success' },
  approved: { label: 'Approved', className: 'badge--success' },
  rejected: { label: 'Rejected', className: 'badge--error' },
};

function renderFormattedAnswer(formatted: ReturnType<typeof formatSubmissionAnswer>) {
  if (formatted.kind === 'skip') {
    return null;
  }

  if (formatted.kind === 'empty') {
    return <p className="submission-answer-empty">No answer</p>;
  }

  if (formatted.kind === 'text') {
    return (
      <p
        className={`submission-answer-text ${formatted.multiline ? 'submission-answer-text--multiline' : ''}`}
      >
        {formatted.text}
      </p>
    );
  }

  if (formatted.kind === 'matrix') {
    return (
      <ul className="submission-answer-matrix">
        {formatted.entries.map((entry) => (
          <li key={`${entry.row}-${entry.column}`}>
            <span className="submission-answer-matrix-row">{entry.row}:</span> {entry.column}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="submission-answer-files">
      {formatted.files.map((file) => (
        <li key={file.id}>
          <a className="button button--secondary button--small" href={file.url}>
            Download {file.filename}
          </a>
        </li>
      ))}
    </ul>
  );
}

function renderAnswer(
  field: FormField,
  fieldId: string,
  answers: Record<string, unknown>,
  resolveFiles: ReturnType<typeof createSubmissionFileResolver>,
) {
  const formatted = formatSubmissionAnswer(field, answers[fieldId], resolveFiles, fieldId);
  if (formatted.kind === 'skip') {
    return null;
  }

  if (formatted.kind === 'empty') {
    return <p className="submission-answer-empty">No answer</p>;
  }

  if (formatted.kind === 'files' && formatted.files.length === 0) {
    return <p className="submission-answer-empty">No file uploaded</p>;
  }

  return renderFormattedAnswer(formatted);
}

export default async function SubmissionDetailPage({ params }: PageProps) {
  const { id, submissionId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }

  const result = await withOrgContext(session.user.organizationId, async (tx) => {
    const form = await tx.form.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!form) {
      return null;
    }

    const submission = await tx.submission.findFirst({
      where: { id: submissionId, formId: form.id, organizationId: session.user.organizationId },
    });
    if (!submission) {
      return null;
    }

    const version = await tx.formVersion.findFirst({
      where: { id: submission.formVersionId, organizationId: session.user.organizationId },
    });

    const files = await tx.submissionFile.findMany({
      where: { submissionId: submission.id, organizationId: session.user.organizationId },
    });

    return { form, submission, version, files };
  });

  if (!result) {
    notFound();
  }

  const { form, submission, version, files } = result;

  let schema: FormSchema;
  if (version) {
    const parsed = formSchemaSchema.safeParse(version.schema);
    if (parsed.success) {
      schema = parsed.data;
    } else {
      console.error(
        `[forms/submissions] form_version ${version.id} (submission ${submission.id}) failed formSchemaSchema`,
        parsed.error,
      );
      schema = createEmptyFormSchema();
    }
  } else {
    console.error(
      `[forms/submissions] submission ${submission.id} references missing form_version ${submission.formVersionId}`,
    );
    schema = createEmptyFormSchema();
  }

  const downloadUrlById = await createDownloadUrlMap(files);
  const { filesById, filesByFieldKey } = buildSubmissionFileMaps(files);
  const answers = parseSubmissionAnswers(submission);
  const resolveFiles = createSubmissionFileResolver(
    answers,
    filesById,
    filesByFieldKey,
    downloadUrlById,
  );

  const badge = SUBMISSION_STATUS_BADGE[submission.status];
  const canDelete = canEditForm(session.user.role, form.createdBy, session.user.id);
  // Editing an in-progress submission would race with the respondent's own session
  // (they could still be filling it out), so editing is only offered once it has
  // actually been submitted.
  const canEditAnswers = canDelete && submission.status !== 'in_progress';

  const meta = (
    <div key="submission-meta" className="card submission-meta">
      <div className="submission-meta-row">
        <span className="submission-meta-label">Status</span>
        <span className={`badge ${badge.className}`}>{badge.label}</span>
      </div>
      <div className="submission-meta-row">
        <span className="submission-meta-label">Submitted</span>
        <span>
          {submission.submittedAt
            ? new Date(submission.submittedAt).toLocaleString('en-AU')
            : 'Not yet submitted'}
        </span>
      </div>
      <div className="submission-meta-row">
        <span className="submission-meta-label">IP address</span>
        <span>{submission.ipAddress ?? '—'}</span>
      </div>
    </div>
  );

  return (
    <div>
      <SubmissionAnswersEditor
        formId={form.id}
        submissionId={submission.id}
        schema={schema}
        initialAnswers={answers as FormAnswers}
        canEditAnswers={canEditAnswers}
        canDelete={canDelete}
        meta={meta}
      >
        {schema.pages.map((page) => (
          <div key={page.id} className="card submission-page">
            <h2 className="submission-page-title">{page.title}</h2>
            <dl className="submission-fields">
              {page.fields.map((fieldId) => {
                const field = schema.fields[fieldId];
                if (!field) return null;

                if (field.type === 'section_break') {
                  return (
                    <div key={fieldId}>
                      <div
                        className="submission-section-break"
                        style={resolveSectionBreakStyle(field)}
                      >
                        {field.label}
                      </div>
                      {field.helpText ? (
                        <p className="submission-section-instruction">{field.helpText}</p>
                      ) : null}
                    </div>
                  );
                }

                if (field.type === 'divider') {
                  const captionEl = field.label ? (
                    <span
                      className="submission-divider-caption"
                      style={resolveDividerCaptionStyle(field)}
                    >
                      {field.label}
                    </span>
                  ) : null;
                  return (
                    <div key={fieldId} className="submission-divider-wrap">
                      <div
                        className="submission-divider-box"
                        style={resolveDividerWrapStyle(field)}
                      >
                        {(field.captionPosition ?? 'above') === 'above' ? captionEl : null}
                        <div
                          className="submission-divider-line"
                          style={resolveDividerLineStyle(field)}
                        />
                        {field.captionPosition === 'below' ? captionEl : null}
                      </div>
                    </div>
                  );
                }

                if (field.type === 'static_text') {
                  // field.body is rich HTML from RichTextEditor (see builder/rich-text-editor.tsx),
                  // with merge-field tokens resolved against this submission's actual answers —
                  // same resolver used by the PDF export path (submission-field-display.tsx), so
                  // this quick admin view stays consistent with the exported document.
                  const html = resolveMergeFieldsForRespondent(
                    field.body,
                    schema.fields,
                    answers as FormAnswers,
                  );
                  return (
                    <div
                      key={fieldId}
                      className="submission-static-text"
                      style={resolveFieldContainerStyle(field)}
                    >
                      {field.label ? (
                        <p className="submission-static-text-heading">{field.label}</p>
                      ) : null}
                      {field.showBody !== false ? (
                        <div
                          className="submission-static-text-body"
                          // biome-ignore lint/security/noDangerouslySetInnerHtml: admin-authored rich text, see note in field-input.tsx
                          dangerouslySetInnerHTML={{ __html: html }}
                        />
                      ) : null}
                    </div>
                  );
                }

                if (field.type === 'column_layout') {
                  return (
                    <div key={fieldId} className="submission-column-layout">
                      {field.label ? (
                        <p className="submission-column-layout-title">{field.label}</p>
                      ) : null}
                      <div
                        className={`submission-column-layout-grid submission-column-layout-grid--${field.columns}`}
                      >
                        {field.fieldIds.map((childId) => {
                          if (childId === null) return null;
                          const child = schema.fields[childId];
                          if (!child || child.type === 'column_layout') return null;
                          if (
                            child.type === 'section_break' ||
                            child.type === 'divider' ||
                            child.type === 'static_text' ||
                            child.type === 'image'
                          ) {
                            return null;
                          }
                          return (
                            <div key={childId} className="submission-field-row">
                              <dt className="submission-field-label">{child.label}</dt>
                              <dd className="submission-field-value">
                                {renderAnswer(child, childId, answers, resolveFiles)}
                              </dd>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                if (field.type === 'image') {
                  if (!field.imageStorageKey) return null;
                  const src = getFieldImageSrc({ formId: form.id, fieldId: field.id });
                  if (!src) return null;
                  return (
                    <div
                      key={fieldId}
                      className="submission-image-field"
                      style={resolveImageSpacingStyle(field)}
                    >
                      {field.label ? (
                        <p className="submission-image-caption">{field.label}</p>
                      ) : null}
                      {/* biome-ignore lint/performance/noImgElement: dynamic/presigned image URLs; next/image is a poor fit here */}
                      <img
                        src={src}
                        alt={field.alt ?? field.label}
                        className="submission-image"
                        style={resolveImageStyle(field)}
                      />
                    </div>
                  );
                }

                return (
                  <div key={fieldId} className="submission-field-row">
                    <dt className="submission-field-label">{field.label}</dt>
                    <dd className="submission-field-value">
                      {renderAnswer(field, fieldId, answers, resolveFiles)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </SubmissionAnswersEditor>

      <p className="submission-back-link">
        <Link href={`/forms/${form.id}/submissions`}>&larr; Back to submissions</Link>
      </p>
    </div>
  );
}
