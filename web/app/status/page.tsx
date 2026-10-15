import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Skeleton } from "@/components/ui/skeleton";
import { Status, type StatusTone } from "@/components/ui/status";
import { relativeTime, shortDateTime } from "@/features/ladder/format";
import { loadArenaStatus, type ArenaStatus } from "@/lib/server/arena-status";
import { resumeText, workerDown } from "./resume";
import styles from "./status.module.css";

export const metadata: Metadata = { title: "Status" };

const WORKER: Record<ArenaStatus["worker"], { tone: StatusTone; word: string; text: string }> = {
  running: { tone: "live", word: "Running", text: "A match is being played right now." },
  idle: { tone: "done", word: "Idle", text: "The worker is up and waiting for the next round." },
  paused: { tone: "paused", word: "Paused", text: "No worker has checked in for over 5 minutes, so matches are paused. Uploads still work and are checked when matches resume." },
  unknown: { tone: "waiting", word: "Unknown", text: "No worker has ever checked in." },
};

const SKIP: Record<NonNullable<ArenaStatus["skipped"]>["reason"], string> = {
  frozen: "The season is frozen by the organisers, so no new rounds are scheduled.",
  backlog: "Rounds are being skipped because the match queue is full.",
  "no-players": "Rounds start once at least one player has an active bot.",
  unknown: "The last round is overdue and the reason is not known yet.",
};

function nextRoundText(s: ArenaStatus): string {
  if (s.skipped?.reason === "frozen") return "None scheduled";
  if (s.worker === "paused") return "When matches resume";
  if (s.skipped?.reason === "backlog") return "After the queue clears";
  return shortDateTime(s.nextRoundAt);
}

async function StatusBody() {
  await connection();
  const res = await loadArenaStatus();
  if (!res.ok) {
    return (
      <div className={styles.error} role="alert">
        <p>Couldn&apos;t read the arena status.</p>
        <a href="/status">Try again</a>
      </div>
    );
  }
  const s = res.data;
  const w = WORKER[s.worker];
  const resume = resumeText(s);
  return (
    <>
      <section className={styles.hero} data-worker={s.worker}>
        <Status tone={w.tone} label={w.word} />
        <p>{w.text}</p>
        {workerDown(s) && resume && <p>{resume}</p>}
        {s.lastSeenAt && <p className={styles.small}>Worker last checked in {relativeTime(s.lastSeenAt)}.</p>}
      </section>
      <dl className={styles.grid}>
        <div>
          <dt>Next round</dt>
          <dd>{nextRoundText(s)}</dd>
        </div>
        <div>
          <dt>Last round</dt>
          <dd>{s.lastRoundAt ? relativeTime(s.lastRoundAt) : "No rounds yet"}</dd>
        </div>
        <div>
          <dt>Matches queued</dt>
          <dd>{s.queued}</dd>
        </div>
        <div>
          <dt>Matches running</dt>
          <dd>{s.running}</dd>
        </div>
      </dl>
      {s.skipped && (
        <p className={styles.note} role="status">
          {SKIP[s.skipped.reason]} Since {relativeTime(s.skipped.since)}.
          {!workerDown(s) && resume && ` ${resume}`}
        </p>
      )}
      <p className={styles.small}>Checked {shortDateTime(s.checkedAt)}. This page refreshes every 30 seconds.</p>
    </>
  );
}

export default function StatusPage() {
  return (
    <div className={styles.page}>
      <h1>Status</h1>
      <AutoRefresh stamp />
      <Suspense fallback={<Skeleton rows={6} label="Reading the arena status" />}>
        <StatusBody />
      </Suspense>
    </div>
  );
}
