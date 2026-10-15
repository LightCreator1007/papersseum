import { describe, expect, it } from "vitest";
import { BIASED, PAYOFF, averageStrategy, makeGame, play, probsA } from "@/features/learn/rps";

describe("rock-paper-scissors learners", () => {
  it("paper beats rock, scissors beats paper, rock beats scissors", () => {
    expect(PAYOFF[1][0]).toBe(1);
    expect(PAYOFF[2][1]).toBe(1);
    expect(PAYOFF[0][2]).toBe(1);
    expect(PAYOFF[0][1]).toBe(-1);
  });

  it("against a bot that favours rock, paper earns the most (0.25), rock 0, scissors -0.25", () => {
    const earns = PAYOFF.map((row) => row.reduce((s, v, b) => s + v * BIASED[b], 0));
    expect(earns).toEqual([0, 0.25, -0.25]);
  });

  it("a learner against that bot finds paper", () => {
    let found = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const g = makeGame("biased", seed, 0.05);
      play(g, 3000);
      if (probsA(g)[1] > 0.95) found++;
    }
    expect(found).toBeGreaterThanOrEqual(9);
  });

  it("two learners keep swinging, but their long-run average stays near one third each", () => {
    let swingy = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const g = makeGame("both", seed, 0.02);
      play(g, 20000);
      const late = g.history.slice(-250).map((h) => h.a); // the last 5,000 rounds
      if (Math.max(...late) - Math.min(...late) > 0.3) swingy++;
      const avg = averageStrategy(g.sumA, g.rounds);
      expect(Math.max(...avg.map((v) => Math.abs(v - 1 / 3)))).toBeLessThan(0.08);
    }
    expect(swingy).toBeGreaterThanOrEqual(8);
  });

  it("is deterministic for a seed", () => {
    const a = makeGame("both", 4);
    const b = makeGame("both", 4);
    play(a, 500);
    play(b, 500);
    expect(a.scoresA).toEqual(b.scoresA);
  });
});
