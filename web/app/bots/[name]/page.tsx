import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EloLine } from "@/features/ladder/components/elo-line";
import { LiveRefresh } from "@/components/live-refresh";
import { LoadBoundary } from "@/components/load-boundary";
import { Placeholder } from "@/components/placeholder";
import { elo, eloChange, percent, relativeTime, shortDate } from "@/features/ladder/format";
import { matchHref } from "@/features/ladder/links";
import { getBot, getBotHistory } from "@/features/ladder/queries";

export const metadata: Metadata = { title: "Bot" };

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

async function BotContent({ params }: { params: PageProps<"/bots/[name]">["params"] }) {
  const { name: raw } = await params;
  let name: string;
  try {
    name = decodeURIComponent(raw);
  } catch {
    notFound(); // malformed percent escape
  }
  const bot = await getBot(name);
  if (!bot) notFound();
  const history = await getBotHistory(bot.id, 100);

  const chronological = [...history].reverse();
  const series = chronological.length
    ? [chronological[0].eloBefore, ...chronological.map((h) => h.eloAfter)].filter((v): v is number => v !== null)
    : [];

  return (
    <>
      <h1>{bot.name}</h1>
      <p className="muted small" style={{ marginTop: 4 }}>
        {bot.isHouse ? "House bot" : `Owned by ${bot.owner ?? "a deleted account"}`}
        {bot.activeVersion && bot.activeSince && ` · version ${bot.activeVersion}, active since ${shortDate(bot.activeSince)}`}
      </p>
      {bot.activeVersion === null && !bot.banned && (
        <p className="muted small">No version is playing on the ladder yet.</p>
      )}
      {bot.banned && <p className="notice" style={{ marginTop: 16 }}>This bot is banned.</p>}

      <div className="stats">
        <Stat label="Rank" value={bot.rank ?? "—"} />
        <Stat label="Rating" value={elo(bot.rating)} />
        <Stat
          label="Elo"
          value={
            <>
              {elo(bot.elo)}{" "}
              {bot.sigma !== null && <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>± {elo(bot.sigma)}</span>}
            </>
          }
        />
        <Stat label="Games" value={bot.games} />
      </div>

      {history.length === 0 ? (
        <p className="muted">No matches yet.</p>
      ) : (
        <>
          <h2>{`Elo over ${history.length} ${history.length === 1 ? "match" : "matches"}`}</h2>
          <EloLine values={series} />

          <h2>Recent matches</h2>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Match</th>
                  <th>When</th>
                  <th className="num">Place</th>
                  <th className="num">Coverage</th>
                  <th className="num">Elo change</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 15).map((h) => {
                  const change = eloChange(h.eloBefore, h.eloAfter);
                  return (
                    <tr key={h.matchId}>
                      <td><Link href={matchHref(h.matchId)}>{h.matchId}</Link></td>
                      <td className="muted">{h.finishedAt ? relativeTime(h.finishedAt) : "—"}</td>
                      <td className="num">{h.placement ?? "—"}</td>
                      <td className="num">{percent(h.coverage)}</td>
                      <td className={`num ${change && change.tone !== "none" ? change.tone : "muted"}`}>{change?.text ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <LiveRefresh table="bots" filter={`id=eq.${bot.id}`} />
    </>
  );
}

export default function BotPage(props: PageProps<"/bots/[name]">) {
  return (
    <LoadBoundary what="this bot">
      <Suspense fallback={<Placeholder lines={8} />}>
        <BotContent params={props.params} />
      </Suspense>
    </LoadBoundary>
  );
}
