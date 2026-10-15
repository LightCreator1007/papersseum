'use client';
import type { RefObject } from 'react';
import { animate, createAnimatable, createTimeline, cubicBezier, stagger } from 'animejs';
import { useAnimeScope } from '@/lib/anime';
import { PLAYER_COLORS } from '@/features/ladder/colors';
import { bezier, durMs, STAGGER } from '@/lib/motion';

export type CharacterState = 'idle' | 'working' | 'win' | 'dead' | 'still';

const GRID = 12;

/** Furthest the eyes travel toward the pointer, in cells. */
export const GAZE_REACH = 0.5;
/** Pointer distance, in character widths, at which the gaze reaches GAZE_REACH. */
const GAZE_SATURATE = 1;

/** Idle cadence: gaps between beats, in ms. These space the loops out; every beat itself runs on a duration token. */
const BLINK_GAP: readonly [number, number] = [3000, 5000];
const WIGGLE_GAP: readonly [number, number] = [2600, 4400];
const GLANCE_HOLD = durMs.loop;
const GLANCE_GAP: readonly [number, number] = [5200, 8400];

/** Hop heights for the win celebration, in cells: two small, one big. */
const WIN_HOPS = [2, 2, 3] as const;
const DROP_MAX = 3;

const curve = (b: string) => {
  const [x1, y1, x2, y2] = b.split(',').map(Number);
  return cubicBezier(x1, y1, x2, y2);
};
const EASE = { smooth: curve(bezier.smooth), swing: curve(bezier.swing), move: curve(bezier.move) } as const;
const HOP_EASE = 'out(3)';

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** A stable number in [0, 1) per key, so a roster of characters never moves in sync. */
export const seededPhase = (key: string) => hash(key) / 4294967296;

/** Whole-cell drop for the dead pose, keyed by position so an eye falls with the body cell under it. */
export const dropFor = (key: string, x: number, y: number) => 1 + (hash(`${key}:${x},${y}`) % DROP_MAX);

export const cellIndex = (x: number, y: number) => y * GRID + x;

/** Eye offset in cells toward a pointer at (dx, dy) character widths from the centre. */
export function gaze(dx: number, dy: number): { x: number; y: number } {
  const d = Math.hypot(dx, dy);
  if (d === 0) return { x: 0, y: 0 };
  const k = (GAZE_REACH * Math.min(1, d / GAZE_SATURATE)) / d;
  return { x: dx * k, y: dy * k };
}

/** Reads a numeric attribute off an anime.js target; non-elements read as 0. */
const num = (t: unknown, attr: string) => (t instanceof Element ? Number(t.getAttribute(attr)) : 0);

const between = ([lo, hi]: readonly [number, number], t: number) => lo + (hi - lo) * t;

type Parts = {
  svg: SVGSVGElement;
  figure: SVGGElement;
  antenna: SVGGElement;
  gazeLayer: SVGGElement;
  lids: SVGGElement;
  rects: SVGRectElement[];
  accents: SVGRectElement[];
  bodies: SVGRectElement[];
};

function parts(svg: SVGSVGElement): Parts | null {
  const layer = (name: string) => svg.querySelector<SVGGElement>(`[data-layer="${name}"]`);
  const figure = layer('figure');
  const antenna = layer('antenna');
  const gazeLayer = layer('gaze');
  const lids = layer('lids');
  if (!figure || !antenna || !gazeLayer || !lids) return null;
  const rects = [...svg.querySelectorAll<SVGRectElement>('rect')];
  return {
    svg, figure, antenna, gazeLayer, lids, rects,
    accents: rects.filter((r) => r.dataset.part === 'accent'),
    bodies: rects.filter((r) => r.dataset.part === 'body'),
  };
}

function blink(p: Parts, seed: string) {
  const gap = between(BLINK_GAP, seededPhase(`${seed}/blink-gap`));
  animate(p.lids, {
    scaleY: [{ to: 0.1, duration: durMs.fast / 2 }, { to: 1, duration: durMs.fast / 2 }],
    ease: EASE.smooth,
    delay: seededPhase(`${seed}/blink`) * gap,
    loop: true,
    loopDelay: gap,
  });
}

function wiggle(p: Parts, seed: string) {
  if (!p.antenna.childElementCount) return;
  const gap = between(WIGGLE_GAP, seededPhase(`${seed}/wiggle-gap`));
  const dir = seededPhase(`${seed}/wiggle-dir`) < 0.5 ? -1 : 1;
  animate(p.antenna, {
    translateX: [
      { to: dir, duration: durMs.moderate },
      { to: -dir, duration: durMs.slow },
      { to: 0, duration: durMs.moderate },
    ],
    ease: EASE.swing,
    delay: seededPhase(`${seed}/wiggle`) * gap,
    loop: true,
    loopDelay: gap,
  });
}

function glance(p: Parts, seed: string) {
  const gap = between(GLANCE_GAP, seededPhase(`${seed}/glance-gap`));
  const d = (seededPhase(`${seed}/glance-dir`) < 0.5 ? -1 : 1) * GAZE_REACH;
  animate(p.gazeLayer, {
    translateX: [
      { to: d, duration: durMs.moderate },
      { to: d, duration: GLANCE_HOLD },
      { to: 0, duration: durMs.moderate },
      { to: 0, duration: gap },
      { to: -d, duration: durMs.moderate },
      { to: -d, duration: GLANCE_HOLD },
      { to: 0, duration: durMs.moderate },
    ],
    ease: EASE.smooth,
    delay: seededPhase(`${seed}/glance`) * gap,
    loop: true,
    loopDelay: gap,
  });
}

function follow(p: Parts): () => void {
  const eyes = createAnimatable(p.gazeLayer, {
    translateX: durMs.moderate,
    translateY: durMs.moderate,
    ease: EASE.smooth,
  });
  const look = (x: number, y: number) => {
    eyes.translateX(x);
    eyes.translateY(y);
  };
  const onMove = (e: PointerEvent) => {
    const r = p.svg.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const g = gaze((e.clientX - r.left - r.width / 2) / r.width, (e.clientY - r.top - r.height / 2) / r.height);
    look(g.x, g.y);
  };
  const onOut = (e: PointerEvent) => {
    if (!e.relatedTarget) look(0, 0);
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerout', onOut);
  return () => {
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerout', onOut);
  };
}

function work(p: Parts, seed: string) {
  const L = durMs.loop;
  animate(p.figure, {
    translateY: [
      { to: 0, duration: L * 0.15 },
      { to: -2, duration: L * 0.3, ease: HOP_EASE },
      { to: 0, duration: L * 0.25, ease: EASE.move },
      { to: 0, duration: L * 0.3 },
    ],
    scaleY: [
      { to: 0.92, duration: L * 0.15, ease: EASE.smooth },
      { to: 1.05, duration: L * 0.3, ease: HOP_EASE },
      { to: 1, duration: L * 0.25, ease: EASE.smooth },
      { to: 0.94, duration: L * 0.06, ease: EASE.smooth },
      { to: 1, duration: L * 0.24, ease: EASE.smooth },
    ],
    delay: seededPhase(`${seed}/work`) * L,
    loop: true,
  });
}

function celebrate(p: Parts) {
  const tl = createTimeline();
  // Each landing squashes, and the next take-off stretches out of that squash, so the three hops read as one bounce.
  for (const h of WIN_HOPS) {
    tl.add(p.figure, { translateY: -h, scaleY: 1.05, duration: durMs.fast + durMs.instant, ease: HOP_EASE })
      .add(p.figure, { translateY: 0, scaleY: 0.9, duration: durMs.fast, ease: EASE.move });
  }
  tl.add(p.figure, { scaleY: 1, duration: durMs.fast, ease: EASE.smooth });
  // A solid pattern has no accent cells, so its body cells carry the flash instead.
  const cells = p.accents.length ? p.accents : p.bodies;
  if (!cells.length) return;
  const rest = getComputedStyle(cells[0]).fill;
  tl.add(cells, {
    fill: [...PLAYER_COLORS.map((c) => ({ to: c, duration: durMs.instant })), { to: rest, duration: durMs.fast }],
    ease: 'linear',
    delay: stagger(STAGGER * 1000, {
      grid: [GRID, GRID],
      from: 'center',
      total: GRID * GRID,
      use: (el) => num(el, 'data-i'),
    }),
    // Hand the colour back to the stylesheet so a theme switch after the win still repaints.
    onComplete: () => cells.forEach((c) => c.style.removeProperty('fill')),
  }, `-=${durMs.fast}`);
}

function die(p: Parts, seed: string) {
  animate(p.svg, { opacity: [1, 0.3], duration: durMs.slow, ease: EASE.smooth });
  animate(p.rects, {
    translateY: (el: unknown) => dropFor(seed, num(el, 'x'), num(el, 'y')),
    duration: durMs.slow,
    ease: EASE.smooth,
  });
}

type MotionOptions = { state: CharacterState; lookAt: boolean; seed: string };

/**
 * Drives a BotCharacter svg with anime.js. Reduced motion and `still` add nothing,
 * so the stylesheet's still pose stands (dead is dimmed there, win shows the accent).
 */
export function useCharacterMotion(root: RefObject<SVGSVGElement | null>, { state, lookAt, seed }: MotionOptions) {
  useAnimeScope(
    root,
    (_scope, reduced) => {
      const svg = root.current;
      if (!svg || reduced || state === 'still') return;
      const p = parts(svg);
      if (!p) return;
      if (state === 'dead') {
        die(p, seed);
        return;
      }
      blink(p, seed);
      wiggle(p, seed);
      if (state === 'working') work(p, seed);
      if (state === 'win') celebrate(p);
      if (lookAt) return follow(p);
      glance(p, seed);
    },
    [state, lookAt, seed],
  );
}
