import { OUTSIDE, headsAt, type Replay } from "@/features/replay/replay-format";

export type ArenaEvent = { frame: number; kind: "death" | "capture" | "lead"; slot: number; cells?: number };

const NONE = 15;
export const CAPTURE_MIN_CELLS = 20;
// A new leader must be this many cells ahead, so a near-tie doesn't flicker between players.
export const LEAD_MARGIN_CELLS = 10;

// Events derived from the recording alone: a head leaving the board is a death,
// a jump of CAPTURE_MIN_CELLS or more owned cells in one frame is a capture, and the
// most territory changing hands (by LEAD_MARGIN_CELLS) is a lead change.
export function eventsFrom(replay: Replay): ArenaEvent[] {
  const out: ArenaEvent[] = [];
  const owned = new Int32Array(replay.players);
  const cells = replay.initial.slice();
  for (const v of cells) if (v !== OUTSIDE && (v & 15) !== NONE && (v & 15) < replay.players) owned[v & 15]++;
  let prevHeads = headsAt(replay, 0);
  let leader = -1;
  for (let f = 1; f < replay.frames; f++) {
    const before = owned.slice();
    for (let k = replay.diffStart[f]; k < replay.diffStart[f + 1]; k++) {
      const i = replay.diffIndex[k];
      const was = cells[i];
      const now = replay.diffValue[k];
      if (was !== OUTSIDE && (was & 15) < replay.players) owned[was & 15]--;
      if (now !== OUTSIDE && (now & 15) < replay.players) owned[now & 15]++;
      cells[i] = now;
    }
    const heads = headsAt(replay, f);
    for (let p = 0; p < replay.players; p++) {
      if (prevHeads[p] && !heads[p]) out.push({ frame: f, kind: "death", slot: p });
      const gained = owned[p] - before[p];
      if (gained >= CAPTURE_MIN_CELLS) out.push({ frame: f, kind: "capture", slot: p, cells: gained });
    }
    let top = 0;
    for (let p = 1; p < replay.players; p++) if (owned[p] > owned[top]) top = p;
    const ahead = leader < 0 ? owned[top] - Math.max(0, ...Array.from(owned).filter((_, p) => p !== top)) : owned[top] - owned[leader];
    if (top !== leader && ahead >= LEAD_MARGIN_CELLS) {
      leader = top;
      out.push({ frame: f, kind: "lead", slot: top });
    }
    prevHeads = heads;
  }
  return out;
}

// Cells a player can own: everything inside the arena.
export function playableCells(replay: Replay): number {
  let n = 0;
  for (const v of replay.initial) if (v !== OUTSIDE) n++;
  return n;
}

// The moments worth a mark on the viewer's timeline: every knockout and lead change, but only
// captures of at least KEY_CAPTURE_SHARE of the arena, so routine land-grabs don't bury them.
export const KEY_CAPTURE_SHARE = 0.04;
export function keyMoments(events: ArenaEvent[], playable: number): ArenaEvent[] {
  const big = Math.max(CAPTURE_MIN_CELLS, Math.round(playable * KEY_CAPTURE_SHARE));
  return events.filter((e) => e.kind !== "capture" || (e.cells ?? 0) >= big);
}
