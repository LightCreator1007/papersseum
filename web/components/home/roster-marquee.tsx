import Link from "next/link";
import { BotCharacter } from "@/components/character/bot-character";
import { characterFor, signatureColor } from "@/lib/character/for-bot";
import { botHref } from "@/features/ladder/links";
import { getLeaderboard } from "@/features/ladder/queries";
import styles from "./home.module.css";

const MAX = 24;

// Every bot on the ladder parading past. The list is doubled so the CSS loop is seamless.
export async function RosterMarquee() {
  const rows = (await getLeaderboard()).slice(0, MAX);
  if (rows.length === 0) return null;
  const pass = (copy: number) =>
    rows.map((r) => {
      const g = characterFor({ name: r.name });
      return (
        <li key={`${copy}-${r.botId}`} aria-hidden={copy > 0 || undefined}>
          <Link href={botHref(r.name)} tabIndex={copy > 0 ? -1 : undefined}>
            <BotCharacter genome={g} size={56} accent={signatureColor(g)} state="idle" label={r.name} />
            <span>{r.name}</span>
            <em>#{r.rank}</em>
          </Link>
        </li>
      );
    });
  return (
    <section className={styles.marquee} aria-label="Bots on the ladder">
      <ul style={{ animationDuration: `${Math.max(20, rows.length * 4)}s` }}>
        {pass(0)}
        {pass(1)}
      </ul>
    </section>
  );
}
