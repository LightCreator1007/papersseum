"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next")?.toString());
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "http://127.0.0.1:3000";
  const { data: season } = await supabase.from("season").select("allowed_email_domain").eq("id", 1).maybeSingle();
  const domain = season?.allowed_email_domain;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      // hd only filters Google's account picker; the database enforces the domain.
      queryParams: { prompt: "select_account", ...(domain ? { hd: domain } : {}) },
    },
  });
  if (error || !data.url) {
    console.error("sign-in: could not start Google OAuth", error);
    redirect("/sign-in?error=failed");
  }
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
