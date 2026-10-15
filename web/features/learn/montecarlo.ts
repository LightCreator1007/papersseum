// Chapter 7's demo: first-visit Monte Carlo control on the chapter 6 grid world.
// It learns only from played episodes: it is never given the rules. It mirrors
// resources/chapters/07-monte-carlo/code/mc_grid.py (the random streams differ, the algorithm does not).

import { mulberry32, type Rng } from "./bandit";
import { COLS, GOAL, MOVES, PIT, ROWS, START, STEP_COST, isTerminal, isWall, land, type Cell, type Move } from "./gridworld";

const SIDEWAYS: Record<Move, [Move, Move]> = { up: ["left", "right"], down: ["left", "right"], left: ["up", "down"], right: ["up", "down"] };

export type Learner = {
  q: number[][][]; // q[row][col][move index]
  alpha: number;
  gamma: number;
  epsilon: number;
  slip: number;
  rng: Rng;
  episodes: number;
};

export function makeLearner(seed = 1, opts: Partial<Pick<Learner, "alpha" | "gamma" | "epsilon" | "slip">> = {}): Learner {
  return {
    q: Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => [0, 0, 0, 0])),
    alpha: opts.alpha ?? 0.1,
    gamma: opts.gamma ?? 0.9,
    epsilon: opts.epsilon ?? 0.1,
    slip: opts.slip ?? 0,
    rng: mulberry32(seed),
    episodes: 0,
  };
}

// The black-box world: what actually happens when you try a move.
export function worldStep(cell: Cell, move: Move, slip: number, rng: Rng): { reward: number; next: Cell; done: boolean } {
  const actual = slip > 0 && rng() < slip ? SIDEWAYS[move][rng() < 0.5 ? 0 : 1] : move;
  const next = land(cell, actual);
  if (next[0] === GOAL[0] && next[1] === GOAL[1]) return { reward: 1, next, done: true };
  if (next[0] === PIT[0] && next[1] === PIT[1]) return { reward: -1, next, done: true };
  return { reward: STEP_COST, next, done: false };
}

export function bestMove(l: Learner, cell: Cell): Move {
  const qs = l.q[cell[0]][cell[1]];
  const best = Math.max(...qs);
  const tied = qs.flatMap((v, i) => (v === best ? [i] : []));
  return MOVES[tied[Math.floor(l.rng() * tied.length)]];
}

export function chooseMove(l: Learner, cell: Cell): Move {
  return l.rng() < l.epsilon ? MOVES[Math.floor(l.rng() * 4)] : bestMove(l, cell);
}

export type Step = { cell: Cell; move: Move; reward: number };

export function playEpisode(l: Learner, maxSteps = 500): Step[] {
  let cell: Cell = [START[0], START[1]];
  const history: Step[] = [];
  for (let t = 0; t < maxSteps; t++) {
    const move = chooseMove(l, cell);
    const { reward, next, done } = worldStep(cell, move, l.slip, l.rng);
    history.push({ cell, move, reward });
    cell = next;
    if (done) break;
  }
  return history;
}

// The returns that followed each step, worked out backwards from the end: G = reward + gamma * G_next.
export function returnsOf(history: Step[], gamma: number): number[] {
  const out: number[] = Array(history.length);
  let g = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    g = history[i].reward + gamma * g;
    out[i] = g;
  }
  return out;
}

// First-visit update: nudge each (cell, move)'s estimate toward the return that followed its first visit.
export function learnFrom(l: Learner, history: Step[]): void {
  const returns = returnsOf(history, l.gamma);
  const seen = new Set<string>();
  history.forEach((s, i) => {
    const key = `${s.cell[0]},${s.cell[1]},${s.move}`;
    if (seen.has(key)) return;
    seen.add(key);
    const m = MOVES.indexOf(s.move);
    const old = l.q[s.cell[0]][s.cell[1]][m];
    l.q[s.cell[0]][s.cell[1]][m] = old + l.alpha * (returns[i] - old); // new = old + step * (surprise)
  });
  l.episodes += 1;
}

export function runEpisode(l: Learner): { steps: number; total: number } {
  const history = playEpisode(l);
  learnFrom(l, history);
  return { steps: history.length, total: returnsOf(history, 1)[0] };
}

export function cellValue(l: Learner, cell: Cell): number {
  return isTerminal(cell) || isWall(cell) ? 0 : Math.max(...l.q[cell[0]][cell[1]]);
}

// What the grid shows right now, as plain data: the best-looking value and move for each cell.
// Reading it does not touch the learner's random stream. A move is null until the cell has been tried.
export type Snapshot = { episodes: number; values: number[][]; moves: (Move | null)[][] };

export function snapshot(l: Learner): Snapshot {
  const values: number[][] = [];
  const moves: (Move | null)[][] = [];
  for (let r = 0; r < ROWS; r++) {
    values.push([]);
    moves.push([]);
    for (let c = 0; c < COLS; c++) {
      const cell: Cell = [r, c];
      values[r].push(cellValue(l, cell));
      const qs = l.q[r][c];
      moves[r].push(isTerminal(cell) || isWall(cell) || qs.every((x) => x === 0) ? null : MOVES[qs.indexOf(Math.max(...qs))]);
    }
  }
  return { episodes: l.episodes, values, moves };
}
