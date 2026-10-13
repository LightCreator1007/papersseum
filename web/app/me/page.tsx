import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { UploadForm } from "@/app/me/upload-form";
import { LiveRefresh } from "@/components/live-refresh";
import { LoadBoundary } from "@/components/load-boundary";
import { Placeholder } from "@/components/placeholder";
import { SUBMISSION_STATUS, shortDateTime } from "@/lib/format";
import { botHref } from "@/lib/links";
import { getMyBot, getMySubmissions, getSeason, type MySubmission } from "@/lib/queries";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your bot" };

const MAX_VIOLATION_LINES = 20;

function Details({ sub, banned }: { sub: MySubmission; banned: boolean }) {
  switch (sub.status) {
    case "pending":
    case "validating":
      return <span className="muted small">running a test match, usually a few minutes</span>;
    case "active":
      return <span className="muted small">{banned ? "not playing: this bot is banned" : "playing on the ladder"}</span>;
    case "superseded":
      return <span className="muted small">replaced by a newer version</span>;
    case "rejected": {
      const extra = sub.violations.map((v) => `line ${v.line}: ${v.detail}`).filter((t) => t !== sub.error);
      if (!sub.error && extra.length === 0) return <span className="muted small">No reason was recorded.</span>;
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
        </>
      );
    }
  }
}

async function MyBotContent() {
  const userId = await getUserId();
  if (!userId) redirect("/sign-in?next=/me");
  const [bot, season] = await Promise.all([getMyBot(userId), getSeason()]);
  if (!bot) {
    return <p className="muted">Your account has no bot. Contact the organisers.</p>;
  }
  const subs = await getMySubmissions(bot.id);
  const canUpload = !bot.banned && !season.frozen;

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

      {bot.banned ? (
        <p className="notice">This bot is banned. Contact the organisers.</p>
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
                    <Details sub={s} banned={bot.banned} />
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
      <h1>Your bot</h1>
      <LoadBoundary what="your bot">
        <Suspense fallback={<Placeholder lines={6} />}>
          <MyBotContent />
        </Suspense>
      </LoadBoundary>
    </>
  );
}
