// Chapter 0's "Cheese Hunt": a one-dimensional corridor with the cheese at the far end.
// The agent learns with Q-learning (chapter 8 explains it properly). Plain functions and a
// seeded random generator, so the same seed always plays out the same way, and it is testable.

import { mulberry32, type Rng } from "./bandit";

export const LEFT = 0;
export const RIGHT = 1;

export type Learner = {
  cells: number; // the corridor has cells 0 .. cells-1; the cheese is in the last one
  q: number[][]; // q[cell][action]: how good each move looks from each cell
  alpha: number; // how far one experience moves an estimate
  gamma: number; // how much a reward one step later is worth
  epsilon: number; // how often to try a random move
  rng: Rng;
};

export function makeLearner(cells = 8, seed = 1, opts: Partial<Pick<Learner, "alpha" | "gamma" | "epsilon">> = {}): Learner {
  return {
    cells,
    q: Array.from({ length: cells }, () => [0, 0]),
    alpha: opts.alpha ?? 0.5,
    gamma: opts.gamma ?? 0.9,
    epsilon: opts.epsilon ?? 0.2,
    rng: mulberry32(seed),
  };
}

function bestMove(l: Learner, cell: number): number {
  const [left, right] = l.q[cell];
  if (left === right) return l.rng() < 0.5 ? LEFT : RIGHT; // no preference yet: flip a coin
  return right > left ? RIGHT : LEFT;
}

export function chooseMove(l: Learner, cell: number): number {
  return l.rng() < l.epsilon ? (l.rng() < 0.5 ? LEFT : RIGHT) : bestMove(l, cell);
}

// Moving left from cell 0 bumps the wall and stays put.
export function move(cells: number, cell: number, action: number): number {
  return Math.min(cells - 1, Math.max(0, cell + (action === RIGHT ? 1 : -1)));
}

// One attempt from cell 0 until the cheese is found (or maxSteps runs out).
export function runEpisode(l: Learner, maxSteps = 500): { steps: number; found: boolean } {
  let cell = 0;
  for (let step = 1; step <= maxSteps; step++) {
    const action = chooseMove(l, cell);
    const next = move(l.cells, cell, action);
    const done = next === l.cells - 1;
    const reward = done ? 1 : 0;
    // new estimate = old estimate + step size * (target - old estimate)
    const target = reward + (done ? 0 : l.gamma * Math.max(...l.q[next]));
    l.q[cell][action] += l.alpha * (target - l.q[cell][action]);
    if (done) return { steps: step, found: true };
    cell = next;
  }
  return { steps: maxSteps, found: false };
}

// What the learner currently prefers in each cell: "→", "←", or "·" if it has no idea yet.
export function preferences(l: Learner): string[] {
  return l.q.slice(0, -1).map(([left, right]) => (left === right ? "·" : right > left ? "→" : "←"));
}

// Average number of steps a blind random walker needs to reach the cheese. Bumping the left
// wall costs a step without moving, which makes it cells * (cells - 1): 8 cells -> 56.
export function expectedRandomSteps(cells: number): number {
  return cells * (cells - 1);
}
