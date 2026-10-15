import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const maybeSingle = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) }),
}));
vi.mock("@/lib/supabase/server", () => ({ getUserId: vi.fn(async () => "u1") }));
const persona = vi.hoisted(() => ({ current: null as string | null }));
vi.mock("@/lib/dev-auth", () => ({
  DEV_PERSONAS: { organiser: { userId: "dev-organiser" } },
  devPersona: async () => persona.current,
}));
import { getUserId } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/server/admin";

beforeEach(() => { maybeSingle.mockReset(); persona.current = null; });

describe("requireAdmin", () => {
  it("refuses a signed-out visitor without querying", async () => {
    vi.mocked(getUserId).mockResolvedValueOnce(null);
    expect(await requireAdmin()).toMatchObject({ ok: false, reason: "forbidden" });
    expect(maybeSingle).not.toHaveBeenCalled();
  });
  it("refuses a signed-in non-admin", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await requireAdmin()).toMatchObject({ ok: false, reason: "forbidden" });
  });
  it("refuses, and does not grant, when the lookup errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    maybeSingle.mockResolvedValueOnce({ data: null, error: { code: "XX000" } });
    expect(await requireAdmin()).toMatchObject({ ok: false, reason: "error" });
    spy.mockRestore();
  });
  it("lets an admin through", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { user_id: "u1" }, error: null });
    expect(await requireAdmin()).toEqual({ ok: true, data: { userId: "u1" } });
  });
});

describe("requireAdmin with the dev login", () => {
  it("lets the organiser persona through without asking the database", async () => {
    persona.current = "organiser";
    expect(await requireAdmin()).toMatchObject({ ok: true, data: { userId: "dev-organiser" } });
    expect(maybeSingle).not.toHaveBeenCalled();
  });
  it("refuses every other persona without asking the database", async () => {
    persona.current = "player";
    expect(await requireAdmin()).toMatchObject({ ok: false, reason: "forbidden" });
    expect(maybeSingle).not.toHaveBeenCalled();
  });
});
