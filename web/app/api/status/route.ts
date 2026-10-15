import { connection } from "next/server";
import { loadArenaStatus } from "@/lib/server/arena-status";

export async function GET() {
  await connection(); // live data: never prerender this at build time
  const r = await loadArenaStatus();
  if (!r.ok) return Response.json({ message: r.message }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return Response.json(r.data, { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } });
}
