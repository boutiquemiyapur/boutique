import React from 'react';
import { useStore } from '../../context/StoreContext';

export const WishlistReferenceNotice = () => {
  const { wishlistUnavailableCount, wishlistMissingCount } = useStore();
  if (!wishlistUnavailableCount && !wishlistMissingCount) return null;
  return <p role="status" className="my-4 text-sm text-stone-600">
    {wishlistUnavailableCount > 0 && `${wishlistUnavailableCount} saved product(s) are currently hidden or unavailable. `}
    {wishlistMissingCount > 0 && `${wishlistMissingCount} saved reference(s) could not be found in the current catalog. `}
    Your saved references are preserved. Out-of-stock styles stay visible for later.
  </p>;
};
