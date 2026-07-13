/** Lowercase, hyphenated, alphanumeric-only. Falls back to "form" if a name has no usable characters. */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'form';
}

/**
 * `forms.slug` is unique per organization (schema.prisma `@@unique([organizationId, slug])`),
 * not globally — pass every existing slug for the org and this appends `-2`, `-3`, etc.
 * until it finds one that's free. Called at form-creation time; renames don't change slugs
 * once set, since the public URL (spec 03) should stay stable once a form has been shared.
 */
export function uniqueSlug(base: string, existingSlugs: ReadonlySet<string>): string {
  const candidate = slugify(base);
  if (!existingSlugs.has(candidate)) {
    return candidate;
  }

  let suffix = 2;
  while (existingSlugs.has(`${candidate}-${suffix}`)) {
    suffix += 1;
  }
  return `${candidate}-${suffix}`;
}
