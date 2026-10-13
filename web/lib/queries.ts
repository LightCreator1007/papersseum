import "server-only";
import { createClient } from "@/lib/supabase/server";
import { intervalMinutes } from "@/lib/format";

// Every read throws on failure so the nearest <LoadBoundary> shows
// "Couldn't load …". Details go to the server log only.
//
// These are generic over the whole response (R) rather than its data (T):
// with `Result<T>`, passing `await supabase.from(...).single()` inline made
// TypeScript infer the query's row type from the helper's `T | null`, so the
// row came back typed as possibly null (or never for `.maybeSingle()`).
type Result = { data: unknown; error: { message: string } | null };

function fail(what: string, error: unknown): never {
  console.error(`query failed: ${what}`, error);
  throw new Error(`Couldn't load ${what}`);
}

// For list and .single() reads: data must be there.
export function check<R extends Result>(what: string, res: R): NonNullable<R["data"]> {
  if (res.error || res.data === null) fail(what, res.error ?? "no data");
  return res.data as NonNullable<R["data"]>;
}

// For .maybeSingle() and count-only reads, where no data is a valid answer.
export function checkMaybe<R extends Result>(what: string, res: R): R["data"] {
  if (res.error) fail(what, res.error);
  return res.data;
}

export type Season = {
  name: string;
  frozen: boolean;
  engineHash: string | null;
  domain: string | null;
  cooldownMinutes: number;
};

export async function getSeason(): Promise<Season> {
  const supabase = await createClient();
  const row = check(
    "the season",
    await supabase
      .from("season")
      .select("name, frozen, engine_hash, allowed_email_domain, submission_cooldown")
      .eq("id", 1)
      .single(),
  );
  return {
    name: row.name,
    frozen: row.frozen,
    engineHash: row.engine_hash,
    domain: row.allowed_email_domain,
    cooldownMinutes: intervalMinutes(String(row.submission_cooldown)),
  };
}

export async function getProfileHandle(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const row = checkMaybe("your profile", await supabase.from("profiles").select("handle").eq("id", userId).maybeSingle());
  return row?.handle ?? null;
}
