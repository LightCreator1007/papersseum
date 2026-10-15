import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/live-refresh";
import { LoadBoundary } from "@/components/load-boundary";
import { Placeholder } from "@/components/placeholder";
import { ReplayViewer } from "@/features/replay/components/replay-viewer";
import { ReplaySkeleton } from "@/features/replay/components/final-board";
import { BotTag } from "@/components/bot-tag";
import { Swatch } from "@/features/ladder/components/swatch";
import { PLAYER_COLORS } from "@/features/ladder/colors";
import { duration, elo, eloChange, percent, relativeTime, shortDateTime } from "@/features/ladder/format";
import { getMatch, replayUrl, type MatchDetail, type SeatResult } from "@/features/ladder/queries";
import { bannedNote, failureReason, versionLabel } from "./match-copy";
import styles from "./match-page.module.css";

export const metadata: Metadata = { title: "Match" };

function BotName({ seat, note }: { seat: SeatResult; note?: string | null }) {
  const version = versionLabel(seat.version);
  return (
    <>
      {seat.name ? (
        <BotTag name={seat.name} accent={PLAYER_COLORS[seat.slot]} />
      ) : (
        <>
          <Swatch slot={seat.slot} />
          <span className="muted">deleted bot</span>
        </>
      )}
      {version && <span className={styles.version}> {version}</span>}
      {seat.isHouse && <span className="muted small"> house</span>}
      {seat.banned && (note ? <span className="error-text small"> {note}</span> : <span className="error-text small"> banned</span>)}
    </>
  );
}

function EloCell({ seat }: { seat: SeatResult }) {
  const change = eloChange(seat.eloBefore, seat.eloAfter);
  if (!change) return <>n/a</>;
  return (
    <>
      {elo(seat.eloBefore)} → {elo(seat.eloAfter)}{" "}
      <span className={change.tone === "none" ? "muted" : change.tone}>{change.text}</span>
    </>
  );
}

function Results({ match }: { match: MatchDetail }) {
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 52 }}>Place</th>
            <th>Bot</th>
            <th className="num">Coverage</th>
            <th className="num">Deaths</th>
            <th className="num">Strikes</th>
            <th>Status</th>
            <th className="num">Elo</th>
          </tr>
        </thead>
        <tbody>
          {match.seats.map((s) => (
            <tr key={s.slot}>
              <td>{s.placement ?? "n/a"}</td>
              <td className="seat"><BotName seat={s} /></td>
              <td className="num">{percent(s.coverage)}</td>
              <td className="num">{s.deaths ?? "n/a"}</td>
              <td className="num">{s.strikes ?? "n/a"}</td>
              <td className={s.crashed ? undefined : "muted"}>{s.crashed ? "crashed" : "finished"}</td>
              <td className="num"><EloCell seat={s} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeatList({ match }: { match: MatchDetail }) {
  const bySlot = [...match.seats].sort((a, b) => a.slot - b.slot);
  return (
    <ul className={`list-plain ${styles.seats}`}>
      {bySlot.map((s) => (
        <li key={s.slot}>
          <BotName seat={s} note={bannedNote(match.status, s.banned)} />
        </li>
      ))}
    </ul>
  );
}

function FailedNotice({ error }: { error: string | null }) {
  const reason = failureReason(error);
  return (
    <div className={`notice ${styles.failed}`}>
      <p>This match couldn&apos;t be played. {reason.summary}</p>
      <p className="muted small">Failed matches don&apos;t change anyone&apos;s rating.</p>
      {reason.raw && (
        <details className={styles.raw}>
          <summary>Error details</summary>
          <pre>{reason.raw}</pre>
        </details>
      )}
    </div>
  );
}

// Rows and the viewer's frame at their final size, so the page doesn't jump when it loads.
function MatchSkeleton() {
  return (
    <>
      <Placeholder lines={7} />
      <section className={styles.replay}>
        <ReplaySkeleton />
      </section>
    </>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

// "finished 14 Oct, 00:42, 4 min ago": the relative part is only added while the
// time is under a day old; after that the date already says it.
function stamp(verb: string, iso: string, now: number): string {
  const recent = now - Date.parse(iso) < DAY_MS;
  return `${verb} ${shortDateTime(iso)}${recent ? `, ${relativeTime(iso, now)}` : ""}`;
}

async function MatchContent({ params }: { params: PageProps<"/matches/[id]">["params"] }) {
  const { id } = await params;
  if (!/^\d{1,15}$/.test(id)) notFound();
  const match = await getMatch(Number(id));
  if (!match) notFound();

  // eslint-disable-next-line react-hooks/purity -- server component, rendered fresh for each request
  const now = Date.now();
  let when: string | null = null;
  if (match.status === "done" && match.finishedAt) {
    when =
      stamp("finished", match.finishedAt, now) +
      (match.startedAt ? ` · took ${duration(match.startedAt, match.finishedAt)}` : "");
  } else if (match.status === "failed" && match.finishedAt) {
    when = stamp("failed", match.finishedAt, now);
  }

  return (
    <>
      <p className="crumbs">
        <Link href="/matches">Matches</Link> / {match.id}
      </p>
      <h1>Match {match.id}</h1>
      <p className="muted small" style={{ margin: "4px 0 20px" }}>
        Round {match.roundId}
        {when && ` · ${when}`} · seed <span className="mono">{match.seed}</span>
      </p>

      {match.status === "done" && (
        <>
          <LoadBoundary what="the results">
            <Results match={match} />
          </LoadBoundary>
          {match.replayPath ? (
            <section className={styles.replay}>
              <LoadBoundary what="the replay">
                <ReplayViewer
                  source={{ url: replayUrl(match.replayPath) }}
                  expected={match.seats.map((s) => ({
                    slot: s.slot, name: s.name, placement: s.placement, coverage: s.coverage,
                  }))}
                />
              </LoadBoundary>
              <p className="muted small" style={{ marginTop: 8 }}>
                <a href={replayUrl(match.replayPath)} download>
                  Download replay
                </a>{" "}
                (.jsonl.gz) · <Link href="/replay">open a replay file</Link>
              </p>
            </section>
          ) : (
            <p className="muted" style={{ marginTop: 20 }}>
              This match has no replay.
            </p>
          )}
        </>
      )}

      {(match.status === "queued" || match.status === "running") && (
        <>
          <p className="notice">This match hasn&apos;t finished yet.</p>
          <SeatList match={match} />
          <LiveRefresh table="matches" filter={`id=eq.${match.id}`} />
        </>
      )}

      {match.status === "failed" && (
        <>
          <FailedNotice error={match.error} />
          <SeatList match={match} />
        </>
      )}
    </>
  );
}

export default function MatchPage(props: PageProps<"/matches/[id]">) {
  return (
    <LoadBoundary what="this match">
      <Suspense fallback={<MatchSkeleton />}>
        <MatchContent params={props.params} />
      </Suspense>
    </LoadBoundary>
  );
}
