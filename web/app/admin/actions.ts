"use server";

import { revalidatePath } from "next/cache";
import { devPersona } from "@/lib/dev-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/server/admin";
import { callRpc } from "@/lib/server/rpc";
import type { ActionState } from "@/features/upload/actions";

// The dev login's organiser can click everything, but the database behind `next dev` is
// the real season, so its writes stop here.
const DEV_NOTE = "Dev login, so nothing was saved.";
const devSkip = async (): Promise<ActionState | null> => ((await devPersona()) ? { ok: true, message: DEV_NOTE } : null);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function setSeasonFrozen(frozen: boolean): Promise<ActionState> {
  const who = await requireAdmin();
  if (!who.ok) return who;
  const dev = await devSkip();
  if (dev) return dev;
  const db = createAdminClient();
  const { data: season, error: readError } = await db.from("season").select("id").limit(1).single();
  if (readError || !season) {
    console.error("admin: season read failed", readError);
    return { ok: false, reason: "error", message: "Couldn't find the season row." };
  }
  const { error } = await db.from("season").update({ frozen }).eq("id", season.id);
  if (error) {
    console.error("admin: freeze failed", error);
    return { ok: false, reason: "error", message: "Couldn't change the freeze. Nothing was changed." };
  }
  console.info("admin", who.data.userId, "setSeasonFrozen", frozen);
  revalidatePath("/", "layout");
  return { ok: true, message: frozen ? "Uploads are frozen. Matches keep running." : "Uploads are open again." };
}

export async function setBotBanned(botId: string, banned: boolean): Promise<ActionState> {
  const who = await requireAdmin();
  if (!who.ok) return who;
  if (!UUID.test(botId)) return { ok: false, reason: "invalid", message: "That isn't a bot id." };
  const dev = await devSkip();
  if (dev) return dev;
  const { error } = await createAdminClient().from("bots").update({ banned }).eq("id", botId);
  if (error) {
    console.error("admin: ban failed", error);
    return { ok: false, reason: "error", message: "Couldn't change the ban. Nothing was changed." };
  }
  console.info("admin", who.data.userId, "setBotBanned", botId, banned);
  revalidatePath("/admin");
  revalidatePath("/leaderboard");
  return { ok: true, message: banned ? "Banned. The bot leaves the ladder from the next round." : "Unbanned. The bot plays from the next round." };
}

export async function requeueJob(jobId: number): Promise<ActionState> {
  const who = await requireAdmin();
  if (!who.ok) return who;
  if (!Number.isInteger(jobId) || jobId <= 0) return { ok: false, reason: "invalid", message: "That isn't a job id." };
  const dev = await devSkip();
  if (dev) return dev;
  const r = await callRpc<null>(createAdminClient(), "admin_requeue_job", { p_job: jobId }, {
    PS007: "Only failed jobs can be requeued.",
  });
  if (!r.ok) return r;
  console.info("admin", who.data.userId, "requeueJob", jobId);
  revalidatePath("/admin");
  return { ok: true, message: `Job ${jobId} is back in the queue.` };
}

// Form entry points for the organiser panel (useActionState passes the previous state first).
export async function freezeForm(_prev: ActionState, form: FormData): Promise<ActionState> {
  return setSeasonFrozen(form.get("frozen") === "true");
}

export async function banForm(_prev: ActionState, form: FormData): Promise<ActionState> {
  return setBotBanned(String(form.get("bot") ?? ""), form.get("banned") === "true");
}

export async function requeueForm(_prev: ActionState, form: FormData): Promise<ActionState> {
  return requeueJob(Number(form.get("job")));
}
