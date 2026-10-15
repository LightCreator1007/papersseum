import "server-only";
import { connection } from "next/server";
import { nextRoundAt, type RoundOutlook } from "@/features/ladder/format";
import { loadArenaStatus } from "@/lib/server/arena-status";

// When the next round runs, and whether the arena is skipping rounds. The arena status is a
// hint: if it can't be read, the page still shows the plain quarter-hour clock.
export async function getRoundOutlook(frozen: boolean): Promise<RoundOutlook> {
  await connection();
  const arena = await loadArenaStatus();
  const skipped = arena.ok ? arena.data.skipped : null;
  return {
    frozen,
    backlog: skipped?.reason === "backlog",
    noPlayers: skipped?.reason === "no-players",
    at: arena.ok ? Date.parse(arena.data.nextRoundAt) : nextRoundAt(Date.now()),
  };
}
