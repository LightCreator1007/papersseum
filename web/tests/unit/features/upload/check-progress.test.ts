import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "./fake-db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getUserId: vi.fn(async () => "user-1") }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/dev-fixtures", () => ({
  isDevSubmissionId: () => false,
  devCheckProgress: () => null,
  devBot: () => null,
  devSubmissions: () => [],
}));
import { getUserId } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadCheckProgress } from "@/features/upload/check-progress";

const SUB = "6f1c1f1e-1111-4111-8111-111111111111";

function useDb(tables: Parameters<typeof fakeDb>[0]) {
  const db = fakeDb(tables);
  vi.mocked(createAdminClient).mockReturnValue({ from: db.from } as unknown as ReturnType<typeof createAdminClient>);
  return db;
}

beforeEach(() => vi.mocked(getUserId).mockResolvedValue("user-1"));

describe("loadCheckProgress ownership", () => {
  it("refuses without a session and reads nothing", async () => {
    vi.mocked(getUserId).mockResolvedValueOnce(null);
    const db = useDb({});
    expect(await loadCheckProgress(SUB)).toMatchObject({ ok: false, reason: "forbidden" });
    expect(db.calls).toHaveLength(0);
  });

  it("refuses someone else's submission without reading the queue", async () => {
    const db = useDb({ bots: [{ data: { id: "bot-1" } }], submissions: [{ data: null }] });
    expect(await loadCheckProgress(SUB)).toMatchObject({ ok: false, reason: "forbidden" });
    expect(db.calls.map((c) => c.table)).toEqual(["bots", "submissions"]);
    expect(db.calls[0].ops).toContainEqual(["eq", ["owner_id", "user-1"]]);
    expect(db.calls[1].ops).toContainEqual(["eq", ["id", SUB]]);
    expect(db.calls[1].ops).toContainEqual(["eq", ["bot_id", "bot-1"]]);
  });

  it("refuses a user with no bot", async () => {
    const db = useDb({ bots: [{ data: null }] });
    expect(await loadCheckProgress(SUB)).toMatchObject({ ok: false, reason: "forbidden" });
    expect(db.calls.map((c) => c.table)).toEqual(["bots"]);
  });

  it("reports a failed ownership read as an error, not as someone else's", async () => {
    useDb({ bots: [{ error: { message: "db down" } }] });
    expect(await loadCheckProgress(SUB)).toMatchObject({ ok: false, reason: "error" });
  });

  it("returns the queue position for the owner", async () => {
    useDb({
      bots: [{ data: { id: "bot-1" } }],
      submissions: [{ data: { id: SUB } }],
      jobs: [{ data: { id: 40, status: "queued", attempts: 1, max_attempts: 3 } }, { count: 2 }],
    });
    expect(await loadCheckProgress(SUB)).toEqual({ ok: true, data: { stage: "queued", ahead: 2, attempts: 1, maxAttempts: 3 } });
  });

  it("returns checking once the job is claimed", async () => {
    useDb({
      bots: [{ data: { id: "bot-1" } }],
      submissions: [{ data: { id: SUB } }],
      jobs: [{ data: { id: 40, status: "running", attempts: 2, max_attempts: 3 } }],
    });
    expect(await loadCheckProgress(SUB)).toEqual({ ok: true, data: { stage: "checking", ahead: null, attempts: 2, maxAttempts: 3 } });
  });
});
