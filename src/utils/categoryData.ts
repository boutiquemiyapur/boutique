import { StoreCategory } from '../types';

export const categorySlug = (value: string) => value.trim().toLowerCase()
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

export const normalizeCategory = (raw: Partial<StoreCategory>, id = raw.id || ''): StoreCategory => ({
  id: id.trim(),
  name: typeof raw.name === 'string' ? raw.name.trim() : '',
  slug: categorySlug(typeof raw.slug === 'string' && raw.slug.trim() ? raw.slug : raw.name || ''),
  description: typeof raw.description === 'string' ? raw.description.trim() : '',
  image: typeof raw.image === 'string' ? raw.image.trim() : '',
  isActive: raw.isActive !== false,
  sortOrder: Number.isFinite(raw.sortOrder) ? Number(raw.sortOrder) : 0,
});

export const categoryValidationError = (category: StoreCategory, existing: StoreCategory[]): string | null => {
  if (!category.name) return 'Enter a category name.';
  if (!category.slug) return 'Enter a valid URL slug.';
  if (existing.some((item) => item.id !== category.id && item.name.toLowerCase() === category.name.toLowerCase())) return 'A category with this name already exists.';
  if (existing.some((item) => item.id !== category.id && item.slug.toLowerCase() === category.slug.toLowerCase())) return 'This category URL slug is already in use.';
  return null;
};

export const activeCategories = (categories: StoreCategory[]) => categories
  .filter((category) => category.isActive)
  .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
