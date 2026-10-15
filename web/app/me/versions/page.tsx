import type { Metadata } from "next";
import { Suspense } from "react";
import { setActiveSubmission } from "@/features/upload/actions";
import { ActionForm } from "@/components/me/action-form";
import { LiveRefresh } from "@/components/live-refresh";
import { LoadBoundary } from "@/components/load-boundary";
import { EmptyState } from "@/components/ui/empty-state";
import styles from "@/components/me/me.module.css";
import { Placeholder } from "@/components/placeholder";
import { SUBMISSION_STATUS, percent, shortDateTime } from "@/features/ladder/format";
import { requireMyBot } from "@/lib/me";
import { MY_SUBMISSIONS_LIMIT, getMySubmissions, getSubmissionHistory } from "@/features/ladder/queries";
import { versionScorecards } from "@/lib/stats/scorecards";
import { capNote, hasChecking } from "./versions-state";
import { ContactOrganisers } from "@/components/contact-organisers";

export const metadata: Metadata = { title: "Versions" };

async function VersionsContent() {
  const { bot } = await requireMyBot("/me/versions");
  if (!bot) return <ContactOrganisers lead="Your account has no bot." />;
  const [subs, history] = await Promise.all([getMySubmissions(bot.id), getSubmissionHistory(bot.id)]);
  if (subs.length === 0) {
    return (
      <EmptyState
        title="No uploads yet"
        body="Upload your first version from the overview, or from the command line with the CLI."
        action={{ label: "Upload a version", href: "/me" }}
        secondary={{ label: "CLI quickstart", href: "/docs/getting-started" }}
      />
    );
  }
  const cards = new Map(versionScorecards(history).map((c) => [c.submissionId, c]));
  const cap = capNote(subs.length, MY_SUBMISSIONS_LIMIT);

  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th>Version</th>
            <th>Uploaded</th>
            <th>Status</th>
            <th className="num">Games</th>
            <th className="num">Avg place</th>
            <th className="num">Win rate</th>
            <th className="num">Elo change</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {subs.map((s) => {
            const c = cards.get(s.id);
            const canSwitch = s.status === "superseded";
            return (
              <tr key={s.id}>
                <td>v{s.version}</td>
                <td className="muted">{shortDateTime(s.createdAt)}</td>
                <td>{s.status === "active" ? <b>{SUBMISSION_STATUS[s.status]}</b> : SUBMISSION_STATUS[s.status]}</td>
                <td className="num">{c?.games ?? 0}</td>
                <td className="num">{c ? c.avgPlacement.toFixed(2) : "n/a"}</td>
                <td className="num">{c ? percent(c.winRate) : "n/a"}</td>
                <td className="num">{c ? `${c.eloDelta >= 0 ? "+" : ""}${c.eloDelta.toFixed(1)}` : "n/a"}</td>
                <td>
                  {canSwitch && (
                    <ActionForm action={setActiveSubmission} submit="Make active">
                      <input type="hidden" name="submission_id" value={s.id} />
                    </ActionForm>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {cap && <p className="muted small">{cap}</p>}
      <p className={styles.msg}>
        Switching back to a version that passed its check plays it from the next round. Your rating carries over.
      </p>
      {hasChecking(subs) && <LiveRefresh table="submissions" filter={`bot_id=eq.${bot.id}`} />}
    </div>
  );
}

export default function VersionsPage() {
  return (
    <LoadBoundary what="your versions">
      <Suspense fallback={<Placeholder lines={6} />}>
        <VersionsContent />
      </Suspense>
    </LoadBoundary>
  );
}
