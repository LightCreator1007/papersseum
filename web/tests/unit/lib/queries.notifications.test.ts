import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ rpc })) }));
import { getEmailOptIn, getNotifications } from "@/features/ladder/queries";

beforeEach(() => rpc.mockReset());

describe("getNotifications", () => {
  it("maps rows from my_notifications", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ id: 1, kind: "submission_passed", payload: { version: 2 }, created_at: "2026-10-15T10:00:00Z", read_at: null }],
      error: null,
    });
    expect(await getNotifications(10)).toEqual({
      available: true,
      error: null,
      items: [{ id: 1, kind: "submission_passed", payload: { version: 2 }, createdAt: "2026-10-15T10:00:00Z", readAt: null }],
    });
    expect(rpc).toHaveBeenCalledWith("my_notifications", { p_limit: 10 });
  });
  it("is unavailable, with no error and no log, when the function isn't deployed", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    expect(await getNotifications()).toEqual({ items: [], available: false, error: null });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  it("reports a failed read instead of an empty inbox, and logs it", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "boom" } });
    expect(await getNotifications()).toEqual({ items: [], available: true, error: "Couldn't load your inbox. Try again in a minute." });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
  it("reports and logs a permission failure too", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    expect(await getNotifications()).toMatchObject({ available: true, error: "Couldn't load your inbox. Try again in a minute." });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("getEmailOptIn", () => {
  it("reads the saved choice from my_settings", async () => {
    rpc.mockResolvedValueOnce({ data: [{ email_opt_in: true }], error: null });
    expect(await getEmailOptIn()).toBe(true);
    expect(rpc).toHaveBeenCalledWith("my_settings", {});
  });
  it("is off when nothing is saved", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await getEmailOptIn()).toBe(false);
  });
  it("is off when the function isn't deployed", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    expect(await getEmailOptIn()).toBe(false);
  });
});
