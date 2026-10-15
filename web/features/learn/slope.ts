// Chapter 1's "Slope Explorer": a curve, a point you can slide along it, and the tangent line there.
// The slope of that line is the derivative. Plain functions so the maths is testable.

export type Fn = {
  id: string;
  label: string; // plain text, e.g. "f(x) = x^2 - 4x + 5"
  f: (x: number) => number;
  df: (x: number) => number; // the derivative, worked out by hand
  min: number;
  max: number;
  flats: number[]; // where the slope is exactly zero (the lowest and highest points)
};

export const FUNCTIONS: Fn[] = [
  {
    id: "parabola",
    label: "f(x) = x² − 4x + 5",
    f: (x) => x * x - 4 * x + 5,
    df: (x) => 2 * x - 4,
    min: -1,
    max: 5,
    flats: [2],
  },
  {
    id: "cubic",
    label: "f(x) = x³/3 − x² − 3x + 4",
    f: (x) => (x * x * x) / 3 - x * x - 3 * x + 4,
    df: (x) => x * x - 2 * x - 3,
    min: -3,
    max: 5,
    flats: [-1, 3],
  },
  {
    id: "sine",
    label: "f(x) = sin x",
    f: (x) => Math.sin(x),
    df: (x) => Math.cos(x),
    min: 0,
    max: 2 * Math.PI,
    flats: [Math.PI / 2, (3 * Math.PI) / 2],
  },
];

export function sample(fn: Fn, n = 160): { x: number; y: number }[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const x = fn.min + ((fn.max - fn.min) * i) / n;
    return { x, y: fn.f(x) };
  });
}

// The vertical range of the curve, with a little padding.
export function yRange(fn: Fn): { lo: number; hi: number } {
  const ys = sample(fn).map((p) => p.y);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const pad = (hi - lo) * 0.12 || 1;
  return { lo: lo - pad, hi: hi + pad };
}

// Two points on the tangent line at x, half a unit either side.
export function tangent(fn: Fn, x: number, half = 1): { x1: number; y1: number; x2: number; y2: number } {
  const m = fn.df(x);
  const y = fn.f(x);
  return { x1: x - half, y1: y - m * half, x2: x + half, y2: y + m * half };
}

// "Flat" means the slope is close enough to zero that the line looks level.
export function isFlat(slope: number, tol = 0.08): boolean {
  return Math.abs(slope) < tol;
}
