export type SeatRow = {
  matchId: number;
  finishedAt: string;
  submissionId: string | null;
  version: number | null;
  placement: number;
  coverage: number;
  crashed: boolean;
  eloBefore: number | null;
  eloAfter: number | null;
  opponents: { name: string; isHouse: boolean; placement: number }[];
};

export type Scorecard = {
  submissionId: string;
  version: number | null;
  games: number;
  avgPlacement: number;
  winRate: number;
  top3Rate: number;
  avgCoverage: number;
  crashRate: number;
  eloDelta: number;
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function versionScorecards(rows: SeatRow[]): Scorecard[] {
  const groups = new Map<string, SeatRow[]>();
  for (const r of rows) {
    if (!r.submissionId) continue;
    groups.set(r.submissionId, [...(groups.get(r.submissionId) ?? []), r]);
  }
  return [...groups.entries()]
    .map(([submissionId, g]) => ({
      submissionId,
      version: g[0].version,
      games: g.length,
      avgPlacement: mean(g.map((r) => r.placement)),
      winRate: mean(g.map((r) => (r.placement === 1 ? 1 : 0))),
      top3Rate: mean(g.map((r) => (r.placement <= 3 ? 1 : 0))),
      avgCoverage: mean(g.map((r) => r.coverage)),
      crashRate: mean(g.map((r) => (r.crashed ? 1 : 0))),
      eloDelta: g.reduce((a, r) => a + ((r.eloAfter ?? 0) - (r.eloBefore ?? 0)), 0),
    }))
    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
}
