// Reader for the recorded match written by web/scripts/make_replay.py.
import { PLAYER_COLORS } from "@/lib/colors";

export const OUTSIDE = 0xfe;
const NONE = 15;
const TRAIL_ALPHA = 0.45;

export type Replay = {
  height: number;
  width: number;
  frames: number;
  players: number;
  initial: Uint8Array;
  heads: Uint8Array;
  diffStart: Uint32Array;
  diffIndex: Uint16Array;
  diffValue: Uint8Array;
};

export function decodeReplay(bytes: Uint8Array): Replay {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let off = 0;
  const need = (n: number) => {
    if (off + n > bytes.length) throw new Error("replay recording is truncated");
  };
  need(12);
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== "PSRP" || bytes[4] !== 1) {
    throw new Error("not a Papersseum replay recording");
  }
  const height = view.getUint16(5, true);
  const width = view.getUint16(7, true);
  const frames = view.getUint16(9, true);
  const players = bytes[11];
  off = 12;

  need(height * width);
  const initial = bytes.slice(off, off + height * width);
  off += height * width;

  const heads = new Uint8Array(frames * players * 2);
  const diffStart = new Uint32Array(frames + 1);
  const index: number[] = [];
  const value: number[] = [];
  for (let f = 0; f < frames; f++) {
    need(players * 2);
    heads.set(bytes.subarray(off, off + players * 2), f * players * 2);
    off += players * 2;
    diffStart[f] = index.length;
    if (f === 0) continue;
    need(2);
    const n = view.getUint16(off, true);
    off += 2;
    need(n * 3);
    for (let k = 0; k < n; k++, off += 3) {
      index.push(view.getUint16(off, true));
      value.push(bytes[off + 2]);
    }
  }
  diffStart[frames] = index.length;
  if (off !== bytes.length) throw new Error("replay recording has trailing bytes");
  return {
    height, width, frames, players, initial, heads, diffStart,
    diffIndex: Uint16Array.from(index), diffValue: Uint8Array.from(value),
  };
}

export function applyFrame(cells: Uint8Array, replay: Replay, frame: number): void {
  for (let k = replay.diffStart[frame]; k < replay.diffStart[frame + 1]; k++) {
    cells[replay.diffIndex[k]] = replay.diffValue[k];
  }
}

export function headsAt(replay: Replay, frame: number): ([number, number] | null)[] {
  const out: ([number, number] | null)[] = [];
  for (let p = 0; p < replay.players; p++) {
    const at = (frame * replay.players + p) * 2;
    const row = replay.heads[at];
    const col = replay.heads[at + 1];
    out.push(row === 255 && col === 255 ? null : [row, col]);
  }
  return out;
}

export type Theme = "light" | "dark";

// Same ground and head colours as web/scripts/make_board.py.
export const THEMES: Record<Theme, { ground: string; head: string }> = {
  light: { ground: "#efefec", head: "#111111" },
  dark: { ground: "#1f1f1f", head: "#f5f5f5" },
};

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// RGBA for every possible cell byte.
export function buildColorTable(theme: Theme): Uint8ClampedArray {
  const ground = rgb(THEMES[theme].ground);
  const players = PLAYER_COLORS.map(rgb);
  const table = new Uint8ClampedArray(256 * 4);
  for (let v = 0; v < 256; v++) {
    let color: [number, number, number] | null = ground;
    const owner = v & 15;
    const trail = v >> 4;
    if (v === OUTSIDE) color = null;
    else if (owner !== NONE && owner < players.length) color = players[owner];
    else if (trail !== NONE && trail < players.length) {
      const p = players[trail];
      color = [0, 1, 2].map((i) => Math.round(ground[i] + (p[i] - ground[i]) * TRAIL_ALPHA)) as [number, number, number];
    }
    if (color) table.set([...color, 255], v * 4);
  }
  return table;
}

export function paintCells(out: Uint8ClampedArray, cells: Uint8Array, table: Uint8ClampedArray): void {
  for (let i = 0; i < cells.length; i++) {
    const t = cells[i] * 4;
    out[i * 4] = table[t];
    out[i * 4 + 1] = table[t + 1];
    out[i * 4 + 2] = table[t + 2];
    out[i * 4 + 3] = table[t + 3];
  }
}
