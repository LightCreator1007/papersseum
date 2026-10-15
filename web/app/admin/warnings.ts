import type { AdminBot, AdminSeason, AdminWorker, FailedJob } from "@/lib/server/admin";
import { PAUSED_AFTER_MS } from "@/lib/server/arena-status";

// What an organiser should act on, worst first. Pure, so the panel and its tests agree.

export type Warning = { tone: "failed" | "paused"; title: string; body: string };

const short = (hash: string) => hash.slice(0, 8);

export function adminWarnings(
  { bots, workers, failed, season }: { bots: AdminBot[]; workers: AdminWorker[]; failed: FailedJob[]; season: AdminSeason },
  now: number,
): Warning[] {
  const out: Warning[] = [];

  if (workers.length === 0) {
    out.push({ tone: "failed", title: "No worker has ever checked in", body: "Matches and upload checks won't run until one starts." });
  } else if (workers.every((w) => now - Date.parse(w.lastSeen) > PAUSED_AFTER_MS)) {
    out.push({ tone: "failed", title: "Every worker is quiet", body: "None has checked in for 5 minutes, so the site shows matches as paused." });
  }

  if (season.engineHash) {
    const behind = workers.filter((w) => w.engineHash && w.engineHash !== season.engineHash);
    for (const w of behind) {
      out.push({
        tone: "failed",
        title: `${w.id} runs a different engine`,
        body: `It has ${short(w.engineHash!)}, the season expects ${short(season.engineHash)}. It waits instead of taking jobs until they match.`,
      });
    }
  }

  const house = bots.filter((b) => b.isHouse && !b.banned);
  if (house.length === 0) {
    out.push({ tone: "paused", title: "No house bots", body: "Rounds with few players can't fill their lobbies." });
  } else if (house.every((b) => b.activeVersion === null)) {
    out.push({ tone: "paused", title: "No house bot has a passing version", body: "They're on the ladder but can't be placed in matches." });
  }

  if (failed.length > 0) {
    const n = failed.length;
    out.push({ tone: "paused", title: `${n} failed job${n === 1 ? "" : "s"}`, body: "Retry them below once the cause is fixed." });
  }

  if (season.frozen) {
    out.push({ tone: "paused", title: "Uploads are frozen", body: "Players can't upload. Matches keep running." });
  }

  return out;
}
