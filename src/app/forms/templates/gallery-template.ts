import type { LayoutStyle } from '@/lib/forms/schema';

export interface GalleryTemplate {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  category: string | null;
  formType: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  createdByName: string;
  layoutStyle: LayoutStyle;
  fieldCount: number;
  fieldLabels: string[];
}
