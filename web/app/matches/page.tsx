import type { Metadata } from "next";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/live-refresh";
import { LoadBoundary } from "@/components/load-boundary";
import { MatchList } from "@/components/match-list";
import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = { title: "Matches" };

async function Page({ searchParams }: { searchParams: PageProps<"/matches">["searchParams"] }) {
  const raw = (await searchParams).page;
  const page = typeof raw === "string" && /^[1-9]\d{0,5}$/.test(raw) ? Number(raw) : 1;
  return <MatchList page={page} pageSize={50} />;
}

export default function MatchesPage(props: PageProps<"/matches">) {
  return (
    <>
      <h1 style={{ marginBottom: 14 }}>Matches</h1>
      <LoadBoundary what="matches">
        <Suspense fallback={<Placeholder lines={10} />}>
          <Page searchParams={props.searchParams} />
        </Suspense>
      </LoadBoundary>
      <LiveRefresh table="matches" />
    </>
  );
}
