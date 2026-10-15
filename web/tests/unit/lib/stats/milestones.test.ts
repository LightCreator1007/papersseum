import { describe, expect, it } from "vitest";
import { milestones } from "@/lib/stats/milestones";
import type { SeatRow } from "@/lib/stats/scorecards";

const house = (name: string, placement: number) => ({ name, isHouse: true, placement });
const row = (matchId: number, placement: number, opponents: SeatRow["opponents"], crashed = false): SeatRow => ({
  matchId, finishedAt: new Date(Date.UTC(2026, 9, 15, 0, matchId)).toISOString(), submissionId: "s1", version: 1,
  placement, coverage: 0.2, crashed, eloBefore: null, eloAfter: null, opponents,
});
const byId = (rows: SeatRow[]) => Object.fromEntries(milestones(rows).map((m) => [m.id, m]));

describe("milestones", () => {
  it("lists every milestone unreached for no matches", () => {
    const all = milestones([]);
    expect(all).toHaveLength(11);
    expect(all.every((m) => m.reachedAt === null && m.matchId === null)).toBe(true);
  });
  it("marks the first match, top 3 and win at the right match", () => {
    const m = byId([row(1, 5, []), row(2, 3, []), row(3, 1, [])]);
    expect(m["first-match"].matchId).toBe(1);
    expect(m["first-top3"].matchId).toBe(2);
    expect(m["first-win"].matchId).toBe(3);
  });
  it("only counts beating a house bot when you finish above all its seats", () => {
    const m = byId([
      row(1, 3, [house("greedy", 2), house("greedy", 4)]),
      row(2, 2, [house("greedy", 3), house("greedy", 4)]),
    ]);
    expect(m["beat-greedy"].matchId).toBe(2);
  });
  it("recognises the real house bot names from the database", () => {
    const m = byId([row(1, 1, [house("house_greedy_1", 2), house("house_greedy_2", 3), house("house_safe_expander_1", 4)])]);
    expect(m["beat-greedy"].matchId).toBe(1);
    expect(m["beat-safe_expander"].matchId).toBe(1);
  });
  it("needs two house bots in the lobby for beat-all-house", () => {
    expect(byId([row(1, 1, [house("hunter", 2)])])["beat-all-house"].matchId).toBeNull();
    expect(byId([row(1, 1, [house("hunter", 2), house("greedy", 3)])])["beat-all-house"].matchId).toBe(1);
  });
  it("resets the clean streak on a crash", () => {
    const rows = Array.from({ length: 25 }, (_, i) => row(i + 1, 3, [], i === 10));
    expect(byId(rows)["clean-20"].matchId).toBeNull();
    const more = Array.from({ length: 31 }, (_, i) => row(i + 1, 3, [], i === 10));
    expect(byId(more)["clean-20"].matchId).toBe(31);
  });
  it("sorts by time before counting", () => {
    const m = byId([row(2, 1, []), row(1, 5, [])]);
    expect(m["first-match"].matchId).toBe(1);
  });
  it("does not credit a lobby with no house bots", () => {
    expect(byId([row(1, 1, [{ name: "someone", isHouse: false, placement: 2 }])])["beat-all-house"].matchId).toBeNull();
  });
});
