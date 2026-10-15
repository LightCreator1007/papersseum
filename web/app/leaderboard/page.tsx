import type { Metadata } from "next";
import { Suspense } from "react";
import { LeaderboardTable } from "@/features/ladder/components/leaderboard-table";
import { AutoRefresh } from "@/components/auto-refresh";
import { LoadBoundary } from "@/components/load-boundary";
import { NextRound } from "@/features/ladder/components/next-round";
import { Placeholder } from "@/components/placeholder";
import { getSeason } from "@/features/ladder/queries";
import { getRoundOutlook } from "@/features/ladder/round-outlook";

export const metadata: Metadata = { title: "Leaderboard" };

async function RoundClock() {
  const season = await getSeason();
  const outlook = await getRoundOutlook(season.frozen);
  return <NextRound frozen={season.frozen} backlog={outlook.backlog} />;
}

async function Table({ searchParams }: { searchParams: PageProps<"/leaderboard">["searchParams"] }) {
  const { all } = await searchParams;
  return <LeaderboardTable podium showAll={all === "1"} />;
}

export default function LeaderboardPage(props: PageProps<"/leaderboard">) {
  return (
    <>
      <div className="section-head">
        <div>
          <h1>Leaderboard</h1>
          <p className="muted small">
            Ranked by rating: Elo minus twice its uncertainty, so a bot with few games can&apos;t top the table by luck. <abbr title="Provisional">P</abbr> marks a rating from under 10 games.
          </p>
          <AutoRefresh stamp />
        </div>
        <span className="muted small">
          <LoadBoundary what="the season" quiet>
            <Suspense fallback={null}>
              <RoundClock />
            </Suspense>
          </LoadBoundary>
        </span>
      </div>
      <LoadBoundary what="the leaderboard">
        <Suspense fallback={<Placeholder lines={8} />}>
          <Table searchParams={props.searchParams} />
        </Suspense>
      </LoadBoundary>
    </>
  );
}
