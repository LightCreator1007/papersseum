import type { Metadata } from "next";
import Link from "next/link";
import { DOC_PAGES } from "@/lib/docs/manifest";
import styles from "./docs.module.css";

export const metadata: Metadata = { title: "Docs" };

const CARDS = [
  { href: "/docs/getting-started", title: "Getting started", text: "Install, write an agent, test it, upload it.", tag: "5 min", slot: 0 },
  { href: "/docs/competition", title: "Competition guide", text: "The rules, the game, the sandbox and the FAQ.", tag: `${DOC_PAGES.filter((p) => p.group === "Competition").length} pages`, slot: 1 },
  { href: "/docs/competition/what-you-submit", title: "What you submit", text: "One Python file, an Agent class, the limits it must respect.", tag: "read this", slot: 2 },
  { href: "/docs/competition/commands", title: "Command reference", text: "Every papersseum CLI command in one place.", tag: "CLI", slot: 3 },
  { href: "/docs/package", title: "The papersseum package", text: "What your agent sees, running matches, replays.", tag: "README", slot: 4 },
  { href: "/learn", title: "Learn RL from zero", text: "A course from first principles to a trained agent.", tag: "course", slot: 0 },
] as const;

export default function DocsHome() {
  return (
    <div className={styles.hub}>
      <h1>Docs</h1>
      <p>Everything a participant needs, from the first install to the final standings.</p>
      <div className={styles.cards}>
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className={styles.card}>
            <span className={styles.dot} style={{ background: `var(--slot-${c.slot})` }} aria-hidden />
            <strong>{c.title}</strong>
            <span>{c.text}</span>
            <em>{c.tag}</em>
          </Link>
        ))}
      </div>
    </div>
  );
}
