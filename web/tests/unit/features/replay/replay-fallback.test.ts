import { describe, expect, it } from "vitest";
import { finalBoard } from "@/features/replay/replay-fallback";

const seat = (slot: number, placement: number | null, coverage: number | null, name: string | null = `bot${slot}`) => ({
  slot, name, placement, coverage,
});

describe("finalBoard", () => {
  it("is null with no seats or no recorded coverage", () => {
    expect(finalBoard(undefined)).toBeNull();
    expect(finalBoard([])).toBeNull();
    expect(finalBoard([seat(0, null, null), seat(1, null, null)])).toBeNull();
  });

  it("orders by placement and leaves the rest unclaimed", () => {
    const b = finalBoard([seat(0, 2, 20), seat(1, 1, 30), seat(2, 3, 10), seat(3, 4, 5), seat(4, 5, 0)])!;
    expect(b.shares.map((s) => s.slot)).toEqual([1, 0, 2, 3, 4]);
    expect(b.shares.map((s) => s.width)).toEqual([30, 20, 10, 5, 0]);
    expect(b.unclaimed).toBe(35);
  });

  it("names a deleted bot and keeps an unknown coverage blank", () => {
    const b = finalBoard([seat(0, 1, 50, null), seat(1, null, null)])!;
    expect(b.shares[0].name).toBe("deleted bot");
    expect(b.shares[1]).toMatchObject({ coverage: null, width: 0 });
  });

  it("scales the bar, not the labels, when coverages add to over 100", () => {
    const b = finalBoard([seat(0, 1, 80), seat(1, 2, 40)])!;
    expect(b.shares.map((s) => s.coverage)).toEqual([80, 40]);
    expect(b.shares[0].width + b.shares[1].width).toBeCloseTo(100);
    expect(b.unclaimed).toBe(0);
  });

  it("clamps out-of-range and non-finite coverage", () => {
    const b = finalBoard([seat(0, 1, -5), seat(1, 2, Number.NaN), seat(2, 3, 150)])!;
    expect(b.shares.map((s) => s.coverage)).toEqual([0, null, 100]);
    expect(b.unclaimed).toBe(0);
  });
});
