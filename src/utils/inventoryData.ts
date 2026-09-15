import { Product } from '../types';
import { hasVariantInventory, totalProductStock } from './productData';

export type InventoryStockFilter = 'all' | 'healthy' | 'attention' | 'out';
export type InventoryVisibilityFilter = 'all' | 'active' | 'hidden';
export type InventorySort = 'attention' | 'name' | 'sku' | 'stock';
export type InventoryMode = 'simple' | 'size' | 'color' | 'matrix';

export interface InventorySaveInput {
  productId: string;
  expectedVersion: number;
  stockCount: number;
  variantInventory?: Product['variantInventory'];
}

export class StaleInventoryError extends Error {
  constructor() { super('Inventory changed after this page was opened. Reload the latest inventory before saving.'); this.name = 'StaleInventoryError'; }
}

export interface InventoryStats {
  total: number;
  variantCount: number;
  lowVariants: number;
  zeroVariants: number;
  status: Exclude<InventoryStockFilter, 'all'>;
}

export interface InventoryQuery {
  query: string;
  category: string;
  stock: InventoryStockFilter;
  visibility: InventoryVisibilityFilter;
  sort: InventorySort;
}

export const inventoryMode = (product: Product): InventoryMode => {
  if (!hasVariantInventory(product)) return 'simple';
  if (product.colors.length && product.availableSizes.length) return 'matrix';
  if (product.colors.length) return 'color';
  return 'size';
};

export const inventoryStats = (product: Product, threshold: number): InventoryStats => {
  const total = totalProductStock(product);
  const rows = product.variantInventory || [];
  const lowVariants = rows.filter((row) => row.stock > 0 && row.stock <= threshold).length;
  const zeroVariants = rows.filter((row) => row.stock <= 0).length;
  const status = total <= 0
    ? 'out'
    : hasVariantInventory(product)
      ? (lowVariants > 0 || zeroVariants > 0 ? 'attention' : 'healthy')
      : total <= threshold ? 'attention' : 'healthy';
  return { total, variantCount: rows.length, lowVariants, zeroVariants, status };
};

export const inventoryImage = (product: Product): string => product.images.find(Boolean)
  || product.colors.flatMap((color) => color.images || []).find(Boolean)
  || '';

const searchRank = (product: Product, rawQuery: string): number => {
  const query = rawQuery.trim().toLocaleLowerCase('en-IN');
  if (!query) return 0;
  const sku = product.sku.toLocaleLowerCase('en-IN');
  const title = product.title.toLocaleLowerCase('en-IN');
  if (sku === query) return 0;
  if (sku.startsWith(query)) return 1;
  if (title.startsWith(query)) return 2;
  if (sku.includes(query)) return 3;
  if (title.includes(query)) return 4;
  return Number.POSITIVE_INFINITY;
};

const statusRank: Record<InventoryStats['status'], number> = { out: 0, attention: 1, healthy: 2 };

export const inventoryProducts = (products: Product[], filters: InventoryQuery, threshold: number): Product[] => products
  .map((product) => ({ product, rank: searchRank(product, filters.query), stats: inventoryStats(product, threshold) }))
  .filter(({ product, rank, stats }) => Number.isFinite(rank)
    && (filters.category === 'all' || product.category === filters.category)
    && (filters.stock === 'all' || stats.status === filters.stock)
    && (filters.visibility === 'all' || (filters.visibility === 'active' ? product.isActive !== false : product.isActive === false)))
  .sort((left, right) => left.rank - right.rank || (() => {
    if (filters.sort === 'attention') return statusRank[left.stats.status] - statusRank[right.stats.status] || left.product.title.localeCompare(right.product.title);
    if (filters.sort === 'sku') return left.product.sku.localeCompare(right.product.sku) || left.product.title.localeCompare(right.product.title);
    if (filters.sort === 'stock') return left.stats.total - right.stats.total || left.product.title.localeCompare(right.product.title);
    return left.product.title.localeCompare(right.product.title) || left.product.sku.localeCompare(right.product.sku);
  })())
  .map(({ product }) => product);

export const inventoryCategories = (products: Product[], configured: Array<{ name: string; sortOrder: number }>): string[] => {
  const configuredNames = configured.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)).map((category) => category.name);
  return [...new Set([...configuredNames, ...products.map((product) => product.category).filter(Boolean)])];
};

export const normalizedStock = (value: unknown): number => Math.max(0, Math.floor(typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0));
