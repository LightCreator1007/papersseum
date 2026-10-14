import { describe, expect, it } from "vitest";
import { BEST, gradLogProb, makeLearner, probabilities, pullOnce, softmax } from "./policybandit";

describe("policy nudge", () => {
  it("softmax gives probabilities that add to 1", () => {
    const p = softmax([0.3, -1.2, 2]);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(softmax([0, 0, 0]).every((v) => Math.abs(v - 1 / 3) < 1e-12)).toBe(true);
  });

  it("the slope of ln(probability) is one-hot minus the probabilities (checked by brute force)", () => {
    const scores = [0.4, -0.7, 1.1];
    const h = 1e-6;
    for (const action of [0, 1, 2]) {
      const g = gradLogProb(scores, action);
      for (let k = 0; k < 3; k++) {
        const up = [...scores];
        const down = [...scores];
        up[k] += h;
        down[k] -= h;
        const numeric = (Math.log(softmax(up)[action]) - Math.log(softmax(down)[action])) / (2 * h);
        expect(numeric).toBeCloseTo(g[k], 6);
      }
    }
  });

  it("the worked example in the lesson: scores 0, pulled machine 2, reward 1, alpha 0.5", () => {
    const g = gradLogProb([0, 0, 0], 1);
    const scores = g.map((v) => 0.5 * 1 * v);
    expect(scores[0]).toBeCloseTo(-1 / 6, 12);
    expect(scores[1]).toBeCloseTo(1 / 3, 12);
    const p = softmax(scores);
    expect([p[0], p[1], p[2]].map((v) => Number(v.toFixed(4)))).toEqual([0.2741, 0.4519, 0.2741]);
  });

  it("with no bonus, learning finds the best machine", () => {
    let good = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const l = makeLearner(seed);
      for (let i = 0; i < 300; i++) pullOnce(l);
      if (probabilities(l)[BEST] > 0.8) good++;
    }
    expect(good / 60).toBeGreaterThan(0.85);
  });

  it("a big bonus on every reward breaks the learner without a baseline, but a baseline is immune", () => {
    const success = (useBaseline: boolean) => {
      let good = 0;
      for (let seed = 1; seed <= 100; seed++) {
        const l = makeLearner(seed, { shift: 10, useBaseline });
        for (let i = 0; i < 300; i++) pullOnce(l);
        if (probabilities(l)[BEST] > 0.8) good++;
      }
      return good / 100;
    };
    expect(success(true)).toBeGreaterThan(0.85);
    expect(success(false)).toBeLessThan(0.6);
  });

  it("is deterministic for a seed", () => {
    const a = makeLearner(5);
    const b = makeLearner(5);
    for (let i = 0; i < 20; i++) expect(pullOnce(a)).toEqual(pullOnce(b));
  });
});
