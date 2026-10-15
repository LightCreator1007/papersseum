import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createSubmission } from "@/features/upload/upload";
import {
  CONCURRENT_UPLOAD_MESSAGE,
  GENERIC_UPLOAD_ERROR,
  NO_BOT_MESSAGE,
  STORAGE_DOWN_MESSAGE,
} from "@/features/upload/upload-rules";
import { fakeDb } from "./fake-db";

const file = { name: "agent.py", bytes: new TextEncoder().encode("class Agent:\n    pass\n") };
const NOW = Date.parse("2026-10-15T12:00:00Z");

function admin(tables: Parameters<typeof fakeDb>[0], rpcResult: { data: unknown; error: unknown }, storageError: unknown = null) {
  const db = fakeDb(tables);
  const upload = vi.fn(async () => ({ data: storageError ? null : {}, error: storageError }));
  const remove = vi.fn(async () => ({ data: [], error: null }));
  const rpc = vi.fn(async () => rpcResult);
  const client = { from: db.from, rpc, storage: { from: () => ({ upload, remove }) } };
  return { client: client as unknown as SupabaseClient<Database>, upload, remove, rpc, calls: db.calls };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("createSubmission", () => {
  it("uploads and returns the new version", async () => {
    const a = admin({ bots: [{ data: { id: "b1" } }], submissions: [{ data: [] }] }, { data: { version: 4 }, error: null });
    expect(await createSubmission(a.client, "u1", file, () => NOW)).toEqual({ ok: true, version: 4 });
    expect(a.upload).toHaveBeenCalledOnce();
  });

  it("refuses an identical file before storing it or spending the cooldown", async () => {
    const a = admin(
      { bots: [{ data: { id: "b1" } }], submissions: [{ data: [{ version: 3, status: "active", error: null }] }] },
      { data: null, error: null },
    );
    expect(await createSubmission(a.client, "u1", file, () => NOW)).toEqual({
      ok: false,
      message: "Identical to v3. Nothing uploaded, and your cooldown wasn't used.",
    });
    expect(a.upload).not.toHaveBeenCalled();
    expect(a.rpc).not.toHaveBeenCalled();
    const dup = a.calls.find((c) => c.table === "submissions")!;
    expect(dup.ops).toContainEqual(["eq", ["bot_id", "b1"]]);
    expect(dup.ops.some(([op, args]) => op === "eq" && args[0] === "sha256" && /^[0-9a-f]{64}$/.test(String(args[1])))).toBe(true);
  });

  it("still uploads when the duplicate check can't be read", async () => {
    const a = admin({ bots: [{ data: { id: "b1" } }], submissions: [{ error: { message: "timeout" } }] }, { data: { version: 2 }, error: null });
    expect(await createSubmission(a.client, "u1", file, () => NOW)).toEqual({ ok: true, version: 2 });
  });

  it("names a missing bot", async () => {
    const a = admin({ bots: [{ data: null }] }, { data: null, error: null });
    expect(await createSubmission(a.client, "u1", file)).toEqual({ ok: false, message: NO_BOT_MESSAGE });
    expect(a.upload).not.toHaveBeenCalled();
  });

  it("keeps the generic copy when the bot can't be read", async () => {
    const a = admin({ bots: [{ error: { message: "db down" } }] }, { data: null, error: null });
    expect(await createSubmission(a.client, "u1", file)).toEqual({ ok: false, message: GENERIC_UPLOAD_ERROR });
  });

  it("says storage is down, separately from a missing bot", async () => {
    const a = admin({ bots: [{ data: { id: "b1" } }], submissions: [{ data: [] }] }, { data: null, error: null }, { message: "503" });
    expect(await createSubmission(a.client, "u1", file)).toEqual({ ok: false, message: STORAGE_DOWN_MESSAGE });
    expect(a.rpc).not.toHaveBeenCalled();
  });

  it("tells a second tab that another upload just started", async () => {
    const a = admin(
      {
        bots: [{ data: { id: "b1" } }],
        submissions: [{ data: [] }, { data: { created_at: new Date(NOW - 4_000).toISOString() } }],
      },
      { data: null, error: { code: "PS004", message: "Please wait 00:09:56 before submitting again" } },
    );
    expect(await createSubmission(a.client, "u1", file, () => NOW)).toEqual({ ok: false, message: CONCURRENT_UPLOAD_MESSAGE });
    expect(a.remove).toHaveBeenCalledOnce();
  });

  it("keeps the cooldown copy when the last upload is older", async () => {
    const a = admin(
      {
        bots: [{ data: { id: "b1" } }],
        submissions: [{ data: [] }, { data: { created_at: new Date(NOW - 6 * 60_000).toISOString() } }],
      },
      { data: null, error: { code: "PS004", message: "Please wait 00:04:00 before submitting again" } },
    );
    expect(await createSubmission(a.client, "u1", file, () => NOW)).toEqual({ ok: false, message: "You can upload again in 4 min." });
  });

  it("refuses a notebook before touching the database", async () => {
    const a = admin({}, { data: null, error: null });
    const r = await createSubmission(a.client, "u1", { name: "agent.ipynb", bytes: file.bytes });
    expect(r).toMatchObject({ ok: false, message: expect.stringContaining("Notebooks can't run here") });
    expect(a.calls).toHaveLength(0);
  });
});
