import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { callRpc, classify, UNAVAILABLE_MESSAGE } from "@/lib/server/rpc";

const client = (result: { data?: unknown; error?: { code?: string; message?: string } | null }) => ({
  rpc: vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null })),
});

describe("classify", () => {
  it.each(["PGRST202", "42883", "PGRST205", "42P01"])("treats %s as not deployed yet", (code) => {
    expect(classify({ code })).toEqual({ ok: false, reason: "unavailable", message: UNAVAILABLE_MESSAGE });
  });
  it("maps permission errors to forbidden", () => {
    expect(classify({ code: "42501" }).reason).toBe("forbidden");
  });
  it("maps unique violations to conflict", () => {
    expect(classify({ code: "23505" }).reason).toBe("conflict");
  });
  it("uses a caller message for a known code first", () => {
    expect(classify({ code: "PS005", message: "raw" }, { PS005: "You renamed this season already." }))
      .toEqual({ ok: false, reason: "invalid", message: "You renamed this season already." });
  });
  it("passes through the database's own message for other PS codes", () => {
    expect(classify({ code: "PS009", message: "Season is closed" })).toEqual({ ok: false, reason: "invalid", message: "Season is closed" });
  });
  it("hides unknown errors behind a generic message", () => {
    expect(classify({ code: "XX000", message: "secret detail" })).toEqual({
      ok: false, reason: "error", message: "Something went wrong on our side. Try again in a minute.",
    });
  });
});

describe("callRpc", () => {
  it("returns data on success and passes the function name and args through", async () => {
    const c = client({ data: { name: "neo" } });
    await expect(callRpc(c, "rename_bot", { p_new_name: "neo" })).resolves.toEqual({ ok: true, data: { name: "neo" } });
    expect(c.rpc).toHaveBeenCalledWith("rename_bot", { p_new_name: "neo" });
  });
  it("returns unavailable when the function isn't deployed", async () => {
    const r = await callRpc(client({ error: { code: "PGRST202", message: "Could not find the function" } }), "rename_bot", {});
    expect(r).toMatchObject({ ok: false, reason: "unavailable" });
  });
  it("returns error, and logs, when the client throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const c = { rpc: vi.fn(async () => { throw new Error("network"); }) };
    await expect(callRpc(c, "x", {})).resolves.toMatchObject({ ok: false, reason: "error" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
