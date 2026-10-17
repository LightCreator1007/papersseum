import { beforeEach, describe, expect, it, vi } from "vitest";

// Rows each table answers with; every query on a table gets the same rows.
const rows = vi.hoisted(() => ({}) as Record<string, unknown>);
const selects = vi.hoisted(() => [] as { table: string; columns: string }[]);

function client() {
  return {
    from: (table: string) => {
      const answer = () => ({ data: rows[table] ?? null, error: null });
      const b: Record<string, unknown> = {};
      for (const m of ["eq", "in", "order", "limit", "range"]) b[m] = () => b;
      b.select = (columns: string) => {
        selects.push({ table, columns });
        return b;
      };
      b.maybeSingle = async () => {
        const v = rows[table];
        return { data: Array.isArray(v) ? (v[0] ?? null) : (v ?? null), error: null };
      };
      b.then = (resolve: (v: unknown) => unknown) => resolve(answer());
      return b;
    },
  };
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => client() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => client() }));
import { getBot, getLeaderboard, getMatch, getMatches, getMyBot } from "@/features/ladder/queries";

const SAVED = { v: 1, head: 5, eyes: 1, antenna: 3, mouth: 3, pattern: 2, signature: 4 };

const ladderRow = (over: Record<string, unknown>) => ({
  rank: 1, bot_id: "b1", name: "ash_bot", handle: "23bcs042", owner_name: "Ashutosh Kumar", is_house: false,
  elo: 1500, games: 3, sigma: 100, conservative: 1300, active_version: 1, active_since: "2026-10-15T00:00:00Z",
  appearance: null,
  ...over,
});

const seat = (slot: number, appearance: unknown) => ({
  slot, submission_id: null, placement: slot + 1, coverage: 10, deaths: 0, strikes: 0, crashed: false,
  elo_before: 1500, elo_after: 1500, bots: { name: `bot_${slot}`, is_house: false, banned: false, appearance },
});

const match = (players: unknown[]) => ({
  id: 7, round_id: 1, seed: 42, status: "done", error: null, replay_path: null,
  created_at: "2026-10-15T00:00:00Z", started_at: null, finished_at: null, match_players: players,
});

beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k];
  selects.length = 0;
});

describe("bot appearance", () => {
  it("the leaderboard carries each row's saved character, or null", async () => {
    rows.leaderboard = [
      ladderRow({ appearance: SAVED }),
      ladderRow({ bot_id: "b2", name: "plain", rank: 2 }),
      ladderRow({ bot_id: "b3", name: "odd", rank: 3, appearance: { v: 2, head: 1 } }),
    ];
    const [saved, plain, odd] = await getLeaderboard();
    expect(saved.appearance).toEqual(SAVED);
    expect(plain.appearance).toBeNull();
    expect(odd.appearance).toBeNull(); // unknown shape: drawn from the name instead
  });

  it("a bot page reads the saved character", async () => {
    rows.bots = { id: "b1", name: "ash_bot", is_house: false, banned: false, elo: 1500, games: 3, active_version: 1,
      active_since: null, appearance: SAVED, profiles: null };
    expect((await getBot("ash_bot"))?.appearance).toEqual(SAVED);
    expect(selects.find((s) => s.table === "bots")?.columns).toContain("appearance");
  });

  it("your bot reads the saved character, null when there is none", async () => {
    rows.bots = { id: "b1", name: "ash_bot", banned: false, active_version: 1, appearance: SAVED, bot_name_aliases: [] };
    expect((await getMyBot("u1"))?.appearance).toEqual(SAVED);
    rows.bots = { id: "b1", name: "ash_bot", banned: false, active_version: 1, appearance: null, bot_name_aliases: [] };
    expect((await getMyBot("u1"))?.appearance).toBeNull();
    expect(selects.find((s) => s.table === "bots")?.columns).toContain("appearance");
  });

  it("match seats carry their bot's saved character", async () => {
    rows.matches = [match([seat(0, SAVED), seat(1, null), seat(2, "not a genome")])];
    const { matches } = await getMatches({ page: 1, pageSize: 10 });
    expect(matches[0].seats.map((s) => s.appearance)).toEqual([SAVED, null, null]);
    expect(selects.find((s) => s.table === "matches")?.columns).toContain("bots(name, is_house, appearance)");

    rows.matches = match([seat(0, SAVED), seat(1, null)]);
    const detail = await getMatch(7);
    expect(detail?.seats.map((s) => s.appearance)).toEqual([SAVED, null]);
  });
});
