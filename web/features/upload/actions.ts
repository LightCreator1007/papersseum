"use server";

import { createSubmission } from "@/features/upload/upload";
import { checkFile } from "@/features/upload/upload-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/supabase/server";

export type UploadState = { ok: boolean; message: string | null };

export async function uploadBot(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const userId = await getUserId();
  if (!userId) return { ok: false, message: "Your session expired. Sign in again." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, message: "Choose a .py file." };
  const bad = checkFile(file.name, file.size); // before reading a large body into memory
  if (bad) return { ok: false, message: bad };

  const result = await createSubmission(createAdminClient(), userId, {
    name: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  return result.ok
    ? { ok: true, message: `Version ${result.version} uploaded. It's being checked now.` }
    : { ok: false, message: result.message };
}
