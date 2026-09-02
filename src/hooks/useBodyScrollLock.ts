import { useEffect } from 'react';

let activeLocks = 0;
let previousOverflow = '';
let previousPaddingRight = '';

/**
 * Coordinates page scroll locking across independent drawers and modals.
 * Each open overlay acquires one lock; scrolling is restored only after the
 * final overlay releases it.
 */
export const useBodyScrollLock = (locked: boolean) => {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') return;

    const body = document.body;
    if (activeLocks === 0) {
      previousOverflow = body.style.overflow;
      previousPaddingRight = body.style.paddingRight;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    }

    activeLocks += 1;
    return () => {
      activeLocks = Math.max(0, activeLocks - 1);
      if (activeLocks === 0) {
        body.style.overflow = previousOverflow;
        body.style.paddingRight = previousPaddingRight;
      }
    };
  }, [locked]);
};
