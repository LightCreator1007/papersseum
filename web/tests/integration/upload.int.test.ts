// Runs against the local Supabase stack (supabase start). Creates throwaway
// users through the admin API and removes them afterwards.
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { createSubmission } from "@/features/upload/upload";

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI passes the variables directly
}

const admin = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SOURCE = new TextEncoder().encode("class Agent:\n    def act(self, obs):\n        return 0\n");
const users: string[] = [];
const stored: string[] = [];

async function newPlayer() {
  const email = `upload-test-${crypto.randomUUID().slice(0, 8)}@iiitdmj.ac.in`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  const { data: bot, error: botError } = await admin.from("bots").select("id").eq("owner_id", data.user.id).single();
  if (botError) throw botError;
  return { userId: data.user.id, botId: bot.id, email };
}

// A publishable-key client signed in as the user. Email sign-up is disabled, so the
// session comes from an admin-issued magic link.
async function signedInClient(email: string) {
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const client = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: otpError } = await client.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (otpError) throw otpError;
  return client;
}

async function filesOf(botId: string) {
  const { data, error } = await admin.storage.from("agents").list(botId);
  if (error) throw error;
  return data.map((f) => f.name);
}

afterAll(async () => {
  await admin.from("season").update({ frozen: false }).eq("id", 1);
  if (stored.length) await admin.storage.from("agents").remove(stored);
  for (const id of users) await admin.auth.admin.deleteUser(id);
});

describe("createSubmission", () => {
  it("stores the file, records the submission and queues validation", async () => {
    const { userId, botId } = await newPlayer();
    const result = await createSubmission(admin, userId, { name: "agent.py", bytes: SOURCE });
    expect(result).toEqual({ ok: true, version: 1 });

    const { data: sub } = await admin
      .from("submissions").select("id, storage_path, sha256, size_bytes, status").eq("bot_id", botId).single();
    stored.push(sub!.storage_path!);
    expect(sub!.storage_path).toBe(`${botId}/${sub!.id}.py`);
    expect(sub!.status).toBe("pending");
    expect(sub!.size_bytes).toBe(SOURCE.byteLength);
    expect(sub!.sha256).toMatch(/^[0-9a-f]{64}$/);

    const { data: file } = await admin.storage.from("agents").download(sub!.storage_path!);
    expect(new Uint8Array(await file!.arrayBuffer())).toEqual(SOURCE);

    const { data: jobs } = await admin.from("jobs").select("kind").eq("submission_id", sub!.id);
    expect(jobs).toEqual([{ kind: "validate" }]);
  });

  it("refuses a second upload inside the cooldown and deletes its file", async () => {
    const { userId, botId } = await newPlayer();
    const first = await createSubmission(admin, userId, { name: "agent.py", bytes: SOURCE });
    expect(first.ok).toBe(true);
    const [kept] = await filesOf(botId);
    stored.push(`${botId}/${kept}`);

    const second = await createSubmission(admin, userId, { name: "agent.py", bytes: SOURCE });
    expect(second).toEqual({ ok: false, message: expect.stringMatching(/^You can upload again in .+\.$/) });
    expect(await filesOf(botId)).toEqual([kept]);
  });

  it("refuses uploads while the season is frozen and leaves nothing behind", async () => {
    const { userId, botId } = await newPlayer();
    await admin.from("season").update({ frozen: true }).eq("id", 1);
    try {
      const result = await createSubmission(admin, userId, { name: "agent.py", bytes: SOURCE });
      expect(result).toEqual({ ok: false, message: "Submissions are closed for this season." });
      expect(await filesOf(botId)).toEqual([]);
    } finally {
      await admin.from("season").update({ frozen: false }).eq("id", 1);
    }
  });

  it("refuses binary data before touching storage", async () => {
    const { userId, botId } = await newPlayer();
    const result = await createSubmission(admin, userId, { name: "agent.py", bytes: new Uint8Array([0xff, 0x00, 0x81]) });
    expect(result).toEqual({ ok: false, message: "That file isn't readable text. Upload the .py source file." });
    expect(await filesOf(botId)).toEqual([]);
  });

  it("hides one user's submissions from another signed-in user", async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    const result = await createSubmission(admin, a.userId, { name: "agent.py", bytes: SOURCE });
    expect(result.ok).toBe(true);
    const [name] = await filesOf(a.botId);
    stored.push(`${a.botId}/${name}`);

    const asB = await signedInClient(b.email);
    const { data: seenByB, error } = await asB.from("submissions").select("id").eq("bot_id", a.botId);
    expect(error).toBeNull();
    expect(seenByB).toEqual([]);

    // Sanity check: the rows exist, and the owner can read them.
    const asA = await signedInClient(a.email);
    const { data: seenByA } = await asA.from("submissions").select("id").eq("bot_id", a.botId);
    expect(seenByA).toHaveLength(1);
  });
});
