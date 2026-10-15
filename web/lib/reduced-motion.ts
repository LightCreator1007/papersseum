'use client';
import { useSyncExternalStore } from 'react';

const q = '(prefers-reduced-motion: reduce)';
const sub = (cb: () => void) => {
  const m = matchMedia(q);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};

/** True when the OS asks for reduced motion. The server snapshot is true, so SSR never renders a pre-animation state. */
export const useReducedMotion = () => useSyncExternalStore(sub, () => matchMedia(q).matches, () => true);
