import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const update = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc,
    from: () => ({ update: (v: unknown) => ({ eq: async (...a: unknown[]) => update(v, ...a) }), select: () => ({ limit: () => ({ single: async () => ({ data: { id: 1 }, error: null }) }) }) }),
  }),
}));
const requireAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/admin", () => ({ requireAdmin }));
const persona = vi.hoisted(() => ({ current: null as string | null }));
vi.mock("@/lib/dev-auth", () => ({ devPersona: async () => persona.current }));
import { banForm, freezeForm, requeueForm, requeueJob, setBotBanned, setSeasonFrozen } from "@/app/admin/actions";

beforeEach(() => { update.mockReset().mockResolvedValue({ error: null }); rpc.mockReset(); requireAdmin.mockReset(); persona.current = null; });

describe("admin actions", () => {
  it.each([
    ["setSeasonFrozen", () => setSeasonFrozen(true)],
    ["setBotBanned", () => setBotBanned("6f1c1f1e-1111-4111-8111-111111111111", true)],
    ["requeueJob", () => requeueJob(5)],
  ])("%s writes nothing for a non-admin", async (_n, run) => {
    requireAdmin.mockResolvedValueOnce({ ok: false, reason: "forbidden", message: "nope" });
    expect(await run()).toMatchObject({ ok: false, reason: "forbidden" });
    expect(update).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("freezes the season", async () => {
    requireAdmin.mockResolvedValueOnce({ ok: true, data: { userId: "u1" } });
    expect(await setSeasonFrozen(true)).toEqual({ ok: true, message: "Uploads are frozen. Matches keep running." });
    expect(update).toHaveBeenCalledWith({ frozen: true }, "id", 1);
  });
  it("bans a bot", async () => {
    requireAdmin.mockResolvedValueOnce({ ok: true, data: { userId: "u1" } });
    const id = "6f1c1f1e-1111-4111-8111-111111111111";
    expect((await setBotBanned(id, true)).ok).toBe(true);
    expect(update).toHaveBeenCalledWith({ banned: true }, "id", id);
  });
  it("rejects a malformed bot id", async () => {
    requireAdmin.mockResolvedValueOnce({ ok: true, data: { userId: "u1" } });
    expect(await setBotBanned("nope", true)).toMatchObject({ ok: false, reason: "invalid" });
    expect(update).not.toHaveBeenCalled();
  });
  it("requeues through the database function", async () => {
    requireAdmin.mockResolvedValueOnce({ ok: true, data: { userId: "u1" } });
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect((await requeueJob(5)).ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("admin_requeue_job", { p_job: 5 });
  });
  it("says requeue isn't available when the function isn't deployed", async () => {
    requireAdmin.mockResolvedValueOnce({ ok: true, data: { userId: "u1" } });
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    expect(await requeueJob(5)).toMatchObject({ ok: false, reason: "unavailable" });
  });
  it("rejects a bad job id", async () => {
    requireAdmin.mockResolvedValueOnce({ ok: true, data: { userId: "u1" } });
    expect(await requeueJob(0)).toMatchObject({ ok: false, reason: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("admin actions with the dev login", () => {
  it.each([
    ["setSeasonFrozen", () => setSeasonFrozen(true)],
    ["setBotBanned", () => setBotBanned("6f1c1f1e-1111-4111-8111-111111111111", true)],
    ["requeueJob", () => requeueJob(5)],
  ])("%s says nothing was saved and writes nothing", async (_n, run) => {
    persona.current = "organiser";
    requireAdmin.mockResolvedValueOnce({ ok: true, data: { userId: "dev" } });
    expect(await run()).toEqual({ ok: true, message: "Dev login, so nothing was saved." });
    expect(update).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("admin form entry points", () => {
  const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
  const idle = { ok: true, message: "" };
  it("reads frozen from the form", async () => {
    requireAdmin.mockResolvedValueOnce({ ok: true, data: { userId: "u1" } });
    await freezeForm(idle, form({ frozen: "true" }));
    expect(update).toHaveBeenCalledWith({ frozen: true }, "id", 1);
  });
  it("rejects a ban form without a bot id", async () => {
    requireAdmin.mockResolvedValueOnce({ ok: true, data: { userId: "u1" } });
    expect(await banForm(idle, form({ banned: "true" }))).toMatchObject({ ok: false, reason: "invalid" });
  });
  it("rejects a requeue form with a non-numeric job", async () => {
    requireAdmin.mockResolvedValueOnce({ ok: true, data: { userId: "u1" } });
    expect(await requeueForm(idle, form({ job: "abc" }))).toMatchObject({ ok: false, reason: "invalid" });
  });
});
