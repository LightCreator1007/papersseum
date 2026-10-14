// Chapter 12's "Policy nudge": the policy-gradient idea on three slot machines. Mirrors
// resources/chapters/12-policy-gradients/code/bandit_policy.py (the random streams differ, the algorithm does not).
//
// The policy is three scores; the softmax turns them into probabilities. After each pull:
//   score_k  <-  score_k + alpha * (reward - baseline) * ( [k was pulled] - probability of k )

import { mulberry32, type Rng } from "./bandit";

export const CHANCES = [0.2, 0.5, 0.8];
export const BEST = 2;

export function softmax(scores: number[]): number[] {
  const m = Math.max(...scores);
  const e = scores.map((s) => Math.exp(s - m));
  const total = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / total);
}

// The slope of ln(probability of `action`) with respect to each score: one-hot(action) - probabilities.
export function gradLogProb(scores: number[], action: number): number[] {
  const p = softmax(scores);
  return p.map((v, k) => (k === action ? 1 : 0) - v);
}

export type Learner = {
  scores: number[];
  average: number; // the running average reward, used as the baseline
  pulls: number;
  alpha: number;
  shift: number; // a fixed bonus added to every reward
  useBaseline: boolean;
  rng: Rng;
};

export function makeLearner(seed = 1, opts: Partial<Pick<Learner, "alpha" | "shift" | "useBaseline">> = {}): Learner {
  return { scores: [0, 0, 0], average: 0, pulls: 0, alpha: opts.alpha ?? 0.1, shift: opts.shift ?? 0, useBaseline: opts.useBaseline ?? true, rng: mulberry32(seed) };
}

// Choose a machine with the policy's probabilities, pull it, and nudge the scores.
export function pullOnce(l: Learner): { action: number; reward: number } {
  const probs = softmax(l.scores);
  const draw = l.rng();
  let action = 0;
  let cum = probs[0];
  while (draw >= cum && action < probs.length - 1) cum += probs[++action];
  const reward = (l.rng() < CHANCES[action] ? 1 : 0) + l.shift;
  const baseline = l.useBaseline ? l.average : 0;
  const g = gradLogProb(l.scores, action);
  l.scores = l.scores.map((s, k) => s + l.alpha * (reward - baseline) * g[k]);
  l.pulls += 1;
  l.average += (reward - l.average) / l.pulls; // running average (chapter 3's update)
  return { action, reward };
}

export function probabilities(l: Learner): number[] {
  return softmax(l.scores);
}
