"use client";

import { useState, type CSSProperties } from "react";
import { BotCharacter } from "@/components/character/bot-character";
import { genomeFromSeed } from "@/lib/character/genome";
import { PLAYER_COLORS } from "@/features/ladder/colors";
import styles from "./head-overlay.module.css";

type Head = readonly [row: number, col: number] | null;
type Ring = { id: number; slot: number; row: number; col: number };

type Props = {
  width: number;
  height: number;
  heads: readonly Head[];
  names: readonly string[];
  still?: boolean;
};

const RIDER_CELLS = 8; // character width in board cells

// Pixel characters riding each snake head, plus a ring in the dead bot's colour
// where a head leaves the board. Sits over the board canvas, ignoring pointer events.
export function HeadOverlay({ width, height, heads, names, still = false }: Props) {
  const [rings, setRings] = useState<Ring[]>([]);
  const [frames, setFrames] = useState({ cur: heads, seq: 0 });

  // Derived state from the incoming heads: a head that disappears spawns a ring.
  if (frames.cur !== heads) {
    let seq = frames.seq;
    const added: Ring[] = [];
    frames.cur.forEach((h, slot) => {
      if (h && !heads[slot]) added.push({ id: seq++, slot, row: h[0], col: h[1] });
    });
    setFrames({ cur: heads, seq });
    if (added.length) setRings((r) => [...r.slice(-8), ...added]);
  }

  const at = (row: number, col: number): CSSProperties => ({
    left: `${((col + 0.5) / width) * 100}%`,
    top: `${((row + 0.5) / height) * 100}%`,
  });

  return (
    <div className={styles.overlay} aria-hidden>
      {heads.map((h, slot) =>
        h ? (
          <div
            key={slot}
            className={styles.rider}
            style={{ ...at(h[0], h[1]), width: `${(RIDER_CELLS / width) * 100}%` }}
          >
            <BotCharacter
              genome={genomeFromSeed(names[slot] ?? `seat-${slot}`)}
              size={24}
              accent={PLAYER_COLORS[slot] ?? "currentColor"}
              state={still ? "still" : "idle"}
              label={names[slot] ?? `Seat ${slot + 1}`}
            />
          </div>
        ) : null,
      )}
      {!still &&
        rings.map((r) => (
          <span
            key={r.id}
            className={styles.ring}
            style={{ ...at(r.row, r.col), color: PLAYER_COLORS[r.slot] }}
            onAnimationEnd={() => setRings((all) => all.filter((x) => x.id !== r.id))}
          />
        ))}
    </div>
  );
}
