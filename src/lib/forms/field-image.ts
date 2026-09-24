/** URL for a form field's uploaded image (builder preview or public form).
 *
 * The slug-based route (/api/f/[slug]/...) only serves *published* forms — it 404s on a
 * draft. The formId-based route (/api/forms/[id]/...) is session-gated but always serves
 * the latest version, published or not. The admin-only /f/[slug]/preview page (see that
 * route for why it exists) renders a draft through this same public renderer, so it needs
 * `preferFormId: true` to resolve field images against the draft instead of 404ing.
 *
 * `templateId` is a third, separate case: the platform-admin template builder (see
 * template-builder-client.tsx), where the field lives on a FormTemplate rather than a
 * Form. Checked first since a template context never also has a real formId/slug. */
export function getFieldImageSrc(params: {
  fieldId: string;
  formId?: string;
  templateId?: string;
  slug?: string;
  preferFormId?: boolean;
}): string | null {
  const { fieldId, formId, templateId, slug, preferFormId } = params;
  if (templateId) return `/api/admin/form-templates/${templateId}/fields/${fieldId}/image`;
  if (preferFormId && formId) return `/api/forms/${formId}/fields/${fieldId}/image`;
  if (slug) return `/api/f/${slug}/fields/${fieldId}/image`;
  if (formId) return `/api/forms/${formId}/fields/${fieldId}/image`;
  return null;
}
