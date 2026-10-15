import { describe, expect, it } from "vitest";
import { decodeReplay, headsAt } from "@/features/replay/replay-format";
import { eventsFrom, keyMoments, playableCells } from "@/lib/arena/events";

// PSRP v1: "PSRP", version, height u16, width u16, frames u16, players u8,
// frame 0 cells, frame 0 heads, then per frame: heads, diff count u16, diffs (index u16, value u8).
function build(): Uint8Array {
  const h = 10, w = 10, frames = 3, players = 2;
  const bytes: number[] = [..."PSRP"].map((c) => c.charCodeAt(0));
  bytes.push(1, h, 0, w, 0, frames, 0, players);
  const cells = new Array(h * w).fill(0xff);
  cells[0] = 0x00;
  cells[99] = 0x01;
  bytes.push(...cells);
  bytes.push(0, 0, 9, 9);
  // frame 1: both alive, player 0 captures 25 cells
  bytes.push(0, 1, 9, 8);
  bytes.push(25, 0);
  for (let i = 1; i <= 25; i++) bytes.push(i, 0, 0x00);
  // frame 2: player 1 dies
  bytes.push(0, 2, 255, 255);
  bytes.push(0, 0);
  return new Uint8Array(bytes);
}

describe("arena events", () => {
  const replay = decodeReplay(build());
  it("reads heads per frame", () => {
    expect(headsAt(replay, 0)).toEqual([[0, 0], [9, 9]]);
    expect(headsAt(replay, 2)).toEqual([[0, 2], null]);
  });
  it("derives a capture, the lead it takes, and a death", () => {
    expect(eventsFrom(replay)).toEqual([
      { frame: 1, kind: "capture", slot: 0, cells: 25 },
      { frame: 1, kind: "lead", slot: 0 },
      { frame: 2, kind: "death", slot: 1 },
    ]);
  });
  it("keeps knockouts and leads, and only captures of at least 4% of the arena", () => {
    expect(playableCells(replay)).toBe(100); // 0xff is empty arena, not outside
    const events = eventsFrom(replay);
    expect(keyMoments(events, 100)).toEqual(events); // 25 cells clears the 20-cell floor
    expect(keyMoments(events, 1000).map((e) => e.kind)).toEqual(["lead", "death"]); // 25 < 40
  });
});
