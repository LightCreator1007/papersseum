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

const FIXED = 12; // "PSRP", version, height, width, frames, players

// Length of the header part: fixed fields, frame 0 cells and frame 0 heads.
export function headerLength(bytes: Uint8Array): number {
  if (bytes.length < FIXED) throw new Error("replay recording is truncated");
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== "PSRP" || bytes[4] !== 1) {
    throw new Error("not a Papersseum replay recording");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return FIXED + view.getUint16(5, true) * view.getUint16(7, true) + bytes[11] * 2;
}

// A replay that arrives in pieces: the header first, then batches of whole
// frame records (the engine worker streams them while it computes). Frames
// [0, available) can be drawn.
export class FrameStore implements Replay {
  readonly height: number;
  readonly width: number;
  readonly frames: number;
  readonly players: number;
  readonly initial: Uint8Array;
  readonly heads: Uint8Array;
  readonly diffStart: Uint32Array;
  diffIndex = new Uint16Array(4096);
  diffValue = new Uint8Array(4096);
  available = 1;
  private diffCount = 0;

  constructor(header: Uint8Array) {
    const length = headerLength(header);
    if (header.length < length) throw new Error("replay recording is truncated");
    if (header.length > length) throw new Error("replay recording has trailing bytes");
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    this.height = view.getUint16(5, true);
    this.width = view.getUint16(7, true);
    this.frames = view.getUint16(9, true);
    this.players = header[11];
    if (this.frames < 1) throw new Error("replay recording has no frames");
    const cells = this.height * this.width;
    this.initial = header.slice(FIXED, FIXED + cells);
    this.heads = new Uint8Array(this.frames * this.players * 2);
    this.heads.set(header.subarray(FIXED + cells), 0);
    this.diffStart = new Uint32Array(this.frames + 1);
  }

  get complete(): boolean {
    return this.available === this.frames;
  }

  append(bytes: Uint8Array): void {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const headBytes = this.players * 2;
    let off = 0;
    while (off < bytes.length) {
      if (this.complete) throw new Error("replay recording has trailing bytes");
      if (off + headBytes + 2 > bytes.length) throw new Error("replay recording is truncated");
      const frame = this.available;
      this.heads.set(bytes.subarray(off, off + headBytes), frame * headBytes);
      off += headBytes;
      const n = view.getUint16(off, true);
      off += 2;
      if (off + n * 3 > bytes.length) throw new Error("replay recording is truncated");
      this.reserve(this.diffCount + n);
      this.diffStart[frame] = this.diffCount;
      for (let k = 0; k < n; k++, off += 3) {
        this.diffIndex[this.diffCount] = view.getUint16(off, true);
        this.diffValue[this.diffCount] = bytes[off + 2];
        this.diffCount++;
      }
      this.diffStart[frame + 1] = this.diffCount;
      this.available = frame + 1;
    }
  }

  private reserve(needed: number): void {
    if (needed <= this.diffIndex.length) return;
    let size = this.diffIndex.length;
    while (size < needed) size *= 2;
    const index = new Uint16Array(size);
    index.set(this.diffIndex.subarray(0, this.diffCount));
    const value = new Uint8Array(size);
    value.set(this.diffValue.subarray(0, this.diffCount));
    this.diffIndex = index;
    this.diffValue = value;
  }
}

export function decodeReplay(bytes: Uint8Array): Replay {
  const length = headerLength(bytes);
  if (bytes.length < length) throw new Error("replay recording is truncated");
  const store = new FrameStore(bytes.subarray(0, length));
  store.append(bytes.subarray(length));
  if (!store.complete) throw new Error("replay recording is truncated");
  return store;
}

export const DECISIONS_PER_SECOND = 10;

// Frame (decision) index as match time: 835 -> "1:23".
export function clock(frame: number): string {
  const seconds = Math.floor(frame / DECISIONS_PER_SECOND);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
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
