import { describe, expect, it } from "vitest";
import { OUTSIDE, applyFrame, buildColorTable, decodeReplay, headsAt, paintCells } from "@/lib/replay-format";

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
