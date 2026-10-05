import { useLayoutEffect } from 'react';

export const positionNavigation = (target?: HTMLElement | null) => {
  const header = document.querySelector<HTMLElement>('[data-store-header]');
  const top = target ? Math.max(0, window.scrollY + target.getBoundingClientRect().top - (header?.getBoundingClientRect().height || 0) - 12) : 0;
  const root = document.documentElement;
  const previous = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  window.scrollTo({ top, behavior: 'auto' });
  root.style.scrollBehavior = previous;
};

/** Runs after the destination commits and drawer scroll locks have released. */
export const useNavigationScroll = (key: string | number, selector?: string) => {
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => positionNavigation(selector ? document.querySelector<HTMLElement>(selector) : null));
    return () => cancelAnimationFrame(frame);
  }, [key, selector]);
};
