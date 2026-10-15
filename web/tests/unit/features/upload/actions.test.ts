import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  getUserId: vi.fn(async () => "user-1"),
  createClient: vi.fn(async () => ({ rpc })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
import { getUserId } from "@/lib/supabase/server";
import { genomeFromSeed } from "@/lib/character/genome";
import { markNotificationsRead, renameBot, saveAppearance, setActiveSubmission, setEmailOptIn, uploadBot } from "@/features/upload/actions";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const empty = { ok: false, message: "" };

beforeEach(() => rpc.mockReset());

describe("renameBot", () => {
  it("refuses without a session and calls nothing", async () => {
    vi.mocked(getUserId).mockResolvedValueOnce(null);
    expect(await renameBot(empty, form({ name: "neo" }))).toMatchObject({ ok: false, reason: "forbidden" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("validates before calling the database", async () => {
    expect(await renameBot(empty, form({ name: "x" }))).toMatchObject({ ok: false, reason: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("renames", async () => {
    rpc.mockResolvedValueOnce({ data: { name: "neo" }, error: null });
    expect(await renameBot(empty, form({ name: "Neo" }))).toEqual({ ok: true, message: "Renamed to neo. Old links still work." });
    expect(rpc).toHaveBeenCalledWith("rename_bot", { p_new_name: "neo" });
  });
  it("reads the first row when rename_bot returns a table", async () => {
    rpc.mockResolvedValueOnce({ data: [{ name: "neo" }], error: null });
    expect(await renameBot(empty, form({ name: "Neo" }))).toEqual({ ok: true, message: "Renamed to neo. Old links still work." });
  });
  it("falls back to the requested name when the table comes back empty", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await renameBot(empty, form({ name: "Neo" }))).toEqual({ ok: true, message: "Renamed to neo. Old links still work." });
  });
  it("explains a taken name", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "23505" } });
    expect(await renameBot(empty, form({ name: "neo" }))).toMatchObject({ ok: false, reason: "conflict", message: "Someone already has that name." });
  });
  it("explains the once-a-season limit", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PS005", message: "raw" } });
    expect((await renameBot(empty, form({ name: "neo" }))).message).toBe("You've already renamed your bot this season.");
  });
  it("says when the database function isn't deployed", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    expect(await renameBot(empty, form({ name: "neo" }))).toMatchObject({ ok: false, reason: "unavailable" });
  });
});

describe("uploadBot", () => {
  it("asks for sign-in with a link flag when the session has expired", async () => {
    vi.mocked(getUserId).mockResolvedValueOnce(null);
    const f = new FormData();
    f.set("file", new File(["class Agent: pass"], "agent.py"));
    expect(await uploadBot({ ok: false, message: null }, f)).toEqual({
      ok: false,
      message: "Your session expired. Sign in again to upload.",
      signIn: true,
    });
  });
  it("refuses a notebook with the export hint", async () => {
    const f = new FormData();
    f.set("file", new File(["{}"], "agent.ipynb"));
    expect((await uploadBot({ ok: false, message: null }, f)).message).toMatch(/^Notebooks can't run here\./);
  });
});

describe("setActiveSubmission", () => {
  it("rejects a missing id", async () => {
    expect(await setActiveSubmission(empty, form({}))).toMatchObject({ ok: false, reason: "invalid" });
  });
  it("tells you when the version must be re-checked first", async () => {
    rpc.mockResolvedValueOnce({ data: { status: "revalidating" }, error: null });
    const r = await setActiveSubmission(empty, form({ submission_id: "6f1c1f1e-1111-4111-8111-111111111111" }));
    expect(r).toEqual({ ok: true, message: "The engine changed since this version passed, so it's being re-checked. It goes live if it passes." });
  });
  it("reads the first row when set_active_submission returns a table", async () => {
    rpc.mockResolvedValueOnce({ data: [{ status: "revalidating" }], error: null });
    const r = await setActiveSubmission(empty, form({ submission_id: "6f1c1f1e-1111-4111-8111-111111111111" }));
    expect(r.message).toMatch(/being re-checked/);
    rpc.mockResolvedValueOnce({ data: [{ status: "active" }], error: null });
    const r2 = await setActiveSubmission(empty, form({ submission_id: "6f1c1f1e-1111-4111-8111-111111111111" }));
    expect(r2).toEqual({ ok: true, message: "That version plays from the next round." });
  });
  it("confirms an immediate switch", async () => {
    rpc.mockResolvedValueOnce({ data: { status: "active" }, error: null });
    const r = await setActiveSubmission(empty, form({ submission_id: "6f1c1f1e-1111-4111-8111-111111111111" }));
    expect(r).toEqual({ ok: true, message: "That version plays from the next round." });
  });
  it("says when the database function isn't deployed", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42883" } });
    const r = await setActiveSubmission(empty, form({ submission_id: "6f1c1f1e-1111-4111-8111-111111111111" }));
    expect(r).toMatchObject({ ok: false, reason: "unavailable" });
  });
});

describe("saveAppearance", () => {
  it("rejects malformed JSON without calling the database", async () => {
    expect(await saveAppearance(empty, form({ appearance: "{" }))).toMatchObject({ ok: false, reason: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects a genome with an unknown part without calling the database", async () => {
    expect(await saveAppearance(empty, form({ appearance: JSON.stringify({ v: 1, body: 9999 }) }))).toMatchObject({ ok: false, reason: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("saves a valid genome", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    const genome = genomeFromSeed("neo");
    expect(await saveAppearance(empty, form({ appearance: JSON.stringify(genome) }))).toMatchObject({ ok: true });
    expect(rpc).toHaveBeenCalledWith("set_bot_appearance", { p_appearance: genome });
  });
  it("says when the database function isn't deployed", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    expect(await saveAppearance(empty, form({ appearance: JSON.stringify(genomeFromSeed("neo")) }))).toMatchObject({ ok: false, reason: "unavailable" });
  });
});

describe("setEmailOptIn", () => {
  it("sends a boolean", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await setEmailOptIn(empty, form({ opt_in: "on" }));
    expect(rpc).toHaveBeenCalledWith("set_email_opt_in", { p_opt_in: true });
  });
  it("sends false when the box is cleared", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await setEmailOptIn(empty, form({}));
    expect(rpc).toHaveBeenCalledWith("set_email_opt_in", { p_opt_in: false });
  });
  it("says when the database function isn't deployed", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    expect(await setEmailOptIn(empty, form({ opt_in: "on" }))).toMatchObject({ ok: false, reason: "unavailable" });
  });
});

describe("markNotificationsRead", () => {
  it("does nothing for an empty list", async () => {
    expect(await markNotificationsRead([])).toEqual({ ok: true, message: "" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("drops non-integer ids", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await markNotificationsRead([1, 2.5, -3, 4]);
    expect(rpc).toHaveBeenCalledWith("mark_notifications_read", { p_ids: [1, 4] });
  });
  it("says when the database function isn't deployed", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    expect(await markNotificationsRead([1])).toMatchObject({ ok: false, reason: "unavailable" });
  });
});
