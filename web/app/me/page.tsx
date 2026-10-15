import { ContactOrganisers, ISSUES_URL } from "@/components/contact-organisers";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { UploadForm } from "@/features/upload/components/upload-form";
import { LiveRefresh } from "@/components/live-refresh";
import { CheckProgress } from "@/features/upload/components/check-progress";
import { LoadBoundary } from "@/components/load-boundary";
import { Placeholder } from "@/components/placeholder";
import { SUBMISSION_STATUS, shortDateTime } from "@/features/ladder/format";
import { characterFor, signatureColor } from "@/lib/character/for-bot";
import { botHref } from "@/features/ladder/links";
import { getMyBot, getMySubmissions, getSeason, type MySubmission } from "@/features/ladder/queries";
import { loadArenaStatus } from "@/lib/server/arena-status";
import { loadCheckProgress } from "@/features/upload/check-progress";
import { fixHints, replacedBy } from "@/features/upload/version-notes";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your bot" };

const MAX_VIOLATION_LINES = 20;

function Details({ sub, subs, banned, activeVersion }: { sub: MySubmission; subs: MySubmission[]; banned: boolean; activeVersion: number | null }) {
  switch (sub.status) {
    case "pending":
      return <span className="muted small">in line to be checked</span>;
    case "validating":
      return <span className="muted small">running a test match</span>;
    case "active":
      return <span className="muted small">{banned ? "not playing: this bot is banned" : "playing on the ladder"}</span>;
    case "superseded": {
      const by = replacedBy(subs, sub, activeVersion);
      return <span className="muted small">{by === null ? "replaced by a newer version" : `replaced by v${by}`}</span>;
    }
    case "rejected": {
      const extra = sub.violations.map((v) => `line ${v.line}: ${v.detail}`).filter((t) => t !== sub.error);
      if (!sub.error && extra.length === 0) return <span className="muted small">No reason was recorded.</span>;
      const hints = fixHints(sub.violations, sub.error);
      return (
        <>
          {sub.error && (
            <div className="mono">
              {sub.error.startsWith("Validation could not run")
                ? "Validation could not run. Try uploading again."
                : sub.error}
            </div>
          )}
          {extra.length > 0 && (
            <ul className="list-plain mono">
              {extra.slice(0, MAX_VIOLATION_LINES).map((t, i) => (
                <li key={`${i}:${t}`}>{t}</li>
              ))}
              {extra.length > MAX_VIOLATION_LINES && <li>and {extra.length - MAX_VIOLATION_LINES} more</li>}
            </ul>
          )}
          {hints.length > 0 && (
            <ul className="list-plain small">
              {hints.map((h) => (
                <li key={h}>Fix: {h}</li>
              ))}
            </ul>
          )}
        </>
      );
    }
  }
}

// The newest upload still being checked, with where it is in the queue (FigJam C1).
// Either read failing falls back to what the submission row already says.
async function CheckingCard({ sub, botName }: { sub: MySubmission; botName: string }) {
  const [progress, arena] = await Promise.all([loadCheckProgress(sub.id), loadArenaStatus()]);
  const p = progress.ok ? progress.data : null;
  const genome = characterFor({ name: botName });
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

async function MyBotContent() {
  const userId = await getUserId();
  if (!userId) redirect("/sign-in?next=/me");
  const [bot, season] = await Promise.all([getMyBot(userId), getSeason()]);
  if (!bot) {
    return <ContactOrganisers lead="Your account has no bot." />;
  }
  const subs = await getMySubmissions(bot.id);
  const canUpload = !bot.banned && !season.frozen;
  const checking = subs.find((s) => s.status === "pending" || s.status === "validating");

  return (
    <>
      <p className="muted small" style={{ margin: "4px 0 20px" }}>
        <Link href={botHref(bot.name)}>{bot.name}</Link>
        {!bot.banned && bot.rank !== null && ` · rank ${bot.rank}`}
        {!bot.banned &&
          (bot.activeVersion
            ? ` · version ${bot.activeVersion} is playing on the ladder`
            : ` · no version is playing yet${canUpload ? "; upload one below" : ""}`)}
      </p>

      {checking && (
        <Suspense fallback={null}>
          <CheckingCard sub={checking} botName={bot.name} />
        </Suspense>
      )}

      {bot.banned ? (
        <p className="notice">
          This bot is banned. If you think that&apos;s a mistake,{" "}
          <a href={ISSUES_URL} target="_blank" rel="noreferrer">
            open an issue on GitHub
          </a>
          .
        </p>
      ) : season.frozen ? (
        <p className="notice">Submissions are closed for this season.</p>
      ) : (
        <UploadForm activeVersion={bot.activeVersion} cooldownMinutes={season.cooldownMinutes} />
      )}

      <h2>Versions</h2>
      {subs.length === 0 ? (
        <p className="muted">No uploads yet.</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>Version</th>
                <th style={{ width: 130 }}>Uploaded</th>
                <th style={{ width: 100 }}>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id}>
                  <td>v{s.version}</td>
                  <td className="muted">{shortDateTime(s.createdAt)}</td>
                  <td className={s.status === "rejected" ? "down" : s.status === "superseded" ? "muted" : undefined}>
                    {s.status === "active" ? <b>{SUBMISSION_STATUS[s.status]}</b> : SUBMISSION_STATUS[s.status]}
                  </td>
                  <td>
                    <Details sub={s} subs={subs} banned={bot.banned} activeVersion={bot.activeVersion} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
