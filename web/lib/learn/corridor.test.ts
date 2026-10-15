import { describe, expect, it } from "vitest";
import { expectedRandomSteps, makeLearner, move, preferences, runEpisode } from "./corridor";

describe("cheese hunt", () => {
  it("walls stop the walker", () => {
    expect(move(8, 0, 0)).toBe(0);
    expect(move(8, 3, 1)).toBe(4);
    expect(move(8, 7, 1)).toBe(7);
  });

  it("an untrained wanderer takes about cells * (cells - 1) steps, as the maths says", () => {
    const cells = 8;
    let total = 0;
    const runs = 1000;
    for (let i = 0; i < runs; i++) {
      const l = makeLearner(cells, 1000 + i, { alpha: 0, epsilon: 1 }); // never learns, always random
      total += runEpisode(l, 10_000).steps;
    }
    expect(expectedRandomSteps(cells)).toBe(56);
    expect(total / runs).toBeGreaterThan(46);
    expect(total / runs).toBeLessThan(68);
  });

  it("learning makes the trips shorter and ends with the right directions", () => {
    const l = makeLearner(8, 3);
    const steps: number[] = [];
    for (let i = 0; i < 60; i++) steps.push(runEpisode(l).steps);
    const early = steps.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const late = steps.slice(-10).reduce((a, b) => a + b, 0) / 10;
    expect(late).toBeLessThan(early);
    expect(late).toBeLessThan(15); // the shortest possible trip is 7 steps; a little exploring adds some
    expect(preferences(l)).toEqual(Array(7).fill("→"));
  });

  it("is deterministic for a seed", () => {
    const a = makeLearner(8, 9);
    const b = makeLearner(8, 9);
    for (let i = 0; i < 10; i++) expect(runEpisode(a).steps).toBe(runEpisode(b).steps);
  });
});
