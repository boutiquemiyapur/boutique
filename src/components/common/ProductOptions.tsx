import React from 'react';
import { Product } from '../../types';
import { hasVariantInventory, isVariantAvailable } from '../../utils/productData';

export const ProductOptions = ({ product, color, size, onColor, onSize }: { product: Product; color: string; size: string; onColor: (value: string) => void; onSize: (value: string) => void }) => {
  const configured = hasVariantInventory(product);
  const colorAvailable = (colorName: string) => !configured || (product.availableSizes.length
    ? product.availableSizes.some((candidateSize) => isVariantAvailable(product, colorName, candidateSize))
    : isVariantAvailable(product, colorName, ''));
  const sizeAvailable = (candidateSize: string, colorName = color) => !configured || (product.colors.length
    ? Boolean(colorName) && isVariantAvailable(product, colorName, candidateSize)
    : isVariantAvailable(product, '', candidateSize));
  const chooseColor = (colorName: string) => {
    onColor(colorName);
    if (product.availableSizes.length && !sizeAvailable(size, colorName)) onSize(product.availableSizes.find((candidate) => sizeAvailable(candidate, colorName)) || '');
  };
  return <div className="space-y-4">
  {product.colors.length > 0 && <fieldset><legend className="mb-2 text-xs font-semibold uppercase tracking-wider">Select color</legend><div className="flex flex-wrap gap-2">{product.colors.map((item) => { const unavailable = !colorAvailable(item.colorName); return <button type="button" key={item.colorName} disabled={unavailable} aria-pressed={color === item.colorName} onClick={() => chooseColor(item.colorName)} className={`flex min-h-11 max-w-full items-center gap-2 break-words rounded-lg border px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${color === item.colorName ? 'border-[#8B1E3F] bg-[#8B1E3F]/5 text-[#8B1E3F]' : 'border-stone-300 bg-white'}`}>
    {/^#[0-9a-f]{6}$/i.test(item.colorHex) && <span aria-hidden="true" className="h-5 w-5 shrink-0 rounded-full border border-stone-300" style={{ backgroundColor: item.colorHex }} />}{item.colorName}
  </button>; })}</div></fieldset>}
  {product.availableSizes.length > 0 && <fieldset><legend className="mb-2 text-xs font-semibold uppercase tracking-wider">Select size</legend><div className="flex flex-wrap gap-2">{product.availableSizes.map((item) => { const unavailable = !sizeAvailable(item); return <button type="button" key={item} disabled={unavailable} aria-pressed={size === item} onClick={() => onSize(item)} className={`min-h-11 max-w-full break-words rounded-lg border px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${size === item ? 'border-[#8B1E3F] bg-[#8B1E3F] text-white' : 'border-stone-300 bg-white'}`}>{item}{unavailable ? ' · Sold out' : ''}</button>; })}</div></fieldset>}
</div>;
};
