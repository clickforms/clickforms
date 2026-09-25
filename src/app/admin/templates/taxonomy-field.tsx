'use client';

import { useId } from 'react';

/**
 * A free-text input with a <datalist> of existing values for one of a template's three
 * browsing facets (industry/category/formType — see FormTemplate's doc comment in
 * prisma/schema.prisma for why these stay free-text rather than enums). `options` is
 * whatever distinct, non-empty values already exist for this facet across other
 * templates, computed by the caller — this component just renders them as suggestions;
 * typing something not in the list is always allowed, same as before this facet split.
 */
export function TaxonomyField({
  label,
  placeholder,
  value,
  onChange,
  options,
  disabled,
  className = 'admin-org-field',
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  disabled?: boolean;
  className?: string;
}) {
  const listId = useId();

  return (
    <label className={className}>
      <span>{label}</span>
      <input
        className="text-input"
        list={listId}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </label>
  );
}
