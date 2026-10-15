import type { Metadata } from "next";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { LoadBoundary } from "@/components/load-boundary";
import { MatchList } from "@/features/ladder/components/match-list";
import { Placeholder } from "@/components/placeholder";
import styles from "./matches-page.module.css";

export const metadata: Metadata = { title: "Matches" };

async function Page({ searchParams }: { searchParams: PageProps<"/matches">["searchParams"] }) {
  const raw = (await searchParams).page;
  const page = typeof raw === "string" && /^[1-9]\d{0,5}$/.test(raw) ? Number(raw) : 1;
  return <MatchList page={page} pageSize={50} />;
}

export default function MatchesPage(props: PageProps<"/matches">) {
  return (
    <>
      <header className={styles.head}>
        <h1>Matches</h1>
        <p className="muted">Five bots, one board, every 15 minutes. Newest first.</p>
        <div className={styles.stamp}>
          <AutoRefresh stamp />
        </div>
      </header>
      <LoadBoundary what="matches">
        <Suspense fallback={<Placeholder lines={10} />}>
          <Page searchParams={props.searchParams} />
        </Suspense>
      </LoadBoundary>
    </>
  );
}
