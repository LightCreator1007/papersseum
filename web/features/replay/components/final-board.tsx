import type { CSSProperties } from "react";
import { Swatch } from "@/features/ladder/components/swatch";
import { percent } from "@/features/ladder/format";
import type { FinalBoard as Board } from "@/features/replay/replay-fallback";
import styles from "./replay-viewer.module.css";

// The board's square, holding the recorded final territory when the replay
// itself can't be played.
export function FinalBoard({ board }: { board: Board }) {
  const label = board.shares.map((s) => `${s.name} ${percent(s.coverage)}`).join(", ");
  return (
    <div className={styles.final}>
      <p className={styles.finalHead}>Final territory, from the recorded results</p>
      <div className={styles.bar} role="img" aria-label={`Final territory: ${label}`}>
        {board.shares
          .filter((s) => s.width > 0)
          .map((s) => (
            <span key={s.slot} style={{ width: `${s.width}%`, "--c": `var(--slot-${s.slot})` } as CSSProperties} />
          ))}
      </div>
      <ol className={styles.shares}>
        {board.shares.map((s) => (
          <li key={s.slot}>
            <span className={styles.place}>{s.placement ?? ""}</span>
            <Swatch slot={s.slot} />
            <span className={styles.name}>{s.name}</span>
            <span className={styles.pct}>{percent(s.coverage)}</span>
          </li>
        ))}
        {board.unclaimed > 0.05 && (
          <li className={styles.unclaimed}>
            <span className={styles.place} />
            <span className={styles.name}>Unclaimed</span>
            <span className={styles.pct}>{percent(board.unclaimed)}</span>
          </li>
        )}
      </ol>
    </div>
  );
}

// The viewer's frame at its final size, for the page's loading state.
export function ReplaySkeleton() {
  return (
    <div className="replay" aria-hidden="true">
      <div className="board">
        <div className={styles.waiting}>Preparing replay</div>
      </div>
    </div>
  );
}
