import { describe, expect, it } from "vitest";
import { START, greedyRoute, makeLearner, recentAverage, runEpisode, snapshot, step } from "./cliff";

function train(method: "qlearning" | "sarsa", seed: number, episodes = 500) {
  const l = makeLearner(method, seed);
  for (let i = 0; i < episodes; i++) runEpisode(l);
  return l;
}

describe("cliff walking", () => {
  it("the cliff sends you back to the start and costs 100; every other step costs 1", () => {
    expect(step([2, 3], "down")).toEqual({ reward: -100, next: START, done: false });
    expect(step([3, 0], "right")).toEqual({ reward: -100, next: START, done: false });
    expect(step([2, 3], "right")).toEqual({ reward: -1, next: [2, 4], done: false });
    expect(step([2, 7], "down")).toEqual({ reward: -1, next: [3, 7], done: true });
    expect(step([3, 0], "left")).toEqual({ reward: -1, next: [3, 0], done: false }); // the edge stops you
  });

  it("Q-learning always finds the shortest route, right along the cliff edge (9 steps)", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { route, reachedGoal } = greedyRoute(train("qlearning", seed));
      expect(reachedGoal).toBe(true);
      expect(route.length - 1).toBe(9);
      expect(route.some(([r, c]) => r === 2 && c === 3)).toBe(true); // it runs along row 2, beside the cliff
    }
  });

  it("SARSA learns a longer, safer route that stays away from the edge", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { route, reachedGoal } = greedyRoute(train("sarsa", seed));
      expect(reachedGoal).toBe(true);
      expect(route.length - 1).toBeGreaterThan(9);
      expect(route.some(([r, c]) => r === 2 && c === 3)).toBe(false);
    }
  });

  it("while exploring, SARSA scores better than Q-learning (it falls off the cliff less)", () => {
    let q = 0;
    let s = 0;
    const seeds = 10;
    for (let seed = 1; seed <= seeds; seed++) {
      q += recentAverage(train("qlearning", seed), 100)!;
      s += recentAverage(train("sarsa", seed), 100)!;
    }
    expect(s / seeds).toBeGreaterThan(q / seeds);
  });

  it("a snapshot is plain data and does not disturb the learner", () => {
    const a = train("qlearning", 3, 500);
    const b = train("qlearning", 3, 500);
    const snap = snapshot(a);
    expect(snap.episodes).toBe(500);
    expect(snap.moves[3][3]).toBeNull(); // cliff
    expect(snap.onRoute[3][0]).toBe(true); // the route starts at the start
    expect(snap.routeLength).toBe(9);
    expect(runEpisode(a)).toBe(runEpisode(b));
  });

  it("shows no route until the learner has one that reaches the goal", () => {
    const fresh = snapshot(makeLearner("qlearning", 1));
    expect(fresh.routeLength).toBeNull();
    expect(fresh.onRoute.flat().every((x) => x === false)).toBe(true);
  });

  it("is deterministic for a seed", () => {
    const a = makeLearner("sarsa", 8);
    const b = makeLearner("sarsa", 8);
    for (let i = 0; i < 20; i++) expect(runEpisode(a)).toBe(runEpisode(b));
  });
});
