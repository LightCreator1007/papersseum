import { describe, expect, it } from "vitest";
import { FRESH, REST, STUDY, TIRED, improvements, qValues, values, type Policy } from "@/features/learn/student";

const g = 0.9;
const near = (a: number, b: number, tol = 0.006) => expect(Math.abs(a - b)).toBeLessThan(tol);

describe("the student's evening", () => {
  it("matches the values worked out in the lesson for all four policies", () => {
    const cases: [Policy, number, number][] = [
      [[STUDY, STUDY], 15.94, 12.03],
      [[STUDY, REST], 20.09, 17.34],
      [[REST, STUDY], 8.78, 7.43],
      [[REST, REST], 8.9, 7.68],
    ];
    for (const [pol, vf, vt] of cases) {
      const v = values(pol, g);
      near(v[0], vf);
      near(v[1], vt);
    }
  });

  it("the values satisfy the Bellman equation", () => {
    const pol: Policy = [STUDY, REST];
    const v = values(pol, g);
    // V(Fresh) = 3 + 0.9 (0.6 V(Fresh) + 0.4 V(Tired))
    expect(v[FRESH]).toBeCloseTo(3 + g * (0.6 * v[FRESH] + 0.4 * v[TIRED]), 9);
    // V(Tired) = 0 + 0.9 (0.7 V(Fresh) + 0.3 V(Tired))
    expect(v[TIRED]).toBeCloseTo(g * (0.7 * v[FRESH] + 0.3 * v[TIRED]), 9);
  });

  it("gamma = 0 values are just the immediate rewards", () => {
    const v = values([STUDY, REST], 0);
    expect(v[0]).toBeCloseTo(3, 12);
    expect(v[1]).toBeCloseTo(0, 12);
  });

  it("Q-values under the best policy match the lesson, and nothing improves it", () => {
    const pol: Policy = [STUDY, REST];
    const q = qValues(values(pol, g), g);
    near(q[FRESH][STUDY], 20.09);
    near(q[FRESH][REST], 18.83);
    near(q[TIRED][STUDY], 16.6);
    near(q[TIRED][REST], 17.34);
    expect(improvements(pol, q)).toEqual([]);
  });

  it("a weaker policy can be improved, in the right states", () => {
    const pol: Policy = [STUDY, STUDY];
    const imp = improvements(pol, qValues(values(pol, g), g));
    expect(imp).toEqual([{ state: TIRED, better: REST }]);
  });

  it("with no patience (gamma = 0) always studying is already best", () => {
    const pol: Policy = [STUDY, STUDY];
    expect(improvements(pol, qValues(values(pol, 0), 0))).toEqual([]);
  });
});
