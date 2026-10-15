import { describe, expect, it } from "vitest";
import { STREAMS, breakEvenGamma, discounted, totalReturn, weights } from "@/features/learn/discount";

describe("discount playground", () => {
  it("each step away multiplies the weight by gamma", () => {
    expect(weights(0.9, 4)).toEqual([1, 0.9, 0.9 ** 2, 0.9 ** 3]);
    expect(weights(0.5, 3)).toEqual([1, 0.5, 0.25]);
  });

  it("matches the worked examples in the lesson", () => {
    // 1, 0, 0, 5 at gamma = 0.9  ->  1 + 0 + 0 + 0.729 * 5 = 4.645
    expect(totalReturn([1, 0, 0, 5], 0.9)).toBeCloseTo(4.645, 12);
    // ten steady rewards of 1 at gamma = 0.9 -> (1 - 0.9^10) / (1 - 0.9) = 6.5132...
    expect(totalReturn(STREAMS[0].rewards, 0.9)).toBeCloseTo((1 - 0.9 ** 10) / 0.1, 12);
    expect(discounted([2, 2], 0.5)).toEqual([2, 1]);
  });

  it("gamma = 1 is just the plain total, gamma = 0 only counts the first reward", () => {
    expect(totalReturn([1, 2, 3], 1)).toBe(6);
    expect(totalReturn([1, 2, 3], 0)).toBe(1);
  });

  it("a patient agent prefers the prize and an impatient one the steady trickle", () => {
    const [steady, prize] = STREAMS;
    expect(totalReturn(steady.rewards, 0.5)).toBeGreaterThan(totalReturn(prize.rewards, 0.5));
    expect(totalReturn(prize.rewards, 0.95)).toBeGreaterThan(totalReturn(steady.rewards, 0.95));
  });

  it("finds the break-even gamma where the two are worth the same", () => {
    const [steady, prize] = STREAMS;
    const g = breakEvenGamma(steady.rewards, prize.rewards)!;
    expect(g).toBeGreaterThan(0.5);
    expect(g).toBeLessThan(0.95);
    expect(Math.abs(totalReturn(steady.rewards, g) - totalReturn(prize.rewards, g))).toBeLessThan(1e-9);
    expect(breakEvenGamma([1, 1], [0, 0])).toBeNull();
  });
});
