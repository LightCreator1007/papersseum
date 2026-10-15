import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BotsTable, FreezeToggle, RetryJob } from "@/app/admin/admin-forms";
import { adminWarnings } from "@/app/admin/warnings";
import { matchHref } from "@/features/ladder/links";
import { relativeTime } from "@/features/ladder/format";
import { Status } from "@/components/ui/status";
import { listBotsForAdmin, listFailedJobs, listWorkersForAdmin, loadSeasonForAdmin, requireAdmin } from "@/lib/server/admin";
import { PAUSED_AFTER_MS } from "@/lib/server/arena-status";
import styles from "./admin.module.css";

export const metadata: Metadata = { title: "Organiser", robots: { index: false, follow: false } };

const short = (hash: string | null) => (hash ? hash.slice(0, 8) : "not set");

// Data and the clock live outside the component, so rendering stays pure.
async function loadPanel() {
  const [season, bots, failed, workers] = await Promise.all([
    loadSeasonForAdmin(),
    listBotsForAdmin(),
    listFailedJobs(),
    listWorkersForAdmin(),
  ]);
  await connection();
  const now = Date.now();
  const problems = [season, bots, failed, workers].filter((r) => !r.ok);
  const warnings =
    season.ok && bots.ok && failed.ok && workers.ok
      ? adminWarnings({ season: season.data, bots: bots.data, failed: failed.data, workers: workers.data }, now)
      : [];
  return { season, bots, failed, workers, now, problems, warnings };
}

async function Panel() {
  const who = await requireAdmin();
  // Everyone who isn't an organiser gets the ordinary 404: the page doesn't admit it exists.
  if (!who.ok && who.reason === "forbidden") notFound();
  if (!who.ok) return <p className={styles.error}>{who.message}</p>;

  const { season, bots, failed, workers, now, problems, warnings } = await loadPanel();

  return (
    <>
      {season.ok && (
        <section className={styles.season} aria-label="Season">
          <dl>
            <div>
              <dt>Season</dt>
              <dd>{season.data.name}</dd>
            </div>
            <div>
              <dt>Uploads</dt>
              <dd>
                <Status tone={season.data.frozen ? "paused" : "live"} label={season.data.frozen ? "Frozen" : "Open"} />
              </dd>
            </div>
            <div>
              <dt>Engine</dt>
              <dd className={styles.mono}>{short(season.data.engineHash)}</dd>
            </div>
          </dl>
          <FreezeToggle frozen={season.data.frozen} />
        </section>
      )}

      {problems.map((r) => !r.ok && (
        <p key={r.message} className={styles.error} role="alert">
          {r.message}
        </p>
      ))}

      {warnings.length > 0 && (
        <ul className={styles.warnings} aria-label="Needs attention">
          {warnings.map((w) => (
            <li key={w.title} data-tone={w.tone}>
              <strong>{w.title}</strong>
              <span>{w.body}</span>
            </li>
          ))}
        </ul>
      )}

      {failed.ok && (
        <section className={styles.block}>
          <h2>
            Failed jobs <span className={styles.count}>{failed.data.length}</span>
          </h2>
          {failed.data.length === 0 ? (
            <p className="muted small">No failed jobs. Matches and upload checks are going through.</p>
          ) : (
            <ul className={styles.rows}>
              {failed.data.map((j) => (
                <li key={j.id}>
                  <div className={styles.who}>
                    {j.kind === "match" && j.matchId !== null ? (
                      <Link href={matchHref(j.matchId)}>Match {j.matchId}</Link>
                    ) : (
                      <span>Upload check</span>
                    )}
                    <span className={styles.tag}>job {j.id}</span>
                  </div>
                  <span className={styles.meta}>
                    {relativeTime(j.updatedAt, now)} · {j.attempts} attempt{j.attempts === 1 ? "" : "s"}
                    {j.error && (
                      <details className={styles.why}>
                        <summary>Why it failed</summary>
                        <pre>{j.error}</pre>
                      </details>
                    )}
                  </span>
                  <RetryJob id={j.id} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {workers.ok && (
        <section className={styles.block}>
          <h2>
            Workers <span className={styles.count}>{workers.data.length}</span>
          </h2>
          {workers.data.length === 0 ? (
            <p className="muted small">No worker has checked in yet. Start one on the VM; it appears here within a minute.</p>
          ) : (
            <ul className={styles.rows}>
              {workers.data.map((w) => {
                const quiet = now - Date.parse(w.lastSeen) > PAUSED_AFTER_MS;
                const mismatch = Boolean(season.ok && season.data.engineHash && w.engineHash && w.engineHash !== season.data.engineHash);
                return (
                  <li key={w.id}>
                    <div className={styles.who}>
                      <span className={styles.mono} title={w.id}>
                        {w.id}
                      </span>
                      <Status
                        tone={quiet ? "paused" : w.currentJob ? "live" : "waiting"}
                        label={quiet ? "Quiet" : w.currentJob ? `On job ${w.currentJob}` : "Idle"}
                      />
                    </div>
                    <span className={styles.meta}>
                      Seen {relativeTime(w.lastSeen, now)} · {w.version ?? "version unknown"} · engine{" "}
                      <span className={styles.mono} data-mismatch={mismatch || undefined}>
                        {short(w.engineHash)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {bots.ok && (
        <section className={styles.block}>
          <h2>
            Bots <span className={styles.count}>{bots.data.length}</span>
          </h2>
          <p className="muted small">
            A ban takes the bot off the ladder from the next round. It isn&apos;t told why yet: ban reasons arrive with
            database ask A14.
          </p>
          {bots.data.length === 0 ? <p className="muted small">No bots yet.</p> : <BotsTable bots={bots.data} />}
        </section>
      )}
    </>
  );
}

function Loading() {
  return (
    <div className={styles.loading} aria-busy="true" aria-label="Loading the organiser panel">
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}

export default function AdminPage() {
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.kicker}>Organiser</p>
        <h1>Run the season</h1>
      </header>
      <Suspense fallback={<Loading />}>
        <Panel />
      </Suspense>
    </div>
  );
}
