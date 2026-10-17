"use server";

import { firstRow } from "@/features/upload/first-row";
import { createSubmission } from "@/features/upload/upload";
import { SESSION_EXPIRED, checkFile } from "@/features/upload/upload-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { callRpc } from "@/lib/server/rpc";
import type { Reason } from "@/lib/server/result";
import { validateBotName } from "@/lib/bot-name";
import { parseGenome } from "@/lib/character/genome";
import { devPersona } from "@/lib/dev-auth";

// signIn: the session ran out, so the form shows a sign-in link that comes back to /me.
export type UploadState = { ok: boolean; message: string | null; signIn?: boolean };

export async function uploadBot(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const userId = await getUserId();
  if (!userId) return { ok: false, message: SESSION_EXPIRED, signIn: true };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, message: "Choose a .py file." };
  const bad = checkFile(file.name, file.size); // before reading a large body into memory
  if (bad) return { ok: false, message: bad };
  if (await devPersona()) return { ok: true, message: `${file.name} passed the file checks. ${DEV_NOTE}` };

  const result = await createSubmission(createAdminClient(), userId, {
    name: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  return result.ok
    ? { ok: true, message: `Version ${result.version} uploaded. It's being checked now.` }
    : { ok: false, message: result.message };
}

export type ActionState = { ok: boolean; reason?: Reason; message: string };

const SIGNED_OUT: ActionState = { ok: false, reason: "forbidden", message: "Your session expired. Sign in again." };
// Dev login (lib/dev-auth.ts): inputs are validated as usual, then the write is skipped.
const DEV_NOTE = "Dev login, so nothing was saved.";
const devSaved = (message: string): ActionState => ({ ok: true, message: `${message} ${DEV_NOTE}` });

// One row, or the array a `returns table` function gives back.
type Row<T> = T | T[] | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function session() {
  const userId = await getUserId();
  return userId ? await createClient() : null;
}

export async function renameBot(_prev: ActionState, form: FormData): Promise<ActionState> {
  const client = await session();
  if (!client) return SIGNED_OUT;
  const v = validateBotName(String(form.get("name") ?? ""));
  if (!v.ok) return { ok: false, reason: "invalid", message: v.message };
  if (await devPersona()) return devSaved(`Renamed to ${v.name}.`);
  const r = await callRpc<Row<{ name: string }>>(client, "rename_bot", { p_new_name: v.name }, {
    "23505": "Someone already has that name.",
    PS005: "You've already renamed your bot this season.",
  });
  if (!r.ok) return r;
  const name = firstRow(r.data)?.name ?? v.name;
  revalidatePath("/me");
  revalidatePath("/welcome");
  revalidatePath(`/bots/${name}`);
  return { ok: true, message: `Renamed to ${name}. Old links still work.` };
}

export async function setActiveSubmission(_prev: ActionState, form: FormData): Promise<ActionState> {
  const client = await session();
  if (!client) return SIGNED_OUT;
  const id = String(form.get("submission_id") ?? "");
  if (!UUID.test(id)) return { ok: false, reason: "invalid", message: "Pick a version first." };
  if (await devPersona()) return devSaved("That version plays from the next round.");
  const r = await callRpc<Row<{ status: "active" | "revalidating" }>>(client, "set_active_submission", { p_submission: id }, {
    PS006: "Only versions that passed the check can be made active.",
    PS004: "Wait for the upload cooldown before switching versions.",
  });
  if (!r.ok) return r;
  revalidatePath("/me");
  return firstRow(r.data)?.status === "revalidating"
    ? { ok: true, message: "The engine changed since this version passed, so it's being re-checked. It goes live if it passes." }
    : { ok: true, message: "That version plays from the next round." };
}

export async function saveAppearance(_prev: ActionState, form: FormData): Promise<ActionState> {
  const client = await session();
  if (!client) return SIGNED_OUT;
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(form.get("appearance") ?? ""));
  } catch {
    return { ok: false, reason: "invalid", message: "That character couldn't be read. Reset it and try again." };
  }
  const genome = parseGenome(parsed);
  if (!genome) return { ok: false, reason: "invalid", message: "That character has a part we don't recognise. Reset it and try again." };
  // Same path as the undeployed function: the Forge keeps the character in this browser.
  if (await devPersona()) return { ok: false, reason: "unavailable", message: DEV_NOTE };
  const r = await callRpc<null>(client, "set_bot_appearance", { p_appearance: genome });
  if (!r.ok) return r;
  revalidatePath("/me", "layout"); // /me and /me/forge both draw it
  return { ok: true, message: "Saved. Your character shows everywhere your bot plays." };
}

export async function setEmailOptIn(_prev: ActionState, form: FormData): Promise<ActionState> {
  const client = await session();
  if (!client) return SIGNED_OUT;
  const optIn = form.get("opt_in") === "on";
  if (await devPersona()) return devSaved(optIn ? "Emails on." : "Emails off.");
  const r = await callRpc<null>(client, "set_email_opt_in", { p_opt_in: optIn });
  if (!r.ok) return r;
  revalidatePath("/me/settings");
  return { ok: true, message: optIn ? "You'll get an email for verdicts and your first match." : "No more emails. The inbox still updates." };
}

export async function markNotificationsRead(ids: number[]): Promise<ActionState> {
  const clean = ids.filter((n) => Number.isInteger(n) && n > 0);
  if (clean.length === 0 || (await devPersona())) return { ok: true, message: "" };
  const client = await session();
  if (!client) return SIGNED_OUT;
  const r = await callRpc<null>(client, "mark_notifications_read", { p_ids: clean });
  return r.ok ? { ok: true, message: "" } : r;
}
