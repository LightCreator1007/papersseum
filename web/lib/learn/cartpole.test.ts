import { describe, expect, it } from "vitest";
import { mulberry32 } from "./bandit";
import { ANGLE_LIMIT, MAX_STEPS, episodeLength, qValues, reset, step, trainedAction, type State } from "./cartpole";

describe("cart-pole", () => {
  it("matches the Python physics, equation for equation (50 fixed pushes from a fixed start)", () => {
    const pushes = Array.from({ length: 50 }, (_, i) => [1, 1, 0, 1, 0, 0, 1, 1, 1, 0][i % 10]);
    let s: State = [0.01, 0, 0.02, 0];
    const seen: Record<number, State> = {};
    pushes.forEach((a, i) => {
      s = step(s, a).state;
      seen[i + 1] = s;
    });
    const expected: Record<number, State> = {
      1: [0.01, 0.194829496866, 0.02, -0.286306190391],
      10: [0.060654189658, 0.39106635848, -0.054401943527, -0.604218633413],
      25: [0.294516210738, 1.008249614784, -0.495258846713, -2.451187558393],
      50: [0.980022002531, 1.441318893936, -3.24608048022, -8.266590418072],
    };
    for (const k of [1, 10, 25, 50]) seen[k].forEach((v, i) => expect(v).toBeCloseTo(expected[k][i], 9));
  });

  it("a pole tilted past 12 degrees, or a cart off the track, counts as fallen", () => {
    expect(step([0, 0, 0.3, 0], 0).fell).toBe(true);
    expect(step([2.5, 0, 0, 0], 1).fell).toBe(true);
    expect(step([0, 0, ANGLE_LIMIT / 2, 0], 0).fell).toBe(false);
  });

  it("a pole that is left alone falls over quickly", () => {
    const rng = mulberry32(1);
    let total = 0;
    for (let i = 0; i < 30; i++) total += episodeLength(() => 0, rng); // always push left
    expect(total / 30).toBeLessThan(15);
  });

  it("random pushes survive about as long as the Python's random agent (roughly 20 steps)", () => {
    const rng = mulberry32(7);
    const coin = mulberry32(8);
    let total = 0;
    const n = 300;
    for (let i = 0; i < n; i++) total += episodeLength(() => (coin() < 0.5 ? 0 : 1), rng);
    expect(total / n).toBeGreaterThan(15);
    expect(total / n).toBeLessThan(35);
  });

  it("the trained network balances the pole for the full 200 steps, every time", () => {
    const rng = mulberry32(2024);
    for (let i = 0; i < 40; i++) expect(episodeLength(trainedAction, rng)).toBe(MAX_STEPS);
  });

  it("the network gives two finite Q-values", () => {
    const q = qValues(reset(mulberry32(3)));
    expect(q).toHaveLength(2);
    expect(q.every(Number.isFinite)).toBe(true);
  });
});
