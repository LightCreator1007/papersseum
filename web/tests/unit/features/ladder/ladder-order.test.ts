import { describe, expect, it } from "vitest";
import { LADDER_WINDOW, sortLadder, windowLadder, type Orderable } from "@/features/ladder/ladder-order";

const row = (botId: string, rank: number, games: number, activeSince: string | null, name = botId): Orderable => ({
  botId, rank, games, activeSince, name,
});

describe("sortLadder", () => {
  it("keeps rank order first", () => {
    const out = sortLadder([row("b", 2, 50, "2026-10-01T00:00:00Z"), row("a", 1, 1, "2026-10-10T00:00:00Z")]);
    expect(out.map((r) => r.botId)).toEqual(["a", "b"]);
  });

  it("breaks a tie by games played, more first", () => {
    const out = sortLadder([row("few", 3, 4, "2026-10-01T00:00:00Z"), row("many", 3, 40, "2026-10-09T00:00:00Z")]);
    expect(out.map((r) => r.botId)).toEqual(["many", "few"]);
  });

  it("then by age, older bot first", () => {
    const out = sortLadder([row("new", 3, 10, "2026-10-09T00:00:00Z"), row("old", 3, 10, "2026-10-01T00:00:00Z")]);
    expect(out.map((r) => r.botId)).toEqual(["old", "new"]);
  });

  it("puts a bot with no start date after dated ones", () => {
    const out = sortLadder([row("none", 3, 10, null), row("dated", 3, 10, "2026-10-09T00:00:00Z")]);
    expect(out.map((r) => r.botId)).toEqual(["dated", "none"]);
  });

  it("then by name so the order is stable", () => {
    const out = sortLadder([row("2", 3, 10, null, "zeta"), row("1", 3, 10, null, "alpha")]);
    expect(out.map((r) => r.name)).toEqual(["alpha", "zeta"]);
  });

  it("does not mutate its input", () => {
    const input = [row("b", 2, 0, null), row("a", 1, 0, null)];
    sortLadder(input);
    expect(input[0].botId).toBe("b");
  });
});

describe("windowLadder", () => {
  const ladder = (n: number) => Array.from({ length: n }, (_, i) => ({ botId: `bot${i + 1}` }));

  it("shows everything at or under the window", () => {
    const w = windowLadder(ladder(LADDER_WINDOW), { mine: null, showAll: false });
    expect(w.rows).toHaveLength(LADDER_WINDOW);
    expect(w.hidden).toBe(0);
    expect(w.pinned).toBeNull();
  });

  it("cuts 200 bots to the top 100", () => {
    const w = windowLadder(ladder(200), { mine: null, showAll: false });
    expect(w.rows).toHaveLength(100);
    expect(w.rows.at(-1)?.botId).toBe("bot100");
    expect(w.hidden).toBe(100);
    expect(w.total).toBe(200);
  });

  it("pins your own row when it ranks below the window", () => {
    const w = windowLadder(ladder(200), { mine: "bot150", showAll: false });
    expect(w.pinned?.botId).toBe("bot150");
    expect(w.rows.some((r) => r.botId === "bot150")).toBe(false);
    expect(w.hidden).toBe(99);
  });

  it("doesn't pin a row that is already in the window", () => {
    const w = windowLadder(ladder(200), { mine: "bot7", showAll: false });
    expect(w.pinned).toBeNull();
  });

  it("shows every row when asked", () => {
    const w = windowLadder(ladder(200), { mine: "bot150", showAll: true });
    expect(w.rows).toHaveLength(200);
    expect(w.pinned).toBeNull();
    expect(w.hidden).toBe(0);
  });

  it("handles an empty ladder", () => {
    expect(windowLadder([], { mine: "x", showAll: false })).toEqual({ rows: [], pinned: null, hidden: 0, total: 0 });
  });
});
