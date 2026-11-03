'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import './response-column-settings.css';

export function ResponseColumnSettings({
  formId,
  canEdit,
  fields,
  initialFieldId,
}: {
  formId: string;
  canEdit: boolean;
  fields: { id: string; label: string }[];
  initialFieldId: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(initialFieldId ?? '');
  const [saving, setSaving] = useState(false);

  async function save(next: string) {
    const previous = value;
    setValue(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/forms/${formId}/response-column`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldId: next || null }),
      });
      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Could not save.');
        setValue(previous);
        return;
      }
      toast.success('Responses list updated');
      router.refresh();
    } catch {
      toast.error('Could not save.');
      setValue(previous);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="response-column-settings" aria-label="Responses list">
      <h3>First column of the Responses list</h3>
      <p>
        Choose which field identifies a response — a client name, job number, site, anything on your
        form. The column takes that field&apos;s label as its heading.
      </p>
      <select
        className="text-input"
        value={value}
        disabled={!canEdit || saving}
        onChange={(event) => void save(event.target.value)}
      >
        <option value="">Automatic (name or email, if the form has one)</option>
        {fields.map((field) => (
          <option key={field.id} value={field.id}>
            {field.label || 'Untitled field'}
          </option>
        ))}
      </select>
    </section>
  );
}
