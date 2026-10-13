import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { OUTSIDE, applyFrame, decodeReplay, headsAt } from "@/lib/replay-format";

const replay = decodeReplay(new Uint8Array(gunzipSync(readFileSync("public/home-replay.dat"))));

describe("home-replay.dat", () => {
  it("is a full five-player match on the 120x120 board", () => {
    expect([replay.height, replay.width, replay.players, replay.frames]).toEqual([120, 120, 5, 1801]);
  });
  it("has the 11,304-cell arena", () => {
    expect(replay.initial.filter((v) => v === OUTSIDE).length).toBe(120 * 120 - 11_304);
  });
  it("starts with no trails and the same non-empty patch for each owner", () => {
    const inside = Array.from(replay.initial).filter((v) => v !== OUTSIDE);
    expect(inside.every((v) => v >> 4 === 15)).toBe(true);
    const owned = [0, 1, 2, 3, 4].map((p) => inside.filter((v) => (v & 15) === p).length);
    expect(owned[0]).toBeGreaterThan(0);
    expect(owned).toEqual([owned[0], owned[0], owned[0], owned[0], owned[0]]);
  });
  it("only ever holds valid cell values, and heads stay on the board", () => {
    const cells = replay.initial.slice();
    const valid = (v: number) => v === OUTSIDE || v === 0xff || ((v & 15) <= 4 || (v & 15) === 15) && ((v >> 4) <= 4 || (v >> 4) === 15);
    for (let f = 1; f < replay.frames; f++) applyFrame(cells, replay, f);
    expect(Array.from(cells).every(valid)).toBe(true);
    for (let f = 0; f < replay.frames; f += 100) {
      for (const h of headsAt(replay, f)) if (h) expect(h[0] < 120 && h[1] < 120).toBe(true);
    }
  });
});
