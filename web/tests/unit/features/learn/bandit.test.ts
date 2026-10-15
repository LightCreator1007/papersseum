import { describe, expect, it } from "vitest";
import { EpsilonGreedy, bestArm, makeProbabilities, mulberry32, pull, runAgent, runningMean } from "@/features/learn/bandit";

describe("bandit casino", () => {
  it("the generator is deterministic and stays in [0, 1)", () => {
    const a = mulberry32(5);
    const b = mulberry32(5);
    for (let i = 0; i < 50; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("machines have sensible probabilities and a clear best one", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const p = makeProbabilities(seed);
      expect(p).toHaveLength(5);
      expect(p.every((v) => v >= 0.15 && v <= 0.85)).toBe(true);
      const sorted = [...p].sort((x, y) => y - x);
      expect(sorted[0] - sorted[1]).toBeGreaterThanOrEqual(0.08 - 1e-9);
    }
  });

  it("pulling pays out about as often as the probability says", () => {
    const rng = mulberry32(1);
    let wins = 0;
    for (let i = 0; i < 20000; i++) wins += pull([0.3, 0.7], 1, rng);
    expect(wins / 20000).toBeGreaterThan(0.68);
    expect(wins / 20000).toBeLessThan(0.72);
  });

  it("the incremental update is the plain average of the rewards", () => {
    const agent = new EpsilonGreedy(1, 0, mulberry32(1));
    const rewards = [1, 0, 1, 1, 0];
    rewards.forEach((r) => agent.update(0, r));
    expect(agent.q[0]).toBeCloseTo(3 / 5, 12);
    expect(agent.n[0]).toBe(5);
  });

  it("with epsilon 0 it only ever repeats its first lucky machine; with epsilon 0.1 it finds the best", () => {
    let greedyFound = 0;
    let exploringFound = 0;
    const seeds = 40;
    for (let s = 1; s <= seeds; s++) {
      const probs = makeProbabilities(s);
      const best = bestArm(probs);
      const argmax = (xs: number[]) => xs.indexOf(Math.max(...xs));
      if (argmax(runAgent(probs, 0, 1000, s).counts) === best) greedyFound++;
      if (argmax(runAgent(probs, 0.1, 1000, s).counts) === best) exploringFound++;
    }
    expect(exploringFound).toBeGreaterThan(greedyFound);
    expect(exploringFound / seeds).toBeGreaterThan(0.8);
  });

  it("running mean ends at the overall mean", () => {
    const xs = [1, 0, 1, 1];
    const m = runningMean(xs);
    expect(m).toHaveLength(4);
    expect(m[3]).toBeCloseTo(0.75, 12);
  });
});
