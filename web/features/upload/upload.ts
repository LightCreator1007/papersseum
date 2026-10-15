// Server only: takes the admin client as an argument so tests can call it
// without a browser session. Flow from supabase/migrations/*_submissions_api.sql:
// upload the file, then api_create_submission; delete the file if refused.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { GENERIC_UPLOAD_ERROR, checkFile, isUtf8, uploadErrorMessage } from "@/features/upload/upload-rules";

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
): Promise<UploadResult> {
  const bad = checkFile(file.name, file.bytes.byteLength);
  if (bad) return { ok: false, message: bad };
  if (!isUtf8(file.bytes)) {
    return { ok: false, message: "That file isn't readable text. Upload the .py source file." };
  }

  const { data: bot, error: botError } = await admin.from("bots").select("id").eq("owner_id", userId).maybeSingle();
  if (botError || !bot) {
    console.error("upload: no bot for user", userId, botError);
    return { ok: false, message: GENERIC_UPLOAD_ERROR };
  }

  const submissionId = crypto.randomUUID();
  const path = `${bot.id}/${submissionId}.py`;
  const sha256 = await sha256Hex(file.bytes);
  const stored = await admin.storage
    .from("agents")
    .upload(path, file.bytes, { contentType: "text/x-python", upsert: false });
  if (stored.error) {
    console.error("upload: storage write failed", stored.error);
    return { ok: false, message: GENERIC_UPLOAD_ERROR };
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
    return { ok: false, message: uploadErrorMessage(error.code, error.message) };
  }
  return { ok: true, version: submission.version };
}
