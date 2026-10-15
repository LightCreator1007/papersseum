import "server-only";
import { fail, type Fail, type Result } from "@/lib/server/result";

export const UNAVAILABLE_MESSAGE = "This isn't switched on yet. It needs a database update from the organisers.";
const GENERIC = "Something went wrong on our side. Try again in a minute.";

// PostgREST and Postgres codes for "this function, table or column doesn't exist yet".
const NOT_DEPLOYED = new Set(["PGRST202", "PGRST204", "PGRST205", "42883", "42P01", "42703"]);

type PgError = { code?: string; message?: string };
type RpcFn = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: PgError | null }>;

export function classify(error: PgError, messages: Record<string, string> = {}): Fail {
  const code = error.code ?? "";
  if (messages[code]) return fail(code === "23505" ? "conflict" : "invalid", messages[code]);
  if (NOT_DEPLOYED.has(code)) return fail("unavailable", UNAVAILABLE_MESSAGE);
  if (code === "42501") return fail("forbidden", "You don't have permission to do that.");
  if (code === "23505") return fail("conflict", "That's already taken.");
  if (code.startsWith("PS")) return fail("invalid", error.message || "That wasn't allowed.");
  return fail("error", GENERIC);
}

export async function callRpc<T>(
  client: { rpc: unknown },
  fn: string,
  args: Record<string, unknown>,
  messages: Record<string, string> = {},
): Promise<Result<T>> {
  // The generated types don't know functions the infra owner hasn't shipped yet.
  // Remove this adapter when database.types.ts is regenerated with them.
  const rpc = (client.rpc as unknown as RpcFn).bind(client);
  try {
    const { data, error } = await rpc(fn, args);
    if (error) {
      const result = classify(error, messages);
      if (result.reason === "error") console.error(`rpc ${fn} failed`, error);
      return result;
    }
    return { ok: true, data: data as T };
  } catch (e) {
    console.error(`rpc ${fn} threw`, e);
    return fail("error", GENERIC);
  }
}
