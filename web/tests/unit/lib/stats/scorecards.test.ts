import { describe, expect, it } from "vitest";
import { versionScorecards } from "@/lib/stats/scorecards";
import type { SeatRow } from "@/lib/stats/scorecards";

const row = (o: Partial<SeatRow>): SeatRow => ({
  matchId: 1, finishedAt: "2026-10-15T10:00:00Z", submissionId: "s1", version: 1, placement: 3,
  coverage: 0.2, crashed: false, eloBefore: 1500, eloAfter: 1500, opponents: [], ...o,
});

describe("versionScorecards", () => {
  it("returns nothing for no matches", () => {
    expect(versionScorecards([])).toEqual([]);
  });
  it("aggregates one version", () => {
    const [s] = versionScorecards([
      row({ matchId: 1, placement: 1, coverage: 0.4, eloBefore: 1500, eloAfter: 1520 }),
      row({ matchId: 2, placement: 4, coverage: 0.1, crashed: true, eloBefore: 1520, eloAfter: 1510 }),
    ]);
    expect(s).toEqual({
      submissionId: "s1", version: 1, games: 2, avgPlacement: 2.5, winRate: 0.5, top3Rate: 0.5,
      avgCoverage: 0.25, crashRate: 0.5, eloDelta: 10,
    });
  });
  it("orders newest version first and skips rows with no submission", () => {
    const out = versionScorecards([row({ submissionId: "s1", version: 1 }), row({ submissionId: "s2", version: 2 }), row({ submissionId: null })]);
    expect(out.map((s) => s.version)).toEqual([2, 1]);
  });
  it("treats a missing Elo as zero change", () => {
    expect(versionScorecards([row({ eloBefore: null, eloAfter: null })])[0].eloDelta).toBe(0);
  });
});
