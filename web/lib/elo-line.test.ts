import { describe, expect, it } from "vitest";
import { eloLinePoints } from "@/lib/elo-line";

describe("eloLinePoints", () => {
  it("spans the width and puts the highest value at the top", () => {
    expect(eloLinePoints([1000, 1100, 1050], 600, 120, 10)).toBe("0,110 300,10 600,60");
  });
  it("draws a flat line through the middle when nothing changed", () => {
    expect(eloLinePoints([1000, 1000], 600, 120, 10)).toBe("0,60 600,60");
  });
  it("returns nothing for no data", () => {
    expect(eloLinePoints([], 600, 120)).toBe("");
  });
});
