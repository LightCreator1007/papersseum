import Link from "next/link";
import { BotCharacter } from "@/components/character/bot-character";
import { groupByTime } from "@/features/ladder/components/matches/group";
import { MatchRow } from "@/features/ladder/components/matches/match-row";
import styles from "@/features/ladder/components/matches/matches.module.css";
import { EmptyState } from "@/components/ui/empty-state";
import { genomeFromSeed } from "@/lib/character/genome";
import { clockTime, nextRoundAt } from "@/features/ladder/format";
import { getMatches } from "@/features/ladder/queries";

export async function MatchList({
  page = 1,
  pageSize = 50,
  compact = false,
  finishedOnly = false,
}: {
  page?: number;
  pageSize?: number;
  compact?: boolean;
  finishedOnly?: boolean;
}) {
  const { matches, hasMore } = await getMatches({ page, pageSize, finishedOnly });
  // eslint-disable-next-line react-hooks/purity -- server component, rendered fresh for each request
  const now = Date.now();
  if (matches.length === 0) {
    return page === 1 ? (
      <EmptyState
        art={<BotCharacter genome={genomeFromSeed("first round")} size={72} accent="var(--slot-1)" state="idle" label="" />}
        title="No matches yet"
        body={`The first round starts at ${clockTime(nextRoundAt(now))}. Five bots share a board, every 15 minutes.`}
        action={{ label: "Build your first bot", href: "/docs/getting-started" }}
      />
    ) : (
      <EmptyState title="No more matches" body="You have reached the oldest match." action={{ label: "Back to the newest", href: "/matches" }} />
    );
  }

  const groups = compact ? [{ label: "", items: matches }] : groupByTime(matches, (m) => m.finishedAt ?? m.createdAt, now);
  return (
    <>
      <div className={styles.groups}>
        {groups.map((g) => (
          <section key={g.label + g.items[0].id} aria-label={g.label || "Matches"}>
            {g.label && (
              <header className={styles.groupHead}>
                <h2 className={styles.groupTitle}>{g.label}</h2>
                <span className={styles.groupCount}>
                  {g.items.length} {g.items.length === 1 ? "match" : "matches"}
                </span>
              </header>
            )}
            <ol className={styles.list}>
              {g.items.map((m) => (
                <MatchRow key={m.id} match={m} />
              ))}
            </ol>
          </section>
        ))}
      </div>
      {!compact && (page > 1 || hasMore) && (
        <nav className={styles.pager} aria-label="Pages">
          <span>
            {page > 1 && (
              <Link className={styles.pageLink} href={page === 2 ? "/matches" : `/matches?page=${page - 1}`}>
                ← Newer
              </Link>
            )}
          </span>
          <span className={styles.pageNo}>Page {page}</span>
          <span>
            {hasMore && (
              <Link className={styles.pageLink} href={`/matches?page=${page + 1}`}>
                Older →
              </Link>
            )}
          </span>
        </nav>
      )}
    </>
  );
}
