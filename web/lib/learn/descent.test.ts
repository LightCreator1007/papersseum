import { describe, expect, it } from "vitest";
import { behaviour, f, factor, path, slope } from "./descent";

describe("gradient descent on a bowl", () => {
  it("the slope is 2 (w - 3), zero at the bottom", () => {
    expect(slope(3)).toBe(0);
    expect(slope(0)).toBe(-6);
    expect(f(3)).toBe(0);
  });

  it("matches the worked numbers in the lesson (alpha = 0.1, starting at 0)", () => {
    const p = path(0, 0.1, 10).map((x) => Number(x.toFixed(3)));
    expect(p.slice(0, 5)).toEqual([0, 0.6, 1.08, 1.464, 1.771]);
    expect(p[10]).toBe(2.678);
  });

  it("follows the closed form w_k = 3 + (w_0 - 3)(1 - 2 alpha)^k", () => {
    for (const alpha of [0.1, 0.5, 0.9, 1, 1.1]) {
      const p = path(0, alpha, 10);
      p.forEach((w, k) => expect(w).toBeCloseTo(3 - 3 * factor(alpha) ** k, 9));
    }
  });

  it("the step size alone decides what happens", () => {
    expect(behaviour(0.1)).toBe("smooth");
    expect(behaviour(0.5)).toBe("straight");
    expect(behaviour(0.9)).toBe("overshoot");
    expect(behaviour(1)).toBe("bounce");
    expect(behaviour(1.1)).toBe("blowup");
    expect(path(0, 0.5, 2)).toEqual([0, 3, 3]);
    expect(path(0, 1, 4)).toEqual([0, 6, 0, 6, 0]);
  });

  it("a too-big step size sends it further away every step", () => {
    const p = path(0, 1.1, 10);
    expect(Math.abs(p[10] - 3)).toBeGreaterThan(Math.abs(p[5] - 3));
    expect(p[10]).toBeCloseTo(-15.575, 3);
  });
});
