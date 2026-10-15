// Motion tokens mirrored from styles/tokens.css. lib/motion.test.ts keeps them in sync.
export const durMs = { instant: 70, fast: 140, moderate: 240, slow: 420, loop: 1600 } as const;
export const dur = Object.fromEntries(Object.entries(durMs).map(([k, v]) => [k, v / 1000])) as { [K in keyof typeof durMs]: number };
export const ease = {
  smooth: 'cubic-bezier(0.23, 1, 0.32, 1)',
  swing: 'cubic-bezier(0.32, 0.72, 0, 1)',
  move: 'cubic-bezier(0.77, 0, 0.175, 1)',
} as const;
export const bezier = { smooth: '0.23,1,0.32,1', swing: '0.32,0.72,0,1', move: '0.77,0,0.175,1' } as const;
export type GsapEase = keyof typeof bezier;
export const gsapEase = { smooth: 'smooth', swing: 'swing', move: 'move' } as const satisfies Record<GsapEase, GsapEase>;
export const STAGGER = 0.04;
export const STAGGER_MAX = 0.5;
export const staggerFor = (n: number) => (n <= 1 ? STAGGER : Math.min(STAGGER, STAGGER_MAX / (n - 1)));
export const stage = { short: 0.8, long: 2.0 } as const;

/** Runs before paint: marks JS as on so [data-reveal] may start hidden (see styles/motion.css). */
export const JS_BOOT = `document.documentElement.classList.add('js');`;
