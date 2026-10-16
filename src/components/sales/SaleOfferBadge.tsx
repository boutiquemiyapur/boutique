import React from 'react';
import type { Product } from '../../types';
import { useStore } from '../../context/StoreContext';
export const SaleOfferBadge = ({ product }: { product: Product }) => {
  const { navigate } = useStore();
  if (!product.saleCampaign) return null;
  return <a href={`/sale/${product.saleCampaign.slug}`} onClick={event => { event.preventDefault(); event.stopPropagation(); navigate('sale', product.saleCampaign!.slug); }} className="inline-block max-w-full break-words bg-[#f3e9d8] px-2 py-1 text-[10px] font-semibold text-[#58401b]">{product.saleCampaign.name}</a>;
};
