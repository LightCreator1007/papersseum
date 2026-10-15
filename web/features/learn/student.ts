// The student's evening (chapters 4 to 6): two conditions, two actions, and the exact value of a policy.
// Plain functions so the maths is testable and matches the Python in resources/chapters/05-value-functions.

export const FRESH = 0;
export const TIRED = 1;
export const STUDY = 0;
export const REST = 1;
export const STATE_NAMES = ["Fresh", "Tired"] as const;
export const ACTION_NAMES = ["Study", "Rest"] as const;

// NEXT[state][action] = [chance of Fresh next, chance of Tired next]
export const NEXT: number[][][] = [
  [
    [0.6, 0.4], // Fresh, Study
    [0.9, 0.1], // Fresh, Rest
  ],
  [
    [0.2, 0.8], // Tired, Study
    [0.7, 0.3], // Tired, Rest
  ],
];
// REWARD[state][action]
export const REWARD: number[][] = [
  [3, 1],
  [0.5, 0],
];

export type Policy = [number, number]; // the action to take when Fresh, and when Tired

// Solve  V = r + gamma P V  for the two states, i.e. (I - gamma P) V = r, by Cramer's rule.
export function values(policy: Policy, gamma: number): [number, number] {
  const p = [NEXT[FRESH][policy[FRESH]], NEXT[TIRED][policy[TIRED]]];
  const r = [REWARD[FRESH][policy[FRESH]], REWARD[TIRED][policy[TIRED]]];
  const a = [
    [1 - gamma * p[0][0], -gamma * p[0][1]],
    [-gamma * p[1][0], 1 - gamma * p[1][1]],
  ];
  const det = a[0][0] * a[1][1] - a[0][1] * a[1][0];
  return [(r[0] * a[1][1] - a[0][1] * r[1]) / det, (a[0][0] * r[1] - r[0] * a[1][0]) / det];
}

// Q[state][action]: take that action now, then follow the policy that produced v.
export function qValues(v: [number, number], gamma: number): number[][] {
  return [FRESH, TIRED].map((s) => [STUDY, REST].map((a) => REWARD[s][a] + gamma * (NEXT[s][a][0] * v[0] + NEXT[s][a][1] * v[1])));
}

// The states where some other action has a clearly higher Q than the one the policy takes.
export function improvements(policy: Policy, q: number[][], eps = 1e-9): { state: number; better: number }[] {
  const out: { state: number; better: number }[] = [];
  for (const s of [FRESH, TIRED]) {
    const other = 1 - policy[s];
    if (q[s][other] > q[s][policy[s]] + eps) out.push({ state: s, better: other });
  }
  return out;
}
