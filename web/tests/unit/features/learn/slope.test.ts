import { describe, expect, it } from "vitest";
import { FUNCTIONS, isFlat, sample, tangent, yRange } from "@/features/learn/slope";

describe("slope explorer", () => {
  it("each hand-worked derivative matches a numerical slope", () => {
    const h = 1e-5;
    for (const fn of FUNCTIONS) {
      for (const { x } of sample(fn, 40)) {
        const numeric = (fn.f(x + h) - fn.f(x - h)) / (2 * h);
        expect(Math.abs(numeric - fn.df(x))).toBeLessThan(1e-6);
      }
    }
  });

  it("the slope is zero exactly where the lowest and highest points are", () => {
    for (const fn of FUNCTIONS) for (const x of fn.flats) expect(Math.abs(fn.df(x))).toBeLessThan(1e-9);
    expect(FUNCTIONS[0].f(2)).toBe(1); // the parabola's lowest point
    expect(FUNCTIONS[1].f(3)).toBeCloseTo(-5, 12);
    expect(FUNCTIONS[1].f(-1)).toBeCloseTo(17 / 3, 12);
  });

  it("the tangent passes through the point and has the slope of the curve", () => {
    const fn = FUNCTIONS[0];
    const t = tangent(fn, 3);
    expect((t.y2 - t.y1) / (t.x2 - t.x1)).toBeCloseTo(2, 12);
    expect(t.y1 + (2 * (3 - t.x1))).toBeCloseTo(fn.f(3), 12);
  });

  it("flat detection and the plotting range behave", () => {
    expect(isFlat(0.01)).toBe(true);
    expect(isFlat(-1)).toBe(false);
    for (const fn of FUNCTIONS) {
      const { lo, hi } = yRange(fn);
      for (const { y } of sample(fn)) {
        expect(y).toBeGreaterThanOrEqual(lo);
        expect(y).toBeLessThanOrEqual(hi);
      }
    }
  });
});
