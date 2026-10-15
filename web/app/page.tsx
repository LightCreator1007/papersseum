import Link from "next/link";
import { Suspense } from "react";
import { BoardReplay } from "@/features/replay/components/board-replay";
import { LeaderboardTable } from "@/features/ladder/components/leaderboard-table";
import { LiveRefresh } from "@/components/live-refresh";
import { LoadBoundary } from "@/components/load-boundary";
import { MatchList } from "@/features/ladder/components/match-list";
import { NextRound } from "@/features/ladder/components/next-round";
import { Placeholder } from "@/components/placeholder";
import { SignInButton } from "@/features/auth/components/sign-in-button";
import { getLadderStats, getSeason } from "@/features/ladder/queries";
import { getUserId } from "@/lib/supabase/server";

async function SeasonLine() {
  const season = await getSeason();
  return <p className="muted small">{season.name} · IIITDM Jabalpur</p>;
}

async function HeroActions() {
  const signedIn = (await getUserId()) !== null;
  return (
    <div className="actions">
      {signedIn ? (
        <Link href="/me" className="btn">
          Upload a bot
        </Link>
      ) : (
        <SignInButton next="/me" />
      )}
      <Link href="/getting-started">Read the rules</Link>
    </div>
  );
}

async function HeroStats() {
  const [season, stats] = await Promise.all([getSeason(), getLadderStats()]);
  return (
    <p className="muted small" style={{ marginTop: 28 }}>
      {stats.bots} {stats.bots === 1 ? "bot" : "bots"} · {stats.matches.toLocaleString("en-IN")}{" "}
      {stats.matches === 1 ? "match" : "matches"} played{" "}
      {!season.frozen && <>· <NextRound frozen={false} /></>}
    </p>
  );
}

export default function Home() {
  return (
    <>
      <section className="hero">
        <div>
          <LoadBoundary what="the season" quiet>
            <Suspense fallback={<p className="small">&nbsp;</p>}>
              <SeasonLine />
            </Suspense>
          </LoadBoundary>
          <h1 className="hero-title" style={{ marginTop: 14 }}>
            Write a bot.
            <br />
            Take the board.
          </h1>
          <p className="lede">
            Upload a Python agent. Every 15 minutes it plays territory capture against four others. Elo decides
            who&apos;s on top when the season ends.
          </p>
          <Suspense fallback={<div style={{ height: 40 }} />}>
            <HeroActions />
          </Suspense>
          <LoadBoundary what="ladder stats" quiet>
            <Suspense fallback={<p className="small" style={{ marginTop: 28 }}>&nbsp;</p>}>
              <HeroStats />
            </Suspense>
          </LoadBoundary>
        </div>
        <figure className="board">
          <BoardReplay />
        </figure>
      </section>

      <h2>Top of the ladder</h2>
      <LoadBoundary what="the leaderboard">
        <Suspense fallback={<Placeholder lines={5} />}>
          <LeaderboardTable limit={5} compact />
        </Suspense>
      </LoadBoundary>
      <p className="small" style={{ marginTop: 10 }}>
        <Link href="/leaderboard">Full leaderboard</Link>
      </p>

      <h2>Latest matches</h2>
      <LoadBoundary what="matches">
        <Suspense fallback={<Placeholder lines={3} />}>
          <MatchList pageSize={3} compact finishedOnly />
        </Suspense>
      </LoadBoundary>
      <p className="small" style={{ marginTop: 10 }}>
        <Link href="/matches">All matches</Link>
      </p>

      <LiveRefresh table="bots" />
      <LiveRefresh table="matches" />
    </>
  );
}
