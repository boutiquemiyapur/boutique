import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, Search } from 'lucide-react';
import { ProductImage } from '../common/ProductImage';
import { Product, StoreCategory, VariantInventoryItem } from '../../types';
import { hasVariantInventory, syncVariantInventory } from '../../utils/productData';
import { InventorySaveInput, StaleInventoryError, inventoryCategories, inventoryImage, inventoryMode, inventoryProducts, inventoryStats, InventoryQuery, InventoryStockFilter, normalizedStock } from '../../utils/inventoryData';

interface Props {
  key?: React.Key;
  products: Product[];
  categories: StoreCategory[];
  threshold: number;
  versions: Record<string, number>;
  loading: boolean;
  loadError: string | null;
  onSave: (input: InventorySaveInput) => Promise<number>;
  onRefresh: (productId: string) => Promise<{ product: Product; version: number } | null>;
  onEditProduct: (product: Product) => void;
  initialStockFilter?: InventoryStockFilter;
  initialProductId?: string | null;
}

const control = 'min-h-11 rounded-lg border border-[#d8d1c9] bg-white px-3 text-xs outline-none focus:border-stone-700';
const statusLabel = { healthy: 'Healthy', attention: 'Needs attention', out: 'Fully out' } as const;
const statusStyle = { healthy: 'bg-emerald-100 text-emerald-800', attention: 'bg-amber-100 text-amber-800', out: 'bg-rose-100 text-rose-800' } as const;

export const InventoryManager = (props: Props) => {
  const [filters, setFilters] = useState<InventoryQuery>({ query: '', category: 'all', stock: props.initialStockFilter || 'all', visibility: 'all', sort: 'attention' });
  const [selectedId, setSelectedId] = useState<string | null>(props.initialProductId || null);
  const [returnScroll, setReturnScroll] = useState(0);
  const categories = useMemo(() => inventoryCategories(props.products, props.categories), [props.products, props.categories]);
  const visible = useMemo(() => inventoryProducts(props.products, filters, props.threshold), [props.products, filters, props.threshold]);
  const counts = useMemo(() => props.products.reduce((all, product) => {
    const status = inventoryStats(product, props.threshold).status;
    all.all += 1; all[status] += 1;
    return all;
  }, { all: 0, healthy: 0, attention: 0, out: 0 }), [props.products, props.threshold]);
  const selected = selectedId ? props.products.find((product) => product.id === selectedId) : null;
  const nextProduct = selected ? visible[(visible.findIndex((product) => product.id === selected.id) + 1) % Math.max(visible.length, 1)] : null;

  const open = (id: string) => { setReturnScroll(typeof window === 'undefined' ? 0 : window.scrollY); setSelectedId(id); if (typeof window !== 'undefined') window.scrollTo({ top: 0 }); };
  const openNext = (id: string) => { setSelectedId(id); if (typeof window !== 'undefined') window.scrollTo({ top: 0 }); };
  const close = () => { setSelectedId(null); if (typeof window !== 'undefined') requestAnimationFrame(() => window.scrollTo({ top: returnScroll })); };

  if (selected) return <InventoryDetail key={selected.id} product={selected} threshold={props.threshold} version={props.versions[selected.id] || 0} nextProduct={nextProduct?.id !== selected.id ? nextProduct : null} onBack={close} onEditProduct={props.onEditProduct} onRefresh={props.onRefresh} onSave={props.onSave} onOpenNext={openNext} />;

  const summary = ([['all', 'All products'], ['healthy', 'Healthy'], ['attention', 'Needs attention'], ['out', 'Fully out']] as Array<[InventoryStockFilter, string]>);
  return <div className="space-y-5">
    <section aria-label="Inventory summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">{summary.map(([id, label]) => <button key={id} type="button" onClick={() => setFilters((current) => ({ ...current, stock: id }))} className={`rounded-xl border bg-white p-4 text-left shadow-sm transition ${filters.stock === id ? 'border-[#625e59] ring-2 ring-[#625e59]/15' : 'border-[#ddd7cf] hover:border-stone-400'}`}><span className="block text-[10px] font-semibold uppercase tracking-[.14em] text-stone-500">{label}</span><span className={`mt-2 block font-serif text-3xl ${id === 'out' && counts[id] ? 'text-rose-700' : id === 'attention' && counts[id] ? 'text-amber-700' : ''}`}>{counts[id]}</span></button>)}</section>

    <section className="sticky top-0 z-20 rounded-xl border border-[#ddd7cf] bg-[#f7f5f2]/95 p-3 shadow-sm backdrop-blur"><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.5fr)_1fr_1fr_1fr_1fr]">
      <label className="relative"><span className="sr-only">Search product name or SKU</span><Search className="absolute left-3 top-3.5 h-4 w-4 text-stone-400" /><input className={`${control} w-full pl-9`} value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Search product name or SKU" /></label>
      <FilterSelect label="Category" value={filters.category} onChange={(category) => setFilters((current) => ({ ...current, category }))}><option value="all">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</FilterSelect>
      <FilterSelect label="Stock" value={filters.stock} onChange={(stock) => setFilters((current) => ({ ...current, stock: stock as InventoryStockFilter }))}><option value="all">All stock</option><option value="healthy">Healthy</option><option value="attention">Needs attention</option><option value="out">Fully out</option></FilterSelect>
      <FilterSelect label="Visibility" value={filters.visibility} onChange={(visibility) => setFilters((current) => ({ ...current, visibility: visibility as InventoryQuery['visibility'] }))}><option value="all">Active and hidden</option><option value="active">Active</option><option value="hidden">Hidden</option></FilterSelect>
      <FilterSelect label="Sort" value={filters.sort} onChange={(sort) => setFilters((current) => ({ ...current, sort: sort as InventoryQuery['sort'] }))}><option value="attention">Attention first</option><option value="name">Name A–Z</option><option value="sku">SKU A–Z</option><option value="stock">Stock low–high</option></FilterSelect>
    </div><div className="mt-3 flex items-center justify-between gap-3 text-xs text-stone-500"><span>{props.loading ? 'Refreshing inventory…' : `${visible.length} ${visible.length === 1 ? 'product' : 'products'}`}</span><button type="button" className="min-h-9 px-2 font-semibold underline" onClick={() => setFilters({ query: '', category: 'all', stock: 'all', visibility: 'all', sort: 'attention' })}>Clear filters</button></div></section>

    {props.loadError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{props.loadError}</p>}
    {props.loading && !props.products.length ? <p className="rounded-xl border border-[#ddd7cf] bg-white p-8 text-center text-sm text-stone-500">Loading inventory…</p> : visible.length ? <section aria-label="Inventory products" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{visible.map((product) => <InventoryCard key={product.id} product={product} threshold={props.threshold} onOpen={() => open(product.id)} />)}</section> : <div className="rounded-xl border border-[#ddd7cf] bg-white p-10 text-center"><p className="font-serif text-xl">No matching products</p><p className="mt-2 text-sm text-stone-500">Try another SKU, category, or stock filter.</p></div>}
  </div>;
};

const FilterSelect = ({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) => <label className="relative"><span className="sr-only">{label}</span><select aria-label={label} className={`${control} w-full appearance-none pr-8`} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select><ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-stone-400" /></label>;

const InventoryCard = ({ product, threshold, onOpen }: { product: Product; threshold: number; onOpen: () => void; key?: React.Key }) => {
  const stats = inventoryStats(product, threshold);
  return <button type="button" onClick={onOpen} className="group overflow-hidden rounded-xl border border-[#ddd7cf] bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#625e59]"><div className="grid grid-cols-[112px_1fr] sm:block"><div className="relative h-full min-h-36 overflow-hidden bg-stone-100 sm:aspect-[4/5] sm:min-h-0"><ProductImage src={inventoryImage(product)} alt={product.title} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" /><span className={`absolute right-2 top-2 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${statusStyle[stats.status]}`}>{statusLabel[stats.status]}</span>{product.isActive === false && <span className="absolute bottom-2 left-2 rounded bg-stone-800/85 px-2 py-1 text-[9px] font-bold uppercase text-white">Hidden</span>}</div><div className="min-w-0 p-4"><p className="truncate text-[10px] font-semibold uppercase tracking-[.12em] text-stone-500">{product.category || 'Uncategorised'}</p><h2 className="mt-1 line-clamp-2 min-h-10 font-serif text-lg leading-5">{product.title}</h2><p className="mt-2 font-mono text-xs font-semibold text-[#625e59]">SKU: {product.sku}</p><div className="mt-4 border-t border-stone-100 pt-3"><p className="font-serif text-2xl">{stats.total} <span className="font-sans text-xs text-stone-500">total units</span></p>{stats.variantCount ? <p className="mt-1 text-xs text-stone-500">{stats.lowVariants} low · {stats.zeroVariants} at zero · {stats.variantCount} variants</p> : <p className="mt-1 text-xs text-stone-500">Shared product stock</p>}</div></div></div></button>;
};

interface DetailProps {
  key?: React.Key;
  product: Product;
  threshold: number;
  version: number;
  nextProduct: Product | null;
  onBack: () => void;
  onEditProduct: (product: Product) => void;
  onRefresh: Props['onRefresh'];
  onSave: Props['onSave'];
  onOpenNext: (id: string) => void;
}

const InventoryDetail = ({ product, threshold, version, nextProduct, onBack, onEditProduct, onRefresh, onSave, onOpenNext }: DetailProps) => {
  const mode = inventoryMode(product);
  const initialRows = hasVariantInventory(product) ? syncVariantInventory(product) : [];
  const [baseStock, setBaseStock] = useState(product.stockCount);
  const [stock, setStock] = useState(product.stockCount);
  const [baseRows, setBaseRows] = useState(initialRows);
  const [rows, setRows] = useState(initialRows);
  const [baseVersion, setBaseVersion] = useState(version);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const changedKeys = new Set(rows.filter((row) => baseRows.find((base) => base.key === row.key)?.stock !== row.stock).map((row) => row.key));
  const changed = mode === 'simple' ? stock !== baseStock : changedKeys.size > 0;
  const beforeTotal = mode === 'simple' ? baseStock : baseRows.reduce((sum, row) => sum + row.stock, 0);
  const afterTotal = mode === 'simple' ? stock : rows.reduce((sum, row) => sum + row.stock, 0);
  const stats = inventoryStats({ ...product, stockCount: afterTotal, ...(mode === 'simple' ? {} : { variantInventory: rows }) }, threshold);

  const reset = (nextProduct = product, nextVersion = baseVersion) => {
    const nextRows = hasVariantInventory(nextProduct) ? syncVariantInventory(nextProduct) : [];
    setBaseStock(nextProduct.stockCount); setStock(nextProduct.stockCount); setBaseRows(nextRows); setRows(nextRows); setBaseVersion(nextVersion); setError(''); setSuccess('');
  };
  useEffect(() => {
    if (version === baseVersion) return;
    if (changed) setError('Inventory changed after this page was opened. Reload the latest inventory before saving.');
    else reset(product, version);
  }, [version]);
  const leave = () => { if (!changed || window.confirm('Discard unsaved inventory changes?')) onBack(); };
  const save = async (moveNext: boolean) => {
    if (!changed) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const input: InventorySaveInput = { productId: product.id, expectedVersion: baseVersion, stockCount: afterTotal, ...(mode === 'simple' ? {} : { variantInventory: rows }) };
      const nextVersion = await onSave(input);
      setBaseStock(afterTotal); setBaseRows(rows); setBaseVersion(nextVersion); setSuccess(`Inventory saved for ${product.title} (${product.sku}).`);
      if (moveNext && nextProduct) onOpenNext(nextProduct.id);
    } catch (cause) {
      setError(cause instanceof StaleInventoryError ? cause.message : cause instanceof Error ? cause.message : 'Inventory could not be saved.');
    } finally { setSaving(false); }
  };
  const refresh = async () => { const latest = await onRefresh(product.id); if (latest) reset(latest.product, latest.version); else setError('The latest product inventory could not be loaded.'); };

  return <div className="pb-24">
    <button type="button" onClick={leave} className="mb-4 inline-flex min-h-11 items-center gap-2 text-xs font-semibold"><ArrowLeft className="h-4 w-4" />Back to inventory</button>
    <section className="sticky top-0 z-20 rounded-xl border border-[#ddd7cf] bg-white/95 p-4 shadow-sm backdrop-blur sm:p-5"><div className="flex gap-4"><ProductImage src={inventoryImage(product)} alt={product.title} className="h-24 w-20 shrink-0 rounded-lg object-cover sm:h-32 sm:w-28" /><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-stone-500">{product.category || 'Uncategorised'}</p><h2 className="mt-1 font-serif text-2xl sm:text-3xl">{product.title}</h2><p className="mt-2 font-mono text-xs font-semibold text-[#625e59]">SKU: {product.sku}</p><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className={`rounded-full px-2.5 py-1 font-semibold ${statusStyle[stats.status]}`}>{statusLabel[stats.status]}</span><span className="rounded-full bg-stone-100 px-2.5 py-1">{afterTotal} total</span>{stats.variantCount > 0 && <span className="rounded-full bg-stone-100 px-2.5 py-1">{stats.lowVariants} low · {stats.zeroVariants} zero</span>}</div><button type="button" onClick={() => onEditProduct(product)} className="mt-3 min-h-9 text-xs font-semibold underline">Edit full product details</button></div></div></section>

    <section className="mt-5 rounded-xl border border-[#ddd7cf] bg-white p-4 shadow-sm sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-200 pb-4"><div><p className="text-[10px] uppercase tracking-[.14em] text-stone-500">Inventory editor</p><h3 className="mt-1 font-serif text-2xl">{mode === 'simple' ? 'Shared product stock' : mode === 'matrix' ? 'Stock by color and size' : mode === 'color' ? 'Stock by color' : 'Stock by size'}</h3></div><div className="text-right"><p className="text-xs text-stone-500">Calculated total</p><p className="font-serif text-3xl">{beforeTotal}{changed && <> → {afterTotal}</>}</p></div></div>
      {mode === 'simple' ? <SimpleEditor value={stock} changed={changed} onChange={setStock} /> : <VariantEditor product={product} rows={rows} baseRows={baseRows} threshold={threshold} mode={mode} onChange={setRows} />}
      {error && <div role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p>{error}</p>{error.toLowerCase().includes('changed') && <button type="button" onClick={() => void refresh()} className="mt-2 min-h-9 font-semibold underline">Reload latest inventory</button>}</div>}
      {success && <p role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}
    </section>
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#ddd7cf] bg-white/95 p-3 shadow-[0_-8px_24px_rgba(0,0,0,.08)] backdrop-blur lg:left-64"><div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-end gap-2"><button type="button" disabled={!changed || saving} onClick={() => reset()} className="min-h-11 rounded-lg border border-stone-300 px-4 text-xs font-semibold disabled:opacity-40">Discard</button><button type="button" disabled={!changed || saving} onClick={() => void save(false)} className="min-h-11 rounded-lg bg-[#625e59] px-5 text-xs font-semibold text-white disabled:opacity-40">{saving ? 'Saving…' : `Save changes${changedKeys.size ? ` (${changedKeys.size})` : ''}`}</button>{nextProduct && <button type="button" disabled={!changed || saving} onClick={() => void save(true)} className="min-h-11 rounded-lg bg-stone-800 px-5 text-xs font-semibold text-white disabled:opacity-40">Save &amp; next</button>}</div></div>
  </div>;
};

const SimpleEditor = ({ value, changed, onChange }: { value: number; changed: boolean; onChange: (value: number) => void }) => <div className="mx-auto mt-8 max-w-sm text-center"><label className="text-sm font-medium">Available units<input aria-label="Shared product stock" inputMode="numeric" min="0" step="1" type="number" value={value} onChange={(event) => onChange(normalizedStock(event.target.value))} className={`mt-3 w-full rounded-xl border px-4 py-5 text-center font-serif text-4xl outline-none ${changed ? 'border-amber-500 bg-amber-50' : 'border-stone-300 bg-white'}`} /></label><div className="mt-3 flex justify-center gap-2"><button type="button" className="min-h-11 rounded-lg border border-stone-300 px-5 text-lg" onClick={() => onChange(Math.max(0, value - 1))}>−1</button><button type="button" className="min-h-11 rounded-lg border border-stone-300 px-5 text-lg" onClick={() => onChange(value + 1)}>+1</button></div></div>;

const VariantEditor = ({ product, rows, baseRows, threshold, mode, onChange }: { product: Product; rows: VariantInventoryItem[]; baseRows: VariantInventoryItem[]; threshold: number; mode: 'size' | 'color' | 'matrix'; onChange: (rows: VariantInventoryItem[]) => void }) => {
  const update = (key: string, stock: number) => onChange(rows.map((row) => row.key === key ? { ...row, stock: normalizedStock(stock) } : row));
  const base = new Map(baseRows.map((row) => [row.key, row.stock]));
  if (mode === 'color') return <div className="mt-5 space-y-2">{rows.map((row) => <VariantRow key={row.key} row={row} image={product.colors.find((color) => color.colorName === row.colorName)?.images[0]} threshold={threshold} changed={base.get(row.key) !== row.stock} onChange={(stock) => update(row.key, stock)} />)}</div>;
  if (mode === 'size') return <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{rows.map((row) => <VariantRow key={row.key} row={row} threshold={threshold} changed={base.get(row.key) !== row.stock} onChange={(stock) => update(row.key, stock)} />)}</div>;
  const colors = product.colors.map((color) => color.colorName);
  const sizes = product.availableSizes;
  return <>
    <div className="mt-5 hidden overflow-x-auto md:block"><table className="w-full min-w-[640px] border-separate border-spacing-0 text-xs"><thead><tr><th className="sticky left-0 z-10 border-b border-stone-300 bg-white p-3 text-left">Color</th>{sizes.map((size) => <th key={size} className="border-b border-stone-300 p-3 text-center">{size}</th>)}<th className="border-b border-stone-300 p-3 text-center">Total</th></tr></thead><tbody>{colors.map((colorName) => { const colorRows = sizes.map((size) => rows.find((row) => row.colorName === colorName && row.size === size)).filter((row): row is VariantInventoryItem => Boolean(row)); return <tr key={colorName}><th className="sticky left-0 z-10 border-b border-stone-100 bg-white p-3 text-left"><span className="flex items-center gap-2"><ProductImage src={product.colors.find((color) => color.colorName === colorName)?.images[0]} alt={colorName} className="h-10 w-8 rounded object-cover" />{colorName}</span></th>{colorRows.map((row) => <td key={row.key} className="border-b border-stone-100 p-2 text-center"><StockInput row={row} threshold={threshold} changed={base.get(row.key) !== row.stock} onChange={(stock) => update(row.key, stock)} /></td>)}<td className="border-b border-stone-100 p-3 text-center font-semibold">{colorRows.reduce((sum, row) => sum + row.stock, 0)}</td></tr>; })}</tbody></table></div>
    <div className="mt-5 space-y-3 md:hidden">{colors.map((colorName, index) => <details key={colorName} open={index === 0} className="rounded-lg border border-stone-200"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 p-3"><span className="flex items-center gap-3 font-semibold"><ProductImage src={product.colors.find((color) => color.colorName === colorName)?.images[0]} alt={colorName} className="h-11 w-9 rounded object-cover" />{colorName}</span><span className="text-xs text-stone-500">{rows.filter((row) => row.colorName === colorName).reduce((sum, row) => sum + row.stock, 0)} total</span></summary><div className="space-y-2 border-t border-stone-100 p-3">{rows.filter((row) => row.colorName === colorName).map((row) => <VariantRow key={row.key} row={row} threshold={threshold} changed={base.get(row.key) !== row.stock} onChange={(stock) => update(row.key, stock)} />)}</div></details>)}</div>
  </>;
};

const VariantRow = ({ row, image, threshold, changed, onChange }: { row: VariantInventoryItem; image?: string; threshold: number; changed: boolean; onChange: (stock: number) => void; key?: React.Key }) => <div className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-stone-100 p-2"><span className="flex items-center gap-3 text-sm font-medium">{image && <ProductImage src={image} alt={row.colorName} className="h-11 w-9 rounded object-cover" />}{row.colorName || row.size || 'Variant'}{row.colorName && row.size && <small className="text-stone-500">{row.size}</small>}</span><StockInput row={row} threshold={threshold} changed={changed} onChange={onChange} /></div>;

const StockInput = ({ row, threshold, changed, onChange }: { row: VariantInventoryItem; threshold: number; changed: boolean; onChange: (stock: number) => void }) => <input aria-label={`Stock for ${row.colorName || 'all colors'} ${row.size || 'all sizes'}`} inputMode="numeric" min="0" step="1" type="number" value={row.stock} onChange={(event) => onChange(normalizedStock(event.target.value))} className={`h-11 w-20 rounded-lg border px-2 text-center font-semibold outline-none ${changed ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-100' : row.stock <= 0 ? 'border-rose-300 bg-rose-50 text-rose-800' : row.stock <= threshold ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-stone-300 bg-white'}`} />;
