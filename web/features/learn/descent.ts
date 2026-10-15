// Chapter 9's "Gradient descent" demo: roll downhill on f(w) = (w - 3)^2 by repeatedly stepping against the slope.
// Mirrors resources/chapters/09-function-approximation/code/gradient_descent.py.

export const BOTTOM = 3;
export const f = (w: number) => (w - BOTTOM) ** 2;
export const slope = (w: number) => 2 * (w - BOTTOM);

// w <- w - alpha * slope(w), repeated. Returns w0 followed by the value after each step.
export function path(w0: number, alpha: number, steps: number): number[] {
  const out = [w0];
  for (let i = 0; i < steps; i++) out.push(out[out.length - 1] - alpha * slope(out[out.length - 1]));
  return out;
}

// For this bowl the distance from the bottom is multiplied by (1 - 2 alpha) on every step,
// so the step size alone decides what happens.
export function factor(alpha: number): number {
  return 1 - 2 * alpha;
}

export type Behaviour = "straight" | "smooth" | "overshoot" | "bounce" | "blowup";

export function behaviour(alpha: number): Behaviour {
  const k = factor(alpha);
  if (Math.abs(k) < 1e-9) return "straight";
  if (Math.abs(Math.abs(k) - 1) < 1e-9) return "bounce";
  if (Math.abs(k) > 1) return "blowup";
  return k > 0 ? "smooth" : "overshoot";
}

export const DESCRIPTIONS: Record<Behaviour, string> = {
  straight: "It lands exactly on the bottom in one step.",
  smooth: "It slides steadily down toward the bottom, taking smaller steps as the slope flattens.",
  overshoot: "It jumps past the bottom each time, but swings back closer, so it settles in the end.",
  bounce: "It leaps from one side of the bowl to the other and never settles.",
  blowup: "Each step overshoots by more than the last. It flies off and never settles.",
};
