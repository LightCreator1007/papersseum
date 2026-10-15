export type Point = readonly [x: number, y: number];

export type HeadPart = {
  cells: readonly Point[];
  eyeY: number;
  mouthY: number;
  bandY: number;
};

export type PatternPart = (x: number, y: number, head: HeadPart) => boolean;

export const GRID = 12;
export const HALF = GRID / 2;
export const HEAD_TOP = 3;

function art(rows: readonly string[], top: number): Point[] {
  const cells: Point[] = [];
  rows.forEach((row, dy) => {
    if (row.length !== HALF) throw new Error(`part row "${row}" must be ${HALF} cells wide`);
    for (let x = 0; x < HALF; x++) if (row[x] === "#") cells.push([x, top + dy]);
  });
  return cells;
}

function head(rows: readonly string[], eyeY: number, mouthY: number, bandY: number): HeadPart {
  return { cells: art(rows, HEAD_TOP), eyeY, mouthY, bandY };
}

export const HEADS: readonly HeadPart[] = [
  head([
    ".#####",
    ".#####",
    ".#####",
    "######",
    "######",
    ".#####",
    ".#####",
    ".#####",
    "...###",
  ], 5, 8, 10),
  head([
    "...###",
    "..####",
    ".#####",
    "######",
    "######",
    "######",
    ".#####",
    "..####",
    "...###",
  ], 5, 8, 10),
  head([
    "...###",
    "..####",
    "..####",
    "..####",
    "..####",
    "..####",
    "..####",
    "..####",
    "...###",
  ], 5, 8, 10),
  head([
    ".#####",
    "######",
    "######",
    "######",
    "######",
    "######",
    ".#####",
    "..##..",
    "..##..",
  ], 4, 7, 9),
  head([
    ".#####",
    "######",
    "######",
    "######",
    "..####",
    ".#####",
    ".#####",
    ".#####",
    "......",
  ], 5, 8, 10),
  head([
    "...###",
    "..####",
    ".#####",
    "######",
    "######",
    "######",
    "######",
    "######",
    "######",
  ], 6, 9, 11),
];

export const EYES: readonly (readonly Point[])[] = [
  art(["...#.."], 0),
  art(["...###"], 0),
  art([".....#", ".....#"], 0),
  art(["...##.", "...##."], 0),
  art(["......", "...##."], 0),
  art(["...#.#", "....#."], 0),
];

export const ANTENNAS: readonly (readonly Point[])[] = [
  [],
  art(["....##", ".....#", ".....#"], 0),
  art(["..#...", "..#...", "...#.."], 0),
  art(["......", "..####", ".....#"], 0),
  art([".....#", "....##", "...###"], 0),
];

export const MOUTHS: readonly (readonly Point[])[] = [
  [],
  art(["....##"], 0),
  art(["...#.#", "...#.#"], 0),
  art(["...#..", "....##"], 0),
];

const CENTRE = HALF - 1;

export const PATTERNS: readonly PatternPart[] = [
  (x, y) => x === CENTRE && y === HEAD_TOP,
  (_x, y, h) => y === h.bandY,
  (x, y, h) => y < h.eyeY && ((x >> 1) + y - HEAD_TOP) % 2 === 0,
  (x, y, h) => (x === CENTRE && y < h.eyeY) || y === h.bandY,
];
