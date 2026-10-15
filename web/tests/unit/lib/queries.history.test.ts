import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { table: string; in: boolean; range: [number, number] | null };
const calls = vi.hoisted(() => [] as Call[]);
const data = vi.hoisted(() => ({ mine: [] as unknown[], others: (() => []) as (ids: number[]) => unknown[] }));
const failAt = vi.hoisted(() => ({ page: -1 }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const state: Call = { table, in: false, range: null };
      let ids: number[] = [];
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "neq", "order"]) b[m] = () => b;
      b.in = (_col: string, v: number[]) => { state.in = true; ids = v; return b; };
      b.range = async (from: number, to: number) => {
        state.range = [from, to];
        calls.push({ ...state });
        const rows = state.in ? data.others(ids) : data.mine;
        if (calls.length - 1 === failAt.page) return { data: null, error: { message: "boom" } };
        return { data: rows.slice(from, to + 1), error: null };
      };
      return b;
    },
  }),
}));
import { getSubmissionHistory } from "@/features/ladder/queries";

const seat = (id: number) => ({
  match_id: id, submission_id: "s1", placement: 2, coverage: 0.3, crashed: false, elo_before: 1500, elo_after: 1510,
  matches: { status: "done", finished_at: new Date(Date.UTC(2026, 9, 1, 0, id)).toISOString() },
  submissions: { version: 1 },
});

beforeEach(() => {
  calls.length = 0;
  failAt.page = -1;
  data.others = (ids) => ids.map((id) => ({ match_id: id, placement: 1, bots: { name: "house_greedy_1", is_house: true } }));
});

describe("getSubmissionHistory", () => {
  it("pages past 1000 rows so the newest matches are kept", async () => {
    data.mine = Array.from({ length: 1003 }, (_, i) => seat(i + 1));
    const rows = await getSubmissionHistory("bot-1");
    expect(rows).toHaveLength(1003);
    expect(rows[1002].matchId).toBe(1003);
    const mine = calls.filter((c) => !c.in);
    expect(mine.map((c) => c.range)).toEqual([[0, 999], [1000, 1999]]);
  });
  it("stops after one request when the first page is short", async () => {
    data.mine = Array.from({ length: 3 }, (_, i) => seat(i + 1));
    await getSubmissionHistory("bot-1");
    expect(calls.filter((c) => !c.in)).toHaveLength(1);
  });
  it("also pages the opponent lookup", async () => {
    data.mine = Array.from({ length: 2 }, (_, i) => seat(i + 1));
    data.others = (ids) => ids.flatMap((id) => Array.from({ length: 600 }, () => ({ match_id: id, placement: 3, bots: { name: "x", is_house: false } })));
    const rows = await getSubmissionHistory("bot-1");
    expect(calls.filter((c) => c.in).map((c) => c.range)).toEqual([[0, 999], [1000, 1999]]);
    expect(rows[0].opponents).toHaveLength(600);
  });
  it("assembles opponents and drops unfinished seats", async () => {
    data.mine = [seat(1), { ...seat(2), placement: null }];
    data.others = (ids) => ids.map((id) => ({ match_id: id, placement: 1, bots: { name: "house_greedy_1", is_house: true } }));
    const rows = await getSubmissionHistory("bot-1");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ matchId: 1, version: 1, opponents: [{ name: "house_greedy_1", isHouse: true, placement: 1 }] });
  });
  it("throws and logs when a later page fails, rather than returning a partial history", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    data.mine = Array.from({ length: 1003 }, (_, i) => seat(i + 1));
    failAt.page = 1;
    await expect(getSubmissionHistory("bot-1")).rejects.toThrow("Couldn't load");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
