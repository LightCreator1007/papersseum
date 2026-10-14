// Chapter 4's "Discount Playground": a stream of rewards, one per step, and what it is worth now
// once each later reward is multiplied by gamma for every step it is away.

export type Stream = { id: string; label: string; rewards: number[] };

// Both streams last 10 steps. "Big prize at the end" pays nothing until the last step.
export const STREAMS: Stream[] = [
  { id: "steady", label: "A little every step", rewards: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
  { id: "prize", label: "Nothing, then a big prize at the end", rewards: [0, 0, 0, 0, 0, 0, 0, 0, 0, 15] },
];

// The weight a reward k steps from now gets: gamma^k (step 0 is "now", so it counts in full).
export function weights(gamma: number, steps: number): number[] {
  return Array.from({ length: steps }, (_, k) => gamma ** k);
}

// Each reward after discounting.
export function discounted(rewards: number[], gamma: number): number[] {
  return rewards.map((r, k) => r * gamma ** k);
}

// The return: the discounted rewards added up.
export function totalReturn(rewards: number[], gamma: number): number {
  return discounted(rewards, gamma).reduce((a, b) => a + b, 0);
}

// The gamma at which the two streams are worth exactly the same (found by bisection),
// or null if one stream is better for every gamma in (0, 1).
export function breakEvenGamma(a: number[], b: number[], lo = 0.001, hi = 0.999): number | null {
  const diff = (g: number) => totalReturn(a, g) - totalReturn(b, g);
  if (diff(lo) * diff(hi) > 0) return null;
  let l = lo;
  let h = hi;
  for (let i = 0; i < 80; i++) {
    const mid = (l + h) / 2;
    if (diff(l) * diff(mid) <= 0) h = mid;
    else l = mid;
  }
  return (l + h) / 2;
}
