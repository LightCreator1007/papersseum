import { describe, expect, it } from "vitest";
import { GOAL, START } from "@/features/learn/gridworld";
import { bestMove, cellValue, learnFrom, makeLearner, playEpisode, returnsOf, runEpisode, snapshot, worldStep, type Step } from "@/features/learn/montecarlo";

describe("monte carlo on the grid", () => {
  it("returns are worked out backwards from the end, like the lesson's example", () => {
    const steps: Step[] = [
      { cell: [2, 0], move: "up", reward: -0.04 },
      { cell: [1, 0], move: "up", reward: -0.04 },
      { cell: [0, 0], move: "right", reward: -0.04 },
      { cell: [0, 1], move: "right", reward: -0.04 },
      { cell: [0, 2], move: "right", reward: 1 },
    ];
    const g = returnsOf(steps, 0.9).map((x) => Number(x.toFixed(3)));
    expect(g).toEqual([0.519, 0.621, 0.734, 0.86, 1]);
  });

  it("every episode ends, and the world never reports an impossible cell", () => {
    const l = makeLearner(3, { epsilon: 0.5 });
    for (let i = 0; i < 200; i++) {
      const h = playEpisode(l);
      expect(h.length).toBeGreaterThan(0);
      expect(h.length).toBeLessThan(500);
    }
    const out = worldStep([0, 2], "right", 0, l.rng);
    expect(out.done).toBe(true);
    expect(out.reward).toBe(1);
    expect(out.next).toEqual(GOAL);
  });

  it("only the first visit to a (cell, move) updates its estimate", () => {
    const l = makeLearner(1);
    const loop: Step[] = [
      { cell: [2, 0], move: "up", reward: 0 },
      { cell: [2, 0], move: "up", reward: 1 },
    ];
    learnFrom(l, loop);
    // first visit's return = 0 + 0.9 * 1 = 0.9; estimate moves 10% of the way: 0.09 (not twice)
    expect(l.q[2][0][0]).toBeCloseTo(0.09, 12);
    expect(l.episodes).toBe(1);
  });

  it("learns the route to the goal from played episodes alone", () => {
    let good = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const l = makeLearner(seed, { epsilon: 0.1 });
      for (let i = 0; i < 3000; i++) runEpisode(l);
      l.epsilon = 0; // judge what it learned, not its exploring
      if (bestMove(l, [0, 0]) === "right" && bestMove(l, [0, 1]) === "right" && bestMove(l, [0, 2]) === "right") good++;
      expect(cellValue(l, [0, 2])).toBeGreaterThan(0.9);
      expect(cellValue(l, START)).toBeGreaterThan(0.2);
    }
    expect(good).toBe(5);
  });

  it("is deterministic for a seed", () => {
    const a = makeLearner(7);
    const b = makeLearner(7);
    for (let i = 0; i < 20; i++) expect(runEpisode(a)).toEqual(runEpisode(b));
  });

  it("a snapshot is plain data that does not disturb the random stream", () => {
    const a = makeLearner(11);
    const b = makeLearner(11);
    for (let i = 0; i < 5; i++) {
      runEpisode(a);
      runEpisode(b);
    }
    const snap = snapshot(a);
    expect(snap.episodes).toBe(5);
    expect(snap.moves[0][3]).toBeNull(); // the goal
    expect(snap.moves[1][1]).toBeNull(); // the wall
    expect(snap.values[0][2]).toBeGreaterThanOrEqual(0);
    expect(snapshot(makeLearner(1)).moves.flat().every((m) => m === null)).toBe(true);
    expect(runEpisode(a)).toEqual(runEpisode(b)); // reading the snapshot changed nothing
  });

  it("exploring helps: more fresh agents learn the top-row route (the numbers quoted in the lesson)", () => {
    const learnedTopRow = (epsilon: number) => {
      let count = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const l = makeLearner(seed, { epsilon });
        for (let i = 0; i < 1000; i++) runEpisode(l);
        const m = snapshot(l).moves;
        if (m[0][0] === "right" && m[0][1] === "right" && m[0][2] === "right") count++;
      }
      return count;
    };
    expect(learnedTopRow(0)).toBe(12);
    expect(learnedTopRow(0.1)).toBe(18);
  });
});
