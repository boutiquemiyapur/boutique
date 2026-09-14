import React from 'react';
import { Product } from '../../types';

export const ProductOptions = ({ product, color, size, onColor, onSize }: { product: Product; color: string; size: string; onColor: (value: string) => void; onSize: (value: string) => void }) => <div className="space-y-4">
  {product.colors.length > 0 && <fieldset><legend className="mb-2 text-xs font-semibold uppercase tracking-wider">Select color</legend><div className="flex flex-wrap gap-2">{product.colors.map((item) => <button type="button" key={item.colorName} aria-pressed={color === item.colorName} onClick={() => onColor(item.colorName)} className={`flex min-h-11 max-w-full items-center gap-2 break-words rounded-lg border px-3 py-2 text-xs ${color === item.colorName ? 'border-[#8B1E3F] bg-[#8B1E3F]/5 text-[#8B1E3F]' : 'border-stone-300 bg-white'}`}>
    {/^#[0-9a-f]{6}$/i.test(item.colorHex) && <span aria-hidden="true" className="h-5 w-5 shrink-0 rounded-full border border-stone-300" style={{ backgroundColor: item.colorHex }} />}{item.colorName}
  </button>)}</div></fieldset>}
  {product.availableSizes.length > 0 && <fieldset><legend className="mb-2 text-xs font-semibold uppercase tracking-wider">Select size</legend><div className="flex flex-wrap gap-2">{product.availableSizes.map((item) => <button type="button" key={item} aria-pressed={size === item} onClick={() => onSize(item)} className={`min-h-11 max-w-full break-words rounded-lg border px-4 py-2 text-xs ${size === item ? 'border-[#8B1E3F] bg-[#8B1E3F] text-white' : 'border-stone-300 bg-white'}`}>{item}</button>)}</div></fieldset>}
</div>;
