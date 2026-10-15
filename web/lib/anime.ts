'use client';
import { useEffect, type DependencyList, type RefObject } from 'react';
import { createScope, type Scope } from 'animejs';
import { useReducedMotion } from './reduced-motion';

export type AnimeSetup = (scope: Scope, reduced: boolean) => void | (() => void);

/**
 * Runs `setup` inside an anime.js scope rooted at `root`. Every instance created in
 * `setup` is reverted on unmount, when reduced motion flips, or when `deps` change.
 * `setup` may return a cleanup for listeners it added.
 */
export function useAnimeScope(root: RefObject<HTMLElement | SVGElement | null>, setup: AnimeSetup, deps: DependencyList = []) {
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const scope = createScope({ root: el });
    scope.add(() => setup(scope, reduced));
    return () => scope.revert();
    // The caller owns `deps`, like useGSAP's dependencies; `root` and `setup` are read fresh on each run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, ...deps]);
}
