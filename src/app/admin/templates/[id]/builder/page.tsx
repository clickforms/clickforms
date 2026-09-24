import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { TemplateBuilderClient } from '@/app/admin/templates/[id]/builder/template-builder-client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { formSchemaSchema } from '@/lib/forms/schema';

export default async function TemplateBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isPlatformAdmin) {
    redirect('/forms');
  }
  const { id } = await params;

  const template = await prisma.formTemplate.findUnique({
    where: { id },
    select: { id: true, name: true, schema: true },
  });
  if (!template) notFound();

  const parsed = formSchemaSchema.safeParse(template.schema);
  if (!parsed.success) {
    // Shouldn't happen — every write path validates with formSchemaSchema first — but
    // fail loudly rather than silently handing the builder a shape it can't render.
    throw new Error(`Template ${template.id} has an invalid schema: ${parsed.error.message}`);
  }

  return (
    <TemplateBuilderClient
      templateId={template.id}
      templateName={template.name}
      initialSchema={parsed.data}
    />
  );
}
