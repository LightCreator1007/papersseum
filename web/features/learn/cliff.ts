// Chapter 8's "Q-learning lab": the cliff-walking world and the two learners that behave so differently in it.
// Mirrors resources/chapters/08-td-learning/code/cliff_walk.py (the random streams differ, the algorithms do not).
//
//   row 0:   .  .  .  .  .  .  .  .
//   row 1:   .  .  .  .  .  .  .  .
//   row 2:   .  .  .  .  .  .  .  .
//   row 3:   S  C  C  C  C  C  C  G        S = start, G = goal, C = the cliff

import { mulberry32, type Rng } from "./bandit";

export const ROWS = 4;
export const COLS = 8;
export type Cell = [number, number];
export const START: Cell = [3, 0];
export const GOAL: Cell = [3, 7];
export const isCliff = (c: Cell) => c[0] === 3 && c[1] >= 1 && c[1] <= 6;
export const isGoal = (c: Cell) => c[0] === GOAL[0] && c[1] === GOAL[1];

export const MOVES = ["up", "down", "left", "right"] as const;
export type Move = (typeof MOVES)[number];
export const ARROW: Record<Move, string> = { up: "↑", down: "↓", left: "←", right: "→" };
const DELTA: Record<Move, [number, number]> = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

export type Method = "qlearning" | "sarsa";

export type Learner = {
  method: Method;
  q: number[][][]; // q[row][col][move index]
  alpha: number;
  gamma: number;
  epsilon: number;
  rng: Rng;
  episodes: number;
  totals: number[]; // the total reward of each episode so far
};

export function makeLearner(method: Method, seed = 1, opts: Partial<Pick<Learner, "alpha" | "gamma" | "epsilon">> = {}): Learner {
  return {
    method,
    q: Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => [0, 0, 0, 0])),
    alpha: opts.alpha ?? 0.5,
    gamma: opts.gamma ?? 1,
    epsilon: opts.epsilon ?? 0.1,
    rng: mulberry32(seed),
    episodes: 0,
    totals: [],
  };
}

export function step(cell: Cell, move: Move): { reward: number; next: Cell; done: boolean } {
  const r = Math.min(ROWS - 1, Math.max(0, cell[0] + DELTA[move][0]));
  const c = Math.min(COLS - 1, Math.max(0, cell[1] + DELTA[move][1]));
  const next: Cell = [r, c];
  if (isCliff(next)) return { reward: -100, next: [START[0], START[1]], done: false };
  if (isGoal(next)) return { reward: -1, next, done: true };
  return { reward: -1, next, done: false };
}

function argmaxRandomTies(l: Learner, values: number[]): number {
  const best = Math.max(...values);
  const tied = values.flatMap((v, i) => (v === best ? [i] : []));
  return tied[Math.floor(l.rng() * tied.length)];
}

export function choose(l: Learner, cell: Cell): number {
  return l.rng() < l.epsilon ? Math.floor(l.rng() * 4) : argmaxRandomTies(l, l.q[cell[0]][cell[1]]);
}

// One episode, learning after every single step (that is the point of temporal-difference learning).
export function runEpisode(l: Learner, maxSteps = 2000): number {
  let cell: Cell = [START[0], START[1]];
  let a = choose(l, cell);
  let total = 0;
  for (let t = 0; t < maxSteps; t++) {
    const { reward, next, done } = step(cell, MOVES[a]);
    total += reward;
    const aNext = choose(l, next);
    let target: number;
    if (done) target = reward;
    else if (l.method === "sarsa") target = reward + l.gamma * l.q[next[0]][next[1]][aNext]; // the move it will actually make
    else target = reward + l.gamma * Math.max(...l.q[next[0]][next[1]]); // the best move there
    const old = l.q[cell[0]][cell[1]][a];
    l.q[cell[0]][cell[1]][a] = old + l.alpha * (target - old); // new = old + step * (surprise)
    cell = next;
    a = aNext;
    if (done) break;
  }
  l.episodes += 1;
  l.totals.push(total);
  return total;
}

// The route the learned policy takes if it never explores. Ties are broken by the first move (a fixed rule), so reading it
// does not disturb the learner's random stream. `reachedGoal` is false if it loops or falls.
export function greedyRoute(l: Learner, limit = 40): { route: Cell[]; reachedGoal: boolean } {
  let cell: Cell = [START[0], START[1]];
  const route: Cell[] = [cell];
  for (let t = 0; t < limit; t++) {
    const qs = l.q[cell[0]][cell[1]];
    const move = MOVES[qs.indexOf(Math.max(...qs))];
    const { next, done } = step(cell, move);
    cell = next;
    route.push(cell);
    if (done) return { route, reachedGoal: true };
  }
  return { route, reachedGoal: false };
}

export function recentAverage(l: Learner, n = 100): number | null {
  const slice = l.totals.slice(-n);
  return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : null;
}

export type Snapshot = {
  episodes: number;
  moves: (Move | null)[][]; // the greedy move in each cell once it has been tried, else null
  onRoute: boolean[][];
  routeLength: number | null;
  recent: number | null;
  last: number | null;
};

export function snapshot(l: Learner): Snapshot {
  const { route, reachedGoal } = greedyRoute(l);
  const onRoute = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  if (reachedGoal) route.forEach(([r, c]) => (onRoute[r][c] = true)); // only show a route that actually gets there
  const moves: (Move | null)[][] = [];
  for (let r = 0; r < ROWS; r++) {
    moves.push([]);
    for (let c = 0; c < COLS; c++) {
      const qs = l.q[r][c];
      moves[r].push(isCliff([r, c]) || isGoal([r, c]) || qs.every((x) => x === 0) ? null : MOVES[qs.indexOf(Math.max(...qs))]);
    }
  }
  return {
    episodes: l.episodes,
    moves,
    onRoute,
    routeLength: reachedGoal ? route.length - 1 : null,
    recent: recentAverage(l, 100),
    last: l.totals.length ? l.totals[l.totals.length - 1] : null,
  };
}
