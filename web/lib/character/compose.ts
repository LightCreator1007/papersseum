import type { BotGenome, Cell } from "./genome";
import { ANTENNAS, EYES, GRID, HEADS, MOUTHS, PATTERNS, type Point } from "./parts";

export type { Cell } from "./genome";

function mirror(points: readonly Point[], dy: number, part: Cell["part"]): Cell[] {
  const cells: Cell[] = [];
  for (const [x, y] of points) {
    cells.push({ x, y: y + dy, part });
    cells.push({ x: GRID - 1 - x, y: y + dy, part });
  }
  return cells;
}

export function compose(g: BotGenome): Cell[] {
  const head = HEADS[g.head];
  const pattern = PATTERNS[g.pattern];
  const base: Cell[] = [];
  for (const [x, y] of head.cells) {
    const part = pattern(x, y, head) ? "accent" : "body";
    base.push({ x, y, part }, { x: GRID - 1 - x, y, part });
  }
  return [
    ...base,
    ...mirror(ANTENNAS[g.antenna], 0, "antenna"),
    ...mirror(MOUTHS[g.mouth], head.mouthY, "mouth"),
    ...mirror(EYES[g.eyes], head.eyeY, "eye"),
  ];
}
