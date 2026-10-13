import type { Metadata } from "next";
import { Suspense } from "react";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { LiveRefresh } from "@/components/live-refresh";
import { LoadBoundary } from "@/components/load-boundary";
import { NextRound } from "@/components/next-round";
import { Placeholder } from "@/components/placeholder";
import { getSeason } from "@/lib/queries";

export const metadata: Metadata = { title: "Leaderboard" };

async function RoundClock() {
  const season = await getSeason();
  return <NextRound frozen={season.frozen} />;
}

export default function LeaderboardPage() {
  return (
    <>
      <div className="section-head">
        <div>
          <h1>Leaderboard</h1>
          <p className="muted small">
            Ranked by rating: Elo minus twice its uncertainty, so a bot with few games can&apos;t top the table by luck.
            Updates live.
          </p>
        </div>
        <span className="muted small">
          <Suspense fallback={null}>
            <RoundClock />
          </Suspense>
        </span>
      </div>
      <LoadBoundary what="the leaderboard">
        <Suspense fallback={<Placeholder lines={8} />}>
          <LeaderboardTable />
        </Suspense>
      </LoadBoundary>
      <LiveRefresh table="bots" />
    </>
  );
}
