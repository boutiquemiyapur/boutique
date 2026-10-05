import React, { useState } from 'react';

/** Neutral media state; never substitute an unrelated catalog image. */
export const ProductImage = ({ src, alt, className = '', ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
  const [failedSource, setFailedSource] = useState<string>();
  const [loadedSources, setLoadedSources] = useState<Set<string>>(() => new Set());
  return !src || failedSource === src
    ? <span role="img" aria-label={alt || 'Product image unavailable'} className={`inline-flex items-center justify-center bg-stone-100 text-center text-xs text-stone-500 ${className}`}>Image unavailable</span>
    : <img {...props} src={src} alt={alt} decoding={props.decoding || 'async'} loading={props.loading || 'lazy'}
        ref={(image) => { if (image?.complete && image.naturalWidth > 0 && !loadedSources.has(src)) setLoadedSources((previous) => new Set(previous).add(src)); }}
        className={`${className} ${loadedSources.has(src) ? '' : 'bg-[#eee9e2] motion-safe:animate-pulse'}`}
        onLoad={(event) => { setLoadedSources((previous) => new Set(previous).add(src)); props.onLoad?.(event); }}
        onError={(event) => { setFailedSource(src); props.onError?.(event); }} />;
};
