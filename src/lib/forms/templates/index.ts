import type { FormSchema } from '@/lib/forms/schema';
import { createIncidentReportSchema } from '@/lib/forms/templates/incident-report';

export const FORM_TEMPLATE_IDS = ['incident-report'] as const;
export type FormTemplateId = (typeof FORM_TEMPLATE_IDS)[number];

export const FORM_TEMPLATES: Record<
  FormTemplateId,
  { id: FormTemplateId; name: string; description: string; createSchema: () => FormSchema }
> = {
  'incident-report': {
    id: 'incident-report',
    name: 'Incident report',
    description:
      'NDIS incident report with participant details, incident types, reviewer section, and stakeholder notifications.',
    createSchema: createIncidentReportSchema,
  },
};

export function createSchemaFromTemplate(templateId: FormTemplateId): FormSchema {
  return FORM_TEMPLATES[templateId].createSchema();
}
