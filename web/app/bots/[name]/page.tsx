import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { EloLine } from "@/features/ladder/components/elo-line";
import { LoadBoundary } from "@/components/load-boundary";
import { Placeholder } from "@/components/placeholder";
import { ProfileHero } from "@/components/profile-hero";
import { EmptyState } from "@/components/ui/empty-state";
import { elo, eloChange, nextRoundSentence, percent, rating, relativeTime, shortDate } from "@/features/ladder/format";
import { matchHref } from "@/features/ladder/links";
import { getBot, getBotHistory, getSeason, type BotProfile } from "@/features/ladder/queries";
import { getRoundOutlook } from "@/features/ladder/round-outlook";
import { callRpc } from "@/lib/server/rpc";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bot" };

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

// What a bot with no matches does next. Banned and inactive bots don't play, so no clock time.
async function NoMatches({ bot }: { bot: BotProfile }) {
  let body: string;
  if (bot.banned) body = "Banned bots don't play.";
  else if (bot.activeVersion === null) body = "It plays once a version passes its check.";
  else {
    const season = await getSeason().catch(() => null);
    body = nextRoundSentence(await getRoundOutlook(season?.frozen ?? false));
  }
  return <EmptyState title="No matches yet" body={body} />;
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
  if (!bot) {
    const alias = await callRpc<string | null>(await createClient(), "resolve_bot_name", { p_name: name });
    if (alias.ok && alias.data && alias.data !== name) permanentRedirect(`/bots/${alias.data}`);
    notFound();
  }
  const history = await getBotHistory(bot.id, 100);
  // Same as the leaderboard: with no games there is only the starting Elo, so no rank or rating.
  const unrated = bot.games === 0;

  const chronological = [...history].reverse();
  const series = chronological.length
    ? [chronological[0].eloBefore, ...chronological.map((h) => h.eloAfter)].filter((v): v is number => v !== null)
    : [];

  return (
    <>
      <ProfileHero name={bot.name} appearance={bot.appearance} rank={unrated ? null : bot.rank}>
        {bot.isHouse ? "House bot" : `Owned by ${bot.owner ?? "a deleted account"}`}
        {bot.activeVersion && bot.activeSince && ` · version ${bot.activeVersion}, active since ${shortDate(bot.activeSince)}`}
      </ProfileHero>
      {bot.activeVersion === null && !bot.banned && (
        <p className="muted small">No version is playing on the ladder yet.</p>
      )}
      {bot.banned && <p className="notice" style={{ marginTop: 16 }}>This bot is banned.</p>}

      <div className="stats">
        <Stat label="Rank" value={unrated ? "-" : bot.rank ?? "n/a"} />
        <Stat label="Rating" value={rating(bot.rating, bot.games)} />
        <Stat
          label="Elo"
          value={
            unrated ? "-" : (
              <>
                {elo(bot.elo)}{" "}
                {bot.sigma !== null && <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>± {elo(bot.sigma)}</span>}
              </>
            )
          }
        />
        <Stat label="Games" value={bot.games} />
      </div>

      {history.length === 0 ? (
        <Suspense fallback={<Placeholder lines={3} />}>
          <NoMatches bot={bot} />
        </Suspense>
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
                      <td className="muted">{h.finishedAt ? relativeTime(h.finishedAt) : "n/a"}</td>
                      <td className="num">{h.placement ?? "n/a"}</td>
                      <td className="num">{percent(h.coverage)}</td>
                      <td className={`num ${change && change.tone !== "none" ? change.tone : "muted"}`}>{change?.text ?? "n/a"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <AutoRefresh stamp />
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
