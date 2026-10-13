import React, { useEffect, useState } from 'react';

export const ShoppingConnectionNotice = () => {
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => {
    const update = () => setOffline(navigator.onLine === false);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  if (!offline) return null;
  return <p role="status" className="my-4 text-sm text-amber-800">
    You are offline. Saved selections are preserved; reconnect before making changes.
    <button onClick={() => window.location.reload()} className="ml-2 underline">Retry</button>
  </p>;
};

export const CartRetentionNotice = () => <p className="my-3 text-xs leading-5 text-stone-600">
  Your Cart shows saved selections, not payment status. Verified purchased quantities are removed automatically. Items may remain while cleanup is pending or when an older checkout cannot be matched safely.
  Check My Orders for payment status before paying again. You can manually remove purchased items from your Cart.
</p>;
