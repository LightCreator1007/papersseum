// Chapter 6's grid world. Mirrors resources/chapters/06-dynamic-programming/code/gridworld_dp.py, so the demo,
// the Python and the lesson all give the same numbers.
//
//   row 0:   .  .  .  +1        '+1' is the goal, '-1' is a pit; both end the game.
//   row 1:   .  #  .  -1        '#' is a wall.
//   row 2:   S  .  .  .         'S' is where the agent starts.

export const ROWS = 3;
export const COLS = 4;
export type Cell = [number, number];
export const WALL: Cell = [1, 1];
export const GOAL: Cell = [0, 3];
export const PIT: Cell = [1, 3];
export const START: Cell = [2, 0];
export const STEP_COST = -0.04;

export type Move = "up" | "down" | "left" | "right";
export const MOVES: Move[] = ["up", "down", "left", "right"];
const DELTA: Record<Move, [number, number]> = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
const SIDEWAYS: Record<Move, [Move, Move]> = { up: ["left", "right"], down: ["left", "right"], left: ["up", "down"], right: ["up", "down"] };
export const ARROW: Record<Move, string> = { up: "↑", down: "↓", left: "←", right: "→" };

export type Values = number[][]; // values[row][col]

const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];
export const isWall = (c: Cell) => same(c, WALL);
export const isTerminal = (c: Cell) => same(c, GOAL) || same(c, PIT);

export function zeros(): Values {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

export function land(cell: Cell, move: Move): Cell {
  const next: Cell = [cell[0] + DELTA[move][0], cell[1] + DELTA[move][1]];
  if (next[0] < 0 || next[0] >= ROWS || next[1] < 0 || next[1] >= COLS || isWall(next)) return cell;
  return next;
}

// The possible (probability, next cell, reward) after trying an action.
export function outcomes(cell: Cell, action: Move, slip: number): { p: number; next: Cell; reward: number }[] {
  const tries: [Move, number][] = [
    [action, 1 - slip],
    [SIDEWAYS[action][0], slip / 2],
    [SIDEWAYS[action][1], slip / 2],
  ];
  return tries
    .filter(([, p]) => p > 0)
    .map(([m, p]) => {
      const next = land(cell, m);
      const reward = same(next, GOAL) ? 1 : same(next, PIT) ? -1 : STEP_COST;
      return { p, next, reward };
    });
}

export function backup(v: Values, cell: Cell, action: Move, gamma: number, slip: number): number {
  return outcomes(cell, action, slip).reduce((sum, o) => sum + o.p * (o.reward + (isTerminal(o.next) ? 0 : gamma * v[o.next[0]][o.next[1]])), 0);
}

export function openCells(): Cell[] {
  const out: Cell[] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!isWall([r, c])) out.push([r, c]);
  return out;
}

// One sweep of value iteration: every cell takes the best backup, using the OLD values on the right-hand side.
export function sweep(v: Values, gamma: number, slip: number): { values: Values; change: number } {
  const next = zeros();
  let change = 0;
  for (const cell of openCells()) {
    if (isTerminal(cell)) continue;
    next[cell[0]][cell[1]] = Math.max(...MOVES.map((m) => backup(v, cell, m, gamma, slip)));
    change = Math.max(change, Math.abs(next[cell[0]][cell[1]] - v[cell[0]][cell[1]]));
  }
  return { values: next, change };
}

export function greedyMove(v: Values, cell: Cell, gamma: number, slip: number): Move {
  return MOVES.reduce((best, m) => (backup(v, cell, m, gamma, slip) > backup(v, cell, best, gamma, slip) + 1e-12 ? m : best), MOVES[0]);
}

export function solve(gamma: number, slip: number, tol = 1e-9): { values: Values; sweeps: number } {
  let v = zeros();
  for (let sweeps = 1; sweeps < 10_000; sweeps++) {
    const { values, change } = sweep(v, gamma, slip);
    v = values;
    if (change < tol) return { values: v, sweeps };
  }
  return { values: v, sweeps: 10_000 };
}
