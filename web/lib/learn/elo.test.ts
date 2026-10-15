import { describe, expect, it } from "vitest";
import { expectedScore, update } from "./elo";

describe("elo", () => {
  it("matches the lesson's worked example (1000 against 1200, K = 32)", () => {
    expect(expectedScore(1000, 1200)).toBeCloseTo(0.2403, 4);
    expect(expectedScore(1200, 1000)).toBeCloseTo(0.7597, 4);
    const win = update(1000, 1200, 1);
    expect(win[0]).toBeCloseTo(1024.31, 2);
    expect(win[1]).toBeCloseTo(1175.69, 2);
    const lose = update(1000, 1200, 0);
    expect(lose[0]).toBeCloseTo(992.31, 2);
  });

  it("equal ratings are a coin flip, and the two expected scores always add to 1", () => {
    expect(expectedScore(1500, 1500)).toBe(0.5);
    for (const [a, b] of [[1000, 1400], [1800, 900], [1234, 1250]]) expect(expectedScore(a, b) + expectedScore(b, a)).toBeCloseTo(1, 12);
  });

  it("the favourite wins more often as the gap grows", () => {
    const wins = [0, 100, 200, 400, 800].map((g) => Number(expectedScore(g, 0).toFixed(3)));
    expect(wins).toEqual([0.5, 0.64, 0.76, 0.909, 0.99]);
  });

  it("an update moves points between the players without creating any", () => {
    for (const score of [0, 0.5, 1]) {
      const [a, b] = update(1100, 1300, score, 24);
      expect(a - 1100 + (b - 1300)).toBeCloseTo(0, 12);
    }
  });
});
