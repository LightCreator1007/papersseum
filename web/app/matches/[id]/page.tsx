import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/live-refresh";
import { LoadBoundary } from "@/components/load-boundary";
import { Placeholder } from "@/components/placeholder";
import { ReplayViewer } from "@/components/replay-viewer";
import { Swatch } from "@/components/swatch";
import { duration, elo, eloChange, percent, relativeTime, shortDateTime } from "@/lib/format";
import { botHref } from "@/lib/links";
import { getMatch, replayUrl, type MatchDetail, type SeatResult } from "@/lib/queries";

export const metadata: Metadata = { title: "Match" };

function BotName({ seat }: { seat: SeatResult }) {
  return (
    <>
      <Swatch slot={seat.slot} />
      {seat.name ? <Link href={botHref(seat.name)}>{seat.name}</Link> : <span className="muted">deleted bot</span>}
      {seat.isHouse && <span className="muted small"> house</span>}
    </>
  );
}

function EloCell({ seat }: { seat: SeatResult }) {
  const change = eloChange(seat.eloBefore, seat.eloAfter);
  if (!change) return <>—</>;
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
              <td>{s.placement ?? "—"}</td>
              <td className="seat"><BotName seat={s} /></td>
              <td className="num">{percent(s.coverage)}</td>
              <td className="num">{s.deaths ?? "—"}</td>
              <td className="num">{s.strikes ?? "—"}</td>
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
    <ul className="list-plain">
      {bySlot.map((s) => (
        <li key={s.slot} style={{ padding: "4px 0", whiteSpace: "nowrap" }}>
          <BotName seat={s} />
        </li>
      ))}
    </ul>
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
          <Results match={match} />
          {match.replayPath ? (
            <section style={{ marginTop: 28 }}>
              <ReplayViewer
                source={{ url: replayUrl(match.replayPath) }}
                expected={match.seats.map((s) => ({
                  slot: s.slot, name: s.name, placement: s.placement, coverage: s.coverage,
                }))}
              />
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
          <p className="notice">This match couldn&apos;t be played.</p>
          <SeatList match={match} />
        </>
      )}
    </>
  );
}

export default function MatchPage(props: PageProps<"/matches/[id]">) {
  return (
    <LoadBoundary what="this match">
      <Suspense fallback={<Placeholder lines={7} />}>
        <MatchContent params={props.params} />
      </Suspense>
    </LoadBoundary>
  );
}
