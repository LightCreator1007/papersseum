import type { ReactNode } from "react";
import { BotCharacter, type CharacterState } from "@/components/character/bot-character";
import { genomeFromSeed } from "@/lib/character/genome";
import styles from "./state-page.module.css";

// Full-page states (sign in, not found, error): a big character, a pixel
// headline and the next step.
export function StatePage({
  seed,
  mood = "idle",
  code,
  title,
  children,
}: {
  seed: string;
  mood?: CharacterState;
  code?: string;
  title: string;
  children: ReactNode;
}) {
  const g = genomeFromSeed(seed);
  return (
    <section className={styles.page}>
      <div className={styles.art}>
        <BotCharacter genome={g} size={144} accent={`var(--slot-${g.signature})`} state={mood} label="" />
        {code && <span className={styles.code}>{code}</span>}
      </div>
      <div className={styles.body}>
        <h1>{title}</h1>
        {children}
      </div>
    </section>
  );
}
