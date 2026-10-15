import type { SeatRow } from "@/lib/stats/scorecards";

export type Milestone = { id: string; label: string; reachedAt: string | null; matchId: number | null };

const HOUSE = ["greedy", "safe_expander", "hunter"] as const;

// The database names house bots house_greedy_1, house_safe_expander_2 and so on.
const houseKind = (name: string) => name.replace(/^house_/, "").replace(/_\d+$/, "");

type Rule = { id: string; label: string; test: (r: SeatRow, i: number, state: { clean: number }) => boolean };

const beat = (kind: string) => (r: SeatRow) => {
  const seats = r.opponents.filter((o) => o.isHouse && houseKind(o.name) === kind);
  return seats.length > 0 && seats.every((o) => r.placement < o.placement);
};

const RULES: Rule[] = [
  { id: "first-match", label: "Played a first match", test: () => true },
  { id: "first-top3", label: "Finished in the top 3", test: (r) => r.placement <= 3 },
  { id: "first-win", label: "Won a match", test: (r) => r.placement === 1 },
  ...HOUSE.map((h) => ({ id: `beat-${h}`, label: `Finished above ${h}`, test: beat(h) })),
  {
    id: "beat-all-house",
    label: "Finished above every house bot in a match",
    test: (r) => {
      const h = r.opponents.filter((o) => o.isHouse);
      return h.length >= 2 && h.every((o) => r.placement < o.placement);
    },
  },
  { id: "games-10", label: "Played 10 matches", test: (_r, i) => i + 1 >= 10 },
  { id: "games-50", label: "Played 50 matches", test: (_r, i) => i + 1 >= 50 },
  { id: "games-100", label: "Played 100 matches", test: (_r, i) => i + 1 >= 100 },
  { id: "clean-20", label: "20 matches in a row without a crash", test: (_r, _i, s) => s.clean >= 20 },
];

export function milestones(rows: SeatRow[]): Milestone[] {
  const sorted = [...rows].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
  const out = new Map<string, Milestone>(RULES.map((r) => [r.id, { id: r.id, label: r.label, reachedAt: null, matchId: null }]));
  const state = { clean: 0 };
  sorted.forEach((row, i) => {
    state.clean = row.crashed ? 0 : state.clean + 1;
    for (const rule of RULES) {
      const m = out.get(rule.id);
      if (m && m.matchId === null && rule.test(row, i, state)) {
        m.matchId = row.matchId;
        m.reachedAt = row.finishedAt;
      }
    }
  });
  return [...out.values()];
}
