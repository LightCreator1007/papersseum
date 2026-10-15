import { describe, expect, it } from "vitest";
import { GOAL, START, backup, greedyMove, land, outcomes, solve, sweep, zeros } from "./gridworld";

describe("grid world", () => {
  it("walls and edges leave you where you are", () => {
    expect(land([2, 0], "left")).toEqual([2, 0]);
    expect(land([2, 0], "down")).toEqual([2, 0]);
    expect(land([1, 0], "right")).toEqual([1, 0]); // the wall at [1, 1]
    expect(land([2, 0], "up")).toEqual([1, 0]);
  });

  it("slipping splits the move across the sides, and the chances add up to 1", () => {
    const o = outcomes([2, 1], "up", 0.2);
    expect(o.reduce((s, x) => s + x.p, 0)).toBeCloseTo(1, 12);
    expect(o.map((x) => x.p)).toEqual([0.8, 0.1, 0.1]);
    expect(outcomes([2, 1], "up", 0)).toHaveLength(1);
  });

  it("the first sweep only sees the rewards next to the goal and pit", () => {
    const { values } = sweep(zeros(), 0.9, 0);
    expect(values[0][2]).toBeCloseTo(1, 12); // one step from the goal
    expect(values[2][0]).toBeCloseTo(-0.04, 12);
    expect(values[1][2]).toBeCloseTo(-0.04, 12);
  });

  it("matches the Python results without slipping", () => {
    const { values, sweeps } = solve(0.9, 0);
    expect(sweeps).toBe(6);
    expect(values[0][0]).toBeCloseTo(0.734, 3);
    expect(values[0][1]).toBeCloseTo(0.86, 3);
    expect(values[0][2]).toBeCloseTo(1.0, 3);
    expect(values[START[0]][START[1]]).toBeCloseTo(0.519, 3);
    expect(greedyMove(values, START, 0.9, 0)).toBe("up");
  });

  it("matches the Python results with slipping, and values drop", () => {
    const { values, sweeps } = solve(0.9, 0.2);
    expect(sweeps).toBe(29);
    expect(values[START[0]][START[1]]).toBeCloseTo(0.374, 3);
    expect(values[2][3]).toBeCloseTo(0.189, 3);
    expect(greedyMove(values, [2, 3], 0.9, 0.2)).toBe("left"); // away from the pit
  });

  it("the settled values satisfy the Bellman optimality equation", () => {
    const { values } = solve(0.9, 0.2);
    const { values: again, change } = sweep(values, 0.9, 0.2);
    expect(change).toBeLessThan(1e-8);
    expect(again[2][2]).toBeCloseTo(values[2][2], 8);
    expect(backup(values, [2, 2], "up", 0.9, 0.2)).toBeCloseTo(values[2][2], 8);
    expect(values[GOAL[0]][GOAL[1]]).toBe(0);
  });
});
