"use client";

import { BotCharacter } from "@/components/character/bot-character";
import { genomeFromSeed } from "@/lib/character/genome";
import { PLAYER_COLORS } from "@/features/ladder/colors";
import styles from "./arena-hud.module.css";

export type Hud = { frame: number; frames: number; coverage: number[] };

const short = (name: string) => name.replace(/^house_/, "");

// Quiet overlay in the bottom corner of the circular arena: who leads, and a stacked
// territory bar. The match clock and capture feed were dropped as noise on the home page.
export function ArenaHud({ hud, names }: { hud: Hud; names: readonly string[] }) {
  const leader = hud.coverage.reduce((best, c, i) => (c > hud.coverage[best] ? i : best), 0);

  return (
    <div className={styles.hud} aria-hidden>
      <div className={styles.leader}>
        <BotCharacter genome={genomeFromSeed(names[leader] ?? "")} size={28} accent={PLAYER_COLORS[leader]} state="still" label="" />
        <div>
          <span>Leading</span>
          <b>
            {short(names[leader] ?? "")} {(hud.coverage[leader] * 100).toFixed(1)}%
          </b>
        </div>
      </div>

      <div className={styles.bar}>
        {hud.coverage.map((c, i) => (
          <span key={i} style={{ width: `${c * 100}%`, background: PLAYER_COLORS[i] }} />
        ))}
      </div>
    </div>
  );
}
