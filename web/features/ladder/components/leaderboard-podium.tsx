import Link from "next/link";
import { BotCharacter } from "@/components/character/bot-character";
import { characterFor, signatureColor } from "@/lib/character/for-bot";
import { elo } from "@/features/ladder/format";
import { botHref } from "@/features/ladder/links";
import type { LeaderRow } from "@/features/ladder/queries";
import styles from "./leaderboard-podium.module.css";

// Top three, second-first-third so the leader stands in the middle.
export function LeaderboardPodium({ rows }: { rows: LeaderRow[] }) {
  const top = rows.filter((r) => r.games > 0).slice(0, 3);
  if (top.length < 3) return null;
  const order = [top[1], top[0], top[2]];
  return (
    <ol className={styles.podium} aria-label="Top three">
      {order.map((r) => {
        const g = characterFor(r);
        const place = r === top[0] ? 1 : r === top[1] ? 2 : 3;
        return (
          <li key={r.botId} className={styles.step} data-place={place}>
            <Link href={botHref(r.name)} className={styles.card}>
              <BotCharacter genome={g} size={place === 1 ? 112 : 84} accent={signatureColor(g)} state="idle" label={r.name} />
              <span className={styles.rank}>{place}</span>
              <strong title={r.name}>{r.name}</strong>
              <span className={styles.rating}>{elo(r.rating)}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
