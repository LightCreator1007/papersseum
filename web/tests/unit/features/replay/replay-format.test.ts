import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  FrameStore, OUTSIDE, applyFrame, buildColorTable, clock, decodeReplay, headerLength, headsAt, paintCells,
} from "@/features/replay/replay-format";

// 2x2 board, 2 frames, 1 player.
// Frame 0 cells: outside, empty, owner 0, trail 0; head at (1,1).
// Frame 1: the player is dead and cell 1 becomes owner 0.
function tiny(): number[] {
  return [
    ..."PSRP".split("").map((c) => c.charCodeAt(0)),
    1, 2, 0, 2, 0, 2, 0, 1,
    0xfe, 0xff, 0xf0, 0x0f,
    1, 1,
    255, 255,
    1, 0, 1, 0, 0xf0,
  ];
}

describe("decodeReplay", () => {
  it("reads the header and first frame", () => {
    const r = decodeReplay(Uint8Array.from(tiny()));
    expect([r.height, r.width, r.frames, r.players]).toEqual([2, 2, 2, 1]);
    expect(Array.from(r.initial)).toEqual([OUTSIDE, 0xff, 0xf0, 0x0f]);
  });
  it("reads heads, with 255/255 as dead", () => {
    const r = decodeReplay(Uint8Array.from(tiny()));
    expect(headsAt(r, 0)).toEqual([[1, 1]]);
    expect(headsAt(r, 1)).toEqual([null]);
  });
  it("applies a frame's changes", () => {
    const r = decodeReplay(Uint8Array.from(tiny()));
    const cells = r.initial.slice();
    applyFrame(cells, r, 1);
    expect(Array.from(cells)).toEqual([OUTSIDE, 0xf0, 0xf0, 0x0f]);
  });
  it("rejects other files, truncation and trailing bytes", () => {
    const bad = tiny();
    bad[0] = 0x58;
    expect(() => decodeReplay(Uint8Array.from(bad))).toThrow();
    expect(() => decodeReplay(Uint8Array.from(tiny().slice(0, -1)))).toThrow();
    expect(() => decodeReplay(Uint8Array.from([...tiny(), 0]))).toThrow();
  });
});

describe("colours", () => {
  const rgba = (t: Uint8ClampedArray, v: number) => Array.from(t.subarray(v * 4, v * 4 + 4));
  it("leaves outside cells transparent and paints empty cells as ground", () => {
    const t = buildColorTable("light");
    expect(rgba(t, OUTSIDE)[3]).toBe(0);
    expect(rgba(t, 0xff)).toEqual([0xef, 0xef, 0xec, 255]);
  });
  it("paints owners in their colour, trails 45% over ground, owner over trail", () => {
    const t = buildColorTable("light");
    expect(rgba(t, 0xf0)).toEqual([0xff, 0x4d, 0x5e, 255]); // owner 0
    const trail = rgba(t, 0x0f); // trail 0, no owner
    expect(trail).toEqual([
      Math.round(0xef + (0xff - 0xef) * 0.45),
      Math.round(0xef + (0x4d - 0xef) * 0.45),
      Math.round(0xec + (0x5e - 0xec) * 0.45),
      255,
    ]);
    expect(rgba(t, 0x10)).toEqual([0xff, 0x4d, 0x5e, 255]); // owner 0 with player 1's trail on it
  });
  it("uses the dark ground in dark mode", () => {
    expect(rgba(buildColorTable("dark"), 0xff)).toEqual([0x1f, 0x1f, 0x1f, 255]);
  });
  it("paints every cell from the table", () => {
    const t = buildColorTable("light");
    const out = new Uint8ClampedArray(2 * 4);
    paintCells(out, Uint8Array.from([0xff, 0xf0]), t);
    expect(Array.from(out)).toEqual([0xef, 0xef, 0xec, 255, 0xff, 0x4d, 0x5e, 255]);
  });
});

// Byte offsets where each frame record ends, after the header.
function recordEnds(body: Uint8Array, players: number): number[] {
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  const ends: number[] = [];
  let off = headerLength(body);
  while (off < body.length) {
    off += players * 2;
    off += 2 + view.getUint16(off, true) * 3;
    ends.push(off);
  }
  return ends;
}

describe("FrameStore", () => {
  const body = new Uint8Array(gunzipSync(readFileSync("public/home-replay.dat")));
  const full = decodeReplay(body);

  it("starts with only frame 0", () => {
    const store = new FrameStore(body.subarray(0, headerLength(body)));
    expect([store.available, store.frames, store.complete]).toEqual([1, 1801, false]);
    expect(Array.from(store.initial)).toEqual(Array.from(full.initial));
    expect(headsAt(store, 0)).toEqual(headsAt(full, 0));
  });

  it("decodes uneven batches to the same frames as the whole file", () => {
    const store = new FrameStore(body.subarray(0, headerLength(body)));
    const ends = recordEnds(body, full.players);
    let from = headerLength(body);
    for (const size of [1, 7, 50, 3, 1000, 10_000]) {
      const upTo = Math.min(store.available - 1 + size, ends.length);
      if (upTo === store.available - 1) break;
      store.append(body.subarray(from, ends[upTo - 1]));
      from = ends[upTo - 1];
      expect(store.available).toBe(upTo + 1);
    }
    expect(store.complete).toBe(true);
    const a = store.initial.slice();
    const b = full.initial.slice();
    for (let f = 1; f < full.frames; f++) {
      applyFrame(a, store, f);
      applyFrame(b, full, f);
      expect(headsAt(store, f)).toEqual(headsAt(full, f));
    }
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("refuses a partial record and records past the last frame", () => {
    const store = new FrameStore(body.subarray(0, headerLength(body)));
    const ends = recordEnds(body, full.players);
    expect(() => store.append(body.subarray(headerLength(body), ends[0] - 1))).toThrow("truncated");
    const whole = new FrameStore(body.subarray(0, headerLength(body)));
    whole.append(body.subarray(headerLength(body)));
    expect(() => whole.append(body.subarray(headerLength(body), ends[0]))).toThrow("trailing");
  });

  it("refuses a header of the wrong length", () => {
    expect(() => new FrameStore(body.subarray(0, headerLength(body) - 1))).toThrow("truncated");
    expect(() => new FrameStore(body.subarray(0, headerLength(body) + 1))).toThrow("trailing");
  });
});

describe("clock", () => {
  it("shows decisions as match time", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(835)).toBe("1:23");
    expect(clock(1800)).toBe("3:00");
  });
});
