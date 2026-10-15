import type { ReactNode } from "react";
import { BotCharacter } from "@/components/character/bot-character";
import { characterFor, signatureColor } from "@/lib/character/for-bot";
import styles from "./profile-hero.module.css";

export function ProfileHero({ name, rank, children }: { name: string; rank: number | null; children: ReactNode }) {
  const g = characterFor({ name });
  const accent = signatureColor(g);
  return (
    <header className={styles.hero} style={{ "--hero-accent": accent } as React.CSSProperties}>
      <div className={styles.portrait}>
        <BotCharacter genome={g} size={128} accent={accent} state="idle" label={`${name}'s character`} lookAt />
      </div>
      <div className={styles.text}>
        {rank !== null && <span className={styles.rank}>#{rank}</span>}
        <h1>{name}</h1>
        <p>{children}</p>
      </div>
    </header>
  );
}
