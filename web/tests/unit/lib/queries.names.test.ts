import { beforeEach, describe, expect, it, vi } from "vitest";

// Rows each table answers with; every query on a table gets the same rows.
const rows = vi.hoisted(() => ({}) as Record<string, unknown>);
const selects = vi.hoisted(() => [] as { table: string; columns: string }[]);

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const answer = () => ({ data: rows[table] ?? null, error: null });
      const b: Record<string, unknown> = {};
      for (const m of ["eq", "order", "limit"]) b[m] = () => b;
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
  }),
}));
import { getBot, getLeaderboard, getMyBot, getProfileName } from "@/features/ladder/queries";

const ladderRow = (over: Record<string, unknown>) => ({
  rank: 1, bot_id: "b1", name: "ash_bot", handle: "23bcs042", owner_name: "Ashutosh Kumar", is_house: false,
  elo: 1500, games: 3, sigma: 100, conservative: 1300, active_version: 1, active_since: "2026-10-15T00:00:00Z",
  ...over,
});

beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k];
  selects.length = 0;
});

describe("owner names", () => {
  it("the leaderboard shows the Google name, never the handle", async () => {
    rows.leaderboard = [ladderRow({}), ladderRow({ bot_id: "h1", name: "house_greedy_1", handle: null, owner_name: null, is_house: true, rank: 2 })];
    const [player, house] = await getLeaderboard();
    expect(player.owner).toBe("Ashutosh Kumar");
    expect(house.owner).toBeNull();
  });

  it("a bot page names its owner, or says the account has no name", async () => {
    rows.bots = { id: "b1", name: "ash_bot", is_house: false, banned: false, elo: 1500, games: 3, active_version: 1,
      active_since: null, profiles: { display_name: "Ashutosh Kumar" } };
    expect((await getBot("ash_bot"))?.owner).toBe("Ashutosh Kumar");
    rows.bots = { ...(rows.bots as object), profiles: { display_name: null } };
    expect((await getBot("ash_bot"))?.owner).toBe("an unnamed player");
    rows.bots = { ...(rows.bots as object), profiles: null };
    expect((await getBot("ash_bot"))?.owner).toBeNull();
  });

  it("reads the profile's display name", async () => {
    rows.profiles = { display_name: "Riya Sen" };
    expect(await getProfileName("u1")).toBe("Riya Sen");
    expect(selects).toContainEqual({ table: "profiles", columns: "display_name" });
  });
});

describe("getMyBot renamedFrom", () => {
  it("is the old name once the season's rename is used", async () => {
    rows.bots = { id: "b1", name: "ash_bot", banned: false, active_version: 1, bot_name_aliases: [{ old_name: "23bcs042" }] };
    expect((await getMyBot("u1"))?.renamedFrom).toBe("23bcs042");
  });

  it("is null while the rename is unused", async () => {
    rows.bots = { id: "b1", name: "23bcs042", banned: false, active_version: null, bot_name_aliases: [] };
    expect((await getMyBot("u1"))?.renamedFrom).toBeNull();
  });
});
