import Link from "next/link";
import { BotTag } from "@/components/bot-tag";
import { EmptyState } from "@/components/ui/empty-state";
import { LeaderboardPodium } from "@/features/ladder/components/leaderboard-podium";
import { elo } from "@/features/ladder/format";
import { windowLadder } from "@/features/ladder/ladder-order";
import { getLeaderboard, getMyBot, type LeaderRow } from "@/features/ladder/queries";
import { getUserId } from "@/lib/supabase/server";
import styles from "./leaderboard-table.module.css";

// Under this many games a rating still moves a lot, so it's marked provisional (FigJam Rating stickies).
export const PROVISIONAL_GAMES = 10;

// The signed-in visitor's bot id, if any. A failed lookup only loses the highlight.
async function myBotId(): Promise<string | null> {
  const userId = await getUserId();
  if (!userId) return null;
  return (await getMyBot(userId).catch(() => null))?.id ?? null;
}

function Row({ r, mine, compact }: { r: LeaderRow; mine: string | null; compact: boolean }) {
  return (
    <tr className={styles.row} data-mine={r.botId === mine || undefined} data-unrated={r.games === 0 || undefined}>
      <td className="rank-cell">{r.games === 0 ? "-" : r.rank}</td>
      <td>
        <span className={styles.bot} title={r.name}>
          <BotTag name={r.name} appearance={r.appearance} />
          {r.isHouse && <span className={styles.house} title="House bot, run by the organisers">house</span>}
          {r.botId === mine && <span className={styles.you}>you</span>}
        </span>
      </td>
      {!compact && <td className="muted">{r.isHouse ? "-" : r.owner}</td>}
      <td className="num">
        {r.games === 0 ? (
          <span className={styles.unrated}>Not rated yet</span>
        ) : (
          <>
            <b>{elo(r.rating)}</b>
            {r.games < PROVISIONAL_GAMES && (
              <abbr className={styles.provisional} title={`Provisional: under ${PROVISIONAL_GAMES} games, so it can still move a lot`}>
                P
              </abbr>
            )}
          </>
        )}
      </td>
      {!compact && <td className="num">{r.games === 0 ? <span className="muted">-</span> : elo(r.elo)}</td>}
      {!compact && <td className="num muted">{r.games === 0 ? "-" : elo(r.sigma)}</td>}
      <td className="num">{r.games}</td>
      {!compact && <td className="num muted">{r.version ? `v${r.version}` : "none"}</td>}
    </tr>
  );
}

export async function LeaderboardTable({
  limit,
  compact = false,
  podium = false,
  showAll = false,
}: {
  limit?: number;
  compact?: boolean;
  podium?: boolean;
  /** Past 100 bots the table shows the top 100 plus your own row; this shows every row. */
  showAll?: boolean;
}) {
  const [all, mine] = await Promise.all([getLeaderboard(limit), myBotId()]);
  if (all.length === 0) {
    const signedIn = (await getUserId()) !== null;
    return (
      <EmptyState
        title="No bots on the ladder yet"
        body="Upload one and it joins after its test match. The first bot here leads the season."
        action={signedIn ? { label: "Upload your bot", href: "/me#upload" } : { label: "Get started", href: "/docs/getting-started" }}
      />
    );
  }
  const view = windowLadder(all, { mine, showAll });
  const cols = compact ? 4 : 8;
  return (
    <>
      {podium && <LeaderboardPodium rows={all} />}
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Bot</th>
              {!compact && <th>Owner</th>}
              <th className="num">Rating</th>
              {!compact && <th className="num">Elo</th>}
              {!compact && <th className="num">±</th>}
              <th className="num">Games</th>
              {!compact && <th className="num">Version</th>}
            </tr>
          </thead>
          <tbody>
            {view.rows.map((r) => (
              <Row key={r.botId} r={r} mine={mine} compact={compact} />
            ))}
            {view.pinned && (
              <>
                <tr className={styles.gap} aria-hidden="true">
                  <td colSpan={cols}>...</td>
                </tr>
                <Row r={view.pinned} mine={mine} compact={compact} />
              </>
            )}
          </tbody>
        </table>
      </div>
      {view.hidden > 0 && (
        <p className={styles.more}>
          Showing the top {view.rows.length} of {view.total} bots.{" "}
          <Link href="/leaderboard?all=1" scroll={false}>
            Show all {view.total}
          </Link>
        </p>
      )}
    </>
  );
}
