/** URL for a form field's uploaded image (builder preview or public form).
 *
 * The slug-based route (/api/f/[slug]/...) only serves *published* forms — it 404s on a
 * draft. The formId-based route (/api/forms/[id]/...) is session-gated but always serves
 * the latest version, published or not. The admin-only /f/[slug]/preview page (see that
 * route for why it exists) renders a draft through this same public renderer, so it needs
 * `preferFormId: true` to resolve field images against the draft instead of 404ing. */
export function getFieldImageSrc(params: {
  fieldId: string;
  formId?: string;
  slug?: string;
  preferFormId?: boolean;
}): string | null {
  const { fieldId, formId, slug, preferFormId } = params;
  if (preferFormId && formId) return `/api/forms/${formId}/fields/${fieldId}/image`;
  if (slug) return `/api/f/${slug}/fields/${fieldId}/image`;
  if (formId) return `/api/forms/${formId}/fields/${fieldId}/image`;
  return null;
}
