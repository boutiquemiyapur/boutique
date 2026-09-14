import React, { useState } from 'react';

/** Neutral media state; never substitute an unrelated catalog image. */
export const ProductImage = ({ src, alt, className = '', ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
  const [failedSource, setFailedSource] = useState<string>();
  return !src || failedSource === src
    ? <span role="img" aria-label={alt || 'Product image unavailable'} className={`inline-flex items-center justify-center bg-stone-100 text-center text-xs text-stone-500 ${className}`}>Image unavailable</span>
    : <img {...props} src={src} alt={alt} className={className} onError={() => setFailedSource(src)} />;
};
