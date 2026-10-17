import { ContactOrganisers, ISSUES_URL } from "@/components/contact-organisers";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/live-refresh";
import { CheckProgress } from "@/features/upload/components/check-progress";
import { RejectionReason } from "@/features/upload/components/rejection-reason";
import { UploadPanel } from "@/features/upload/components/upload-panel";
import { LoadBoundary } from "@/components/load-boundary";
import { Placeholder } from "@/components/placeholder";
import { characterFor, signatureColor } from "@/lib/character/for-bot";
import { botHref } from "@/features/ladder/links";
import { getMyBot, getMySubmissions, getSeason, type MyBot, type MySubmission } from "@/features/ladder/queries";
import { loadArenaStatus } from "@/lib/server/arena-status";
import { loadCheckProgress } from "@/features/upload/check-progress";
import { uploadView } from "@/features/upload/upload-view";
import { getUserId } from "@/lib/supabase/server";
import styles from "./overview.module.css";

export const metadata: Metadata = { title: "Your bot" };

// The newest upload still being checked, with where it is in the queue (FigJam C1).
// Either read failing falls back to what the submission row already says.
async function CheckingCard({ sub, bot }: { sub: MySubmission; bot: MyBot }) {
  const [progress, arena] = await Promise.all([loadCheckProgress(sub.id), loadArenaStatus()]);
  const p = progress.ok ? progress.data : null;
  const genome = characterFor(bot);
  return (
    <CheckProgress
      version={sub.version}
      stage={p?.stage ?? (sub.status === "pending" ? "queued" : "checking")}
      createdAt={sub.createdAt}
      ahead={p?.ahead ?? null}
      attempts={p?.attempts ?? 1}
      maxAttempts={p?.maxAttempts ?? 3}
      workerPaused={arena.ok && arena.data.worker === "paused"}
      genome={genome}
      accent={signatureColor(genome)}
    />
  );
}

// The cooldown's first frame is drawn on the server, so the zone doesn't flash "drop a
// file" before the client clock takes over. This page renders once per request.
async function requestTime(): Promise<number> {
  return Date.now();
}

async function MyBotContent() {
  const userId = await getUserId();
  if (!userId) redirect("/sign-in?next=/me");
  const [bot, season] = await Promise.all([getMyBot(userId), getSeason()]);
  if (!bot) {
    return <ContactOrganisers lead="Your account has no bot." />;
  }
  const subs = await getMySubmissions(bot.id);
  const view = uploadView(subs, { banned: bot.banned, frozen: season.frozen, cooldownMinutes: season.cooldownMinutes });

  return (
    <>
      <div className={styles.status}>
        <p className="muted small">
          <Link href={botHref(bot.name)}>{bot.name}</Link>
          {!bot.banned && bot.rank !== null && ` · rank ${bot.rank}`}
          {!bot.banned &&
            (bot.activeVersion ? ` · v${bot.activeVersion} is playing on the ladder` : " · no version is playing yet")}
        </p>
        {subs.length > 0 && (
          <Link href="/me/versions" className="small">
            All versions
          </Link>
        )}
      </div>

      {view.checking && (
        <Suspense fallback={null}>
          <CheckingCard sub={view.checking} bot={bot} />
        </Suspense>
      )}

      {view.rejected && !view.closed && (
        <section className={styles.rejected} aria-labelledby="rejected-title">
          <h2 id="rejected-title" className={styles.rejectedTitle}>
            v{view.rejected.version} didn&apos;t pass the check
          </h2>
          <RejectionReason sub={view.rejected} />
        </section>
      )}

      {view.closed === "banned" ? (
        <p className="notice">
          This bot is banned. If you think that&apos;s a mistake,{" "}
          <a href={ISSUES_URL} target="_blank" rel="noreferrer">
            open an issue on GitHub
          </a>
          .
        </p>
      ) : view.closed === "frozen" ? (
        <p className="notice">Submissions are closed for this season.</p>
      ) : (
        <UploadPanel view={view} activeVersion={bot.activeVersion} cooldownMinutes={season.cooldownMinutes} now={await requestTime()} />
      )}

      <LiveRefresh table="submissions" filter={`bot_id=eq.${bot.id}`} />
    </>
  );
}

export default function MePage() {
  return (
    <>
      <LoadBoundary what="your bot">
        <Suspense fallback={<Placeholder lines={6} />}>
          <MyBotContent />
        </Suspense>
      </LoadBoundary>
    </>
  );
}
