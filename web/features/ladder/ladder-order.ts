// Pure ordering and windowing for the leaderboard, kept out of queries.ts so tests need no server.

export type Orderable = {
  botId: string;
  rank: number;
  name: string;
  games: number;
  activeSince: string | null;
};

// The view ranks with rank(), so equal ratings share a rank. Within a tie: more games first,
// then the older bot (longest on the ladder), then name so the order never flickers.
export function compareLadder(a: Orderable, b: Orderable): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  if (a.games !== b.games) return b.games - a.games;
  const aSince = sinceMs(a.activeSince);
  const bSince = sinceMs(b.activeSince);
  if (aSince !== bSince) return aSince < bSince ? -1 : 1;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

function sinceMs(iso: string | null): number {
  const t = iso === null ? NaN : Date.parse(iso);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

export function sortLadder<T extends Orderable>(rows: T[]): T[] {
  return [...rows].sort(compareLadder);
}

export const LADDER_WINDOW = 100;

export type LadderWindow<T> = {
  rows: T[];
  /** The visitor's own row when it falls below the window; shown pinned after a gap. */
  pinned: T | null;
  /** Rows left out of the window (not counting the pinned one). */
  hidden: number;
  total: number;
};

// Shows the top `size` rows. The visitor's own row is never hidden: if it ranks below the
// window it comes back as `pinned`, so the sticky "you" row still works.
export function windowLadder<T extends { botId: string }>(
  rows: T[],
  { mine, showAll, size = LADDER_WINDOW }: { mine: string | null; showAll: boolean; size?: number },
): LadderWindow<T> {
  if (showAll || rows.length <= size) return { rows, pinned: null, hidden: 0, total: rows.length };
  const top = rows.slice(0, size);
  const own = mine === null ? null : rows.slice(size).find((r) => r.botId === mine) ?? null;
  return { rows: top, pinned: own, hidden: rows.length - size - (own ? 1 : 0), total: rows.length };
}
