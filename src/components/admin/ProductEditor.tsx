import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Product } from '../../types';
import { normalizeProduct, productValidationError, uniqueValues } from '../../utils/productData';
import { MediaUploader } from './MediaUploader';

const input = 'mt-1 w-full min-w-0 border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-stone-700';

export const ProductEditor = ({ product, onClose, onSave }: { product: Product | null; onClose: () => void; onSave: (product: Product) => Promise<void> }) => {
  const [draft, setDraft] = useState(() => normalizeProduct(product || { id: `ab-${Date.now()}`, isActive: true }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof Product>(key: K, value: Product[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    const validationError = productValidationError(draft);
    if (validationError) { setError(validationError); return; }
    if (draft.colors.some((color) => !color.colorName.trim() || (color.colorHex && !/^#[0-9a-f]{6}$/i.test(color.colorHex)))) {
      setError('Each color needs a name; optional hex codes must use #RRGGBB.'); return;
    }
    if ((draft.specifications || []).some((row) => Boolean(row.label.trim()) !== Boolean(row.value.trim()))) {
      setError('Enter both a label and value for each specification, or remove the row.'); return;
    }
    setSaving(true);
    try { await onSave(normalizeProduct(draft)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Product could not be saved. Please try again.'); }
    finally { setSaving(false); }
  };
  const textField = (key: 'title' | 'sku' | 'category' | 'subtitle' | 'fabric' | 'occasion' | 'zariType' | 'blouseLength' | 'sareeLength', label: string, required = false) => <label className="text-sm">{label}<input required={required} className={input} value={draft[key] || ''} onChange={(event) => set(key, event.target.value)} /></label>;
  return <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/45 p-4"><div role="dialog" aria-modal="true" aria-labelledby="product-editor-title" className="mx-auto my-8 w-full max-w-2xl bg-white p-4 shadow-2xl sm:p-6">
    <div className="flex items-center justify-between border-b border-stone-200 pb-4"><h2 id="product-editor-title" className="font-serif text-2xl">{product ? 'Edit product' : 'Add product'}</h2><button type="button" disabled={saving} onClick={onClose} aria-label="Close"><X /></button></div>
    <form onSubmit={submit} className="mt-5 grid gap-4">
      {textField('title', 'Product name', true)}
      <div className="grid gap-3 sm:grid-cols-2">{textField('sku', 'SKU', true)}{textField('category', 'Category', true)}
        <label>Price (INR)<input required className={input} min="0" step="0.01" type="number" value={draft.priceINR} onChange={(event) => set('priceINR', Number(event.target.value))} /></label>
        <label>Stock<input required className={input} min="0" step="1" type="number" value={draft.stockCount} onChange={(event) => set('stockCount', Number(event.target.value))} /></label>
        <label>Original price / MRP (optional)<input className={input} type="number" min="0" step="0.01" value={draft.originalPriceINR ?? ''} onChange={(event) => set('originalPriceINR', event.target.value === '' ? undefined : Number(event.target.value))} /></label>
        <label>Discount % (optional)<input className={input} type="number" min="0" max="100" step="0.01" value={draft.discountPercentage ?? ''} onChange={(event) => set('discountPercentage', event.target.value === '' ? undefined : Number(event.target.value))} /></label>
      </div>
      {textField('subtitle', 'Subtitle (optional)')}
      <label>Description (optional)<textarea className={input} rows={4} value={draft.description} onChange={(event) => set('description', event.target.value)} /></label>
      <div className="grid gap-3 sm:grid-cols-2">{textField('fabric', 'Material / Fabric Composition (optional)')}{textField('occasion', 'Occasion (optional)')}</div>
      <label>Care instructions (optional)<textarea className={input} rows={2} value={draft.careInstructions} onChange={(event) => set('careInstructions', event.target.value)} /></label>
      <ValueList label="Available sizes (optional)" values={draft.availableSizes} suggestions={['XS', 'S', 'M', 'L', 'XL', 'XXL']} onChange={(values) => set('availableSizes', values)} />
      <fieldset className="min-w-0 border border-stone-200 p-3"><legend className="text-sm">Available colors / shades (optional)</legend>
        <p className="mb-3 text-xs text-stone-500">Add only available colors. Hex codes and images are optional.</p>
        {draft.colors.map((color, index) => <div key={index} className="mb-3 border-b border-stone-100 pb-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><label className="text-xs">Color name<input required aria-label={`Color ${index + 1} name`} className={input} value={color.colorName} onChange={(event) => set('colors', draft.colors.map((item, i) => i === index ? { ...item, colorName: event.target.value } : item))} /></label>
            <label className="text-xs">Hex code (optional)<input className={input} placeholder="#008000" value={color.colorHex} onChange={(event) => set('colors', draft.colors.map((item, i) => i === index ? { ...item, colorHex: event.target.value } : item))} /></label>
            <button type="button" aria-label={`Remove color ${index + 1}`} onClick={() => set('colors', draft.colors.filter((_, i) => i !== index))} className="min-h-11 px-2 text-xs underline">Remove</button></div>
          <label className="text-xs">Color image URLs (one per line, optional)<textarea className={input} rows={2} value={color.images.join('\n')} onChange={(event) => set('colors', draft.colors.map((item, i) => i === index ? { ...item, images: event.target.value.split('\n') } : item))} /></label>
          <MediaUploader folder="products" recordId={draft.id} onUploaded={(url) => setDraft((current) => ({ ...current, colors: current.colors.map((item, i) => i === index ? { ...item, images: [...item.images, url] } : item) }))} />
        </div>)}
        <button type="button" onClick={() => set('colors', [...draft.colors, { colorName: '', colorHex: '', images: [] }])} className="min-h-11 text-xs underline">+ Add color</button>
      </fieldset>
      <fieldset className="min-w-0 border border-stone-200 p-3"><legend className="text-sm">Additional specifications (optional)</legend>
        <p className="mb-3 text-xs text-stone-500">Use for relevant details such as number of pieces or finish. Material and care have their own fields above.</p>
        {(draft.specifications || []).map((row, index) => <div key={index} className="mb-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input aria-label={`Specification ${index + 1} label`} placeholder="Label" className={input} value={row.label} onChange={(event) => set('specifications', draft.specifications!.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} />
          <input aria-label={`Specification ${index + 1} value`} placeholder="Value" className={input} value={row.value} onChange={(event) => set('specifications', draft.specifications!.map((item, i) => i === index ? { ...item, value: event.target.value } : item))} />
          <button type="button" onClick={() => set('specifications', draft.specifications!.filter((_, i) => i !== index))} className="min-h-11 px-2 text-xs underline">Remove</button>
        </div>)}<button type="button" onClick={() => set('specifications', [...(draft.specifications || []), { label: '', value: '' }])} className="min-h-11 text-xs underline">+ Add specification</button>
      </fieldset>
      <details className="border border-stone-200 p-3"><summary className="cursor-pointer text-sm">Other optional product details</summary><div className="mt-3 grid gap-3">
        {textField('zariType', 'Zari specification (if applicable)')}
        <label>Weight in grams (optional)<input className={input} min="0" step="any" type="number" value={draft.weightGrams ?? ''} onChange={(event) => set('weightGrams', event.target.value === '' ? undefined : Number(event.target.value))} /></label>
        {textField('blouseLength', 'Blouse length (if applicable)')}{textField('sareeLength', 'Saree length (if applicable)')}
        <label>Additional product details (optional)<textarea className={input} rows={3} value={draft.craftDetails} onChange={(event) => set('craftDetails', event.target.value)} /></label>
        <label className="text-xs"><input type="checkbox" checked={draft.includesBlousePiece === true} onChange={(event) => set('includesBlousePiece', event.target.checked)} /> Includes blouse piece</label>
        <ValueList label="Tags (optional)" values={draft.tags} onChange={(values) => set('tags', values)} />
        <label className="text-xs"><input type="checkbox" checked={draft.customStitchingAvailable} onChange={(event) => set('customStitchingAvailable', event.target.checked)} /> Custom tailoring available</label>
        {draft.customStitchingAvailable && <label>Tailoring fee (INR)<input type="number" min="0" step="0.01" className={input} value={draft.customStitchingFeeINR} onChange={(event) => set('customStitchingFeeINR', Number(event.target.value))} /></label>}
      </div></details>
      <label>Primary image URL (optional)<input className={input} value={draft.images[0] || ''} onChange={(event) => set('images', [event.target.value, ...draft.images.slice(1)])} /></label>
      <MediaUploader folder="products" recordId={draft.id} value={draft.images[0]} onUploaded={(url) => setDraft((current) => ({ ...current, images: [url, ...current.images.slice(1)] }))} onRemove={() => set('images', draft.images.slice(1))} />
      <p className="text-xs text-stone-500">Additional product images</p>
      <MediaUploader folder="products" recordId={draft.id} onUploaded={(url) => setDraft((current) => ({ ...current, images: [...current.images, url] }))} />
      <div className="flex flex-wrap gap-3">{draft.images.filter(Boolean).map((url, index) => <div key={`${url}-${index}`}><img src={url} alt="Product preview" className="h-20 w-16 object-cover" /><button type="button" aria-label={`Remove image ${index + 1}`} onClick={() => set('images', draft.images.filter((item) => item !== url))} className="min-h-11 text-xs underline">Remove</button></div>)}</div>
      <div className="grid gap-3 sm:grid-cols-2">{([['isActive', 'Published'], ['isReadyToShip', 'Ready to ship'], ['isBestseller', 'Bestseller'], ['isNewArrival', 'New arrival'], ['isHandloomCertified', 'Handloom certified (only if verified)']] as const).map(([key, label]) => <label key={key} className="text-xs"><input type="checkbox" checked={draft[key] === true} onChange={(event) => set(key, event.target.checked)} /> {label}</label>)}</div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button disabled={saving} className="bg-[#625e59] py-3 text-xs font-semibold uppercase tracking-widest text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save product'}</button>
    </form>
  </div></div>;
};

const ValueList = ({ label, values, onChange, suggestions = [] }: { label: string; values: string[]; onChange: (values: string[]) => void; suggestions?: string[] }) => {
  const [value, setValue] = useState('');
  const add = () => { onChange(uniqueValues([...values, value])); setValue(''); };
  return <fieldset className="min-w-0 border border-stone-200 p-3"><legend className="text-sm">{label}</legend>
    <div className="flex flex-wrap gap-2">{values.map((item) => <button type="button" key={item} aria-label={`Remove ${item}`} onClick={() => onChange(values.filter((entry) => entry !== item))} className="min-h-11 border border-stone-300 px-3 text-xs">{item} ×</button>)}</div>
    <div className="mt-2 flex flex-wrap gap-2">{suggestions.filter((item) => !values.includes(item)).map((item) => <button type="button" key={item} onClick={() => onChange(uniqueValues([...values, item]))} className="min-h-11 px-2 text-xs underline">+ {item}</button>)}</div>
    <div className="flex gap-2"><input aria-label={`Add to ${label}`} className={input} value={value} placeholder="Enter a custom value" onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} /><button type="button" onClick={add} className="shrink-0 px-2 text-xs underline">+ Add</button></div>
  </fieldset>;
};
