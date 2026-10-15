'use client';
import { useRef, type Ref } from 'react';
import { animate, cubicBezier } from 'animejs';
import { useAnimeScope } from '@/lib/anime';
import { bezier, durMs, staggerFor } from '@/lib/motion';
import styles from './logo-mark.module.css';

export type LogoAnimate = 'boot' | 'hover' | 'none';

type Props = {
  size: number;
  animate?: LogoAnimate;
  /** With animate="boot" the Home timeline (Task 8) takes over the cells through this ref. */
  ref?: Ref<SVGSVGElement>;
};

const CELLS = ['n', 'w', 'e', 's', 'c'] as const;
const CLOCKWISE = ['n', 'e', 's', 'w'] as const;
const POS: Record<(typeof CELLS)[number], [number, number]> = { n: [1, 0], w: [0, 1], e: [2, 1], s: [1, 2], c: [1, 1] };
const FINE_HOVER = '(hover: hover) and (pointer: fine)';
const smooth = cubicBezier(...(bezier.smooth.split(',').map(Number) as [number, number, number, number]));
const stepMs = staggerFor(CELLS.length) * 1000;

/**
 * The brand mark: a 3x3 grid, four inked cells around an empty centre. Five cells take part
 * (the inked four plus the centre), one per player. Decorative: the wordmark beside it carries the name.
 */
export function LogoMark({ size, animate: mode = 'none', ref }: Props) {
  const own = useRef<SVGSVGElement>(null);
  const setRef = (node: SVGSVGElement | null) => {
    own.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  useAnimeScope(own, (_scope, reduced) => {
    const svg = own.current;
    if (mode !== 'hover' || !svg || !matchMedia(FINE_HOVER).matches) return;
    const cell = (k: string) => svg.querySelector<SVGRectElement>(`[data-cell="${k}"]`)!;
    const ring = CLOCKWISE.map(cell);
    const centre = cell('c');
    const trigger = svg.closest('a, button') ?? svg;
    let running: { cancel: () => unknown }[] = [];
    const cancel = () => {
      running.forEach((a) => a.cancel());
      running = [];
    };
    const clear = () => {
      [...ring, centre].forEach((el) => {
        el.style.removeProperty('fill');
        el.style.removeProperty('opacity');
      });
    };
    const enter = () => {
      svg.dataset.hover = 'true';
      if (reduced) return;
      cancel();
      const css = getComputedStyle(svg);
      const slot = (n: number) => css.getPropertyValue(`--slot-${n}`).trim();
      const base = { duration: durMs.moderate, ease: smooth };
      running = [
        ...ring.map((el, i) => animate(el, { ...base, fill: slot(i), delay: i * stepMs })),
        animate(centre, { ...base, opacity: 1, delay: ring.length * stepMs }),
      ];
    };
    const leave = () => {
      delete svg.dataset.hover;
      if (reduced) return;
      cancel();
      const ink = getComputedStyle(svg).getPropertyValue('--ink').trim();
      const base = { duration: durMs.moderate, ease: smooth };
      running = [
        ...ring.map((el, i) => animate(el, { ...base, fill: ink, delay: i * stepMs, onComplete: clear })),
        animate(centre, { ...base, opacity: 0, delay: ring.length * stepMs, onComplete: clear }),
      ];
    };
    trigger.addEventListener('pointerenter', enter);
    trigger.addEventListener('pointerleave', leave);
    return () => {
      trigger.removeEventListener('pointerenter', enter);
      trigger.removeEventListener('pointerleave', leave);
      cancel();
      clear();
      delete svg.dataset.hover;
    };
  }, [mode]);

  return (
    <svg
      ref={setRef}
      className={styles.mark}
      viewBox="0 0 3 3"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      data-animate={mode}
    >
      {CELLS.map((k) => (
        <rect key={k} data-cell={k} x={POS[k][0]} y={POS[k][1]} width={1} height={1} />
      ))}
    </svg>
  );
}
