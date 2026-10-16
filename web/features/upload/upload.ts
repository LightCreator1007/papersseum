// Server only: takes the admin client as an argument so tests can call it
// without a browser session. Flow from supabase/migrations/*_submissions_api.sql:
// upload the file, then api_create_submission; delete the file if refused.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  GENERIC_UPLOAD_ERROR,
  NO_BOT_MESSAGE,
  STORAGE_DOWN_MESSAGE,
  checkFile,
  identicalMessage,
  identicalVersion,
  NOT_TEXT_MESSAGE,
  isUtf8,
  startedJustNow,
  uploadErrorMessage,
} from "@/features/upload/upload-rules";

export type UploadResult = { ok: true; version: number } | { ok: false; message: string };

const EXPECTED_REFUSALS = new Set(["PS001", "PS003", "PS004"]);

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSubmission(
  admin: SupabaseClient<Database>,
  userId: string,
  file: { name: string; bytes: Uint8Array },
  now: () => number = Date.now,
): Promise<UploadResult> {
  const bad = checkFile(file.name, file.bytes.byteLength);
  if (bad) return { ok: false, message: bad };
  if (!isUtf8(file.bytes)) {
    return { ok: false, message: NOT_TEXT_MESSAGE };
  }

  const { data: bot, error: botError } = await admin.from("bots").select("id").eq("owner_id", userId).maybeSingle();
  if (botError) {
    console.error("upload: could not read the bot", userId, botError);
    return { ok: false, message: GENERIC_UPLOAD_ERROR };
  }
  if (!bot) {
    console.error("upload: no bot for user", userId);
    return { ok: false, message: NO_BOT_MESSAGE };
  }

  // Refuse a byte-identical file before anything is stored, so the cooldown isn't spent.
  // A failed read here only skips the check; the upload itself still goes ahead.
  const sha256 = await sha256Hex(file.bytes);
  const same = await admin
    .from("submissions")
    .select("version, status, error")
    .eq("bot_id", bot.id)
    .eq("sha256", sha256)
    .order("version", { ascending: false })
    .limit(10);
  if (same.error) console.error("upload: duplicate check failed", same.error);
  const twin = same.data ? identicalVersion(same.data) : null;
  if (twin !== null) return { ok: false, message: identicalMessage(twin) };

  const submissionId = crypto.randomUUID();
  const path = `${bot.id}/${submissionId}.py`;
  const stored = await admin.storage
    .from("agents")
    .upload(path, file.bytes, { contentType: "text/x-python", upsert: false });
  if (stored.error) {
    console.error("upload: storage write failed", stored.error);
    return { ok: false, message: STORAGE_DOWN_MESSAGE };
  }

  const { data: submission, error } = await admin.rpc("api_create_submission", {
    p_user_id: userId,
    p_submission_id: submissionId,
    p_storage_path: path,
    p_sha256: sha256,
    p_size_bytes: file.bytes.byteLength,
  });
  if (error) {
    const removed = await admin.storage.from("agents").remove([path]);
    if (removed.error) console.error("upload: could not delete refused file", path, removed.error);
    if (!EXPECTED_REFUSALS.has(error.code)) console.error("upload: api_create_submission failed", error);
    const justStarted = error.code === "PS004" && (await newestIsFresh(admin, bot.id, now()));
    return { ok: false, message: uploadErrorMessage(error.code, error.message, { justStarted }) };
  }
  return { ok: true, version: submission.version };
}

async function newestIsFresh(admin: SupabaseClient<Database>, botId: string, now: number): Promise<boolean> {
  const newest = await admin
    .from("submissions")
    .select("created_at")
    .eq("bot_id", botId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (newest.error) {
    console.error("upload: could not read the newest upload", newest.error);
    return false;
  }
  return startedJustNow(newest.data?.created_at, now);
}
