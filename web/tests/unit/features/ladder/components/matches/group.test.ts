import { describe, expect, it } from "vitest";
import { groupByTime, timeGroup } from "@/features/ladder/components/matches/group";

// 15 Oct 2026, 18:30 in Kolkata (13:00 UTC).
const NOW = Date.parse("2026-10-15T13:00:00Z");

describe("timeGroup", () => {
  it("puts the last sixty minutes first", () => {
    expect(timeGroup("2026-10-15T12:31:00Z", NOW)).toBe("Last hour");
  });
  it("uses the Kolkata calendar day for today and yesterday", () => {
    expect(timeGroup("2026-10-14T18:31:00Z", NOW)).toBe("Earlier today"); // 00:01 on the 15th in Kolkata
    expect(timeGroup("2026-10-14T18:29:00Z", NOW)).toBe("Yesterday"); // 23:59 on the 14th in Kolkata
  });
  it("falls back to the date", () => {
    expect(timeGroup("2026-10-12T10:00:00Z", NOW)).toBe("Mon 12 Oct");
  });
});

describe("groupByTime", () => {
  it("keeps order and merges consecutive runs", () => {
    const rows = ["2026-10-15T12:50:00Z", "2026-10-15T12:40:00Z", "2026-10-15T08:00:00Z", "2026-10-14T10:00:00Z"];
    const groups = groupByTime(rows, (r) => r, NOW);
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([
      ["Last hour", 2],
      ["Earlier today", 1],
      ["Yesterday", 1],
    ]);
  });
  it("returns nothing for an empty list", () => {
    expect(groupByTime([], (r: string) => r, NOW)).toEqual([]);
  });
});
