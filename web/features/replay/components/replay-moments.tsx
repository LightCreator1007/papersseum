"use client";

import type { CSSProperties, ReactNode } from "react";
import type { ArenaEvent } from "@/lib/arena/events";
import { PLAYER_COLORS } from "@/features/ladder/colors";
import { clock } from "@/features/replay/replay-format";
import styles from "./replay-moments.module.css";

// Deaths, captures and lead changes on the match viewer's timeline (FigJam Flow 3: jump to
// the moment). The marks above the scrubber are for the pointer; the "Key moments" list is
// the same set for keyboard and screen readers, so the page doesn't gain dozens of tab stops.

const LEAD_IN = 20; // start a little before the moment so it can be seen happening

const GLYPH: Record<ArenaEvent["kind"], string> = { death: "✕", capture: "■", lead: "▲" };

function describe(e: ArenaEvent, name: string) {
  if (e.kind === "death") return `${name} is out`;
  if (e.kind === "capture") return `${name} captured ${e.cells} cells`;
  return `${name} takes the lead`;
}

type Props = {
  events: ArenaEvent[];
  frames: number;
  frame: number;
  names: readonly string[];
  onSeek: (frame: number) => void;
};

const nameOf = (names: readonly string[], slot: number) => names[slot] ?? `Seat ${slot + 1}`;
const target = (e: ArenaEvent) => Math.max(0, e.frame - LEAD_IN);

// The scrubber (children) with a lane of clickable marks above it.
export function MomentMarks({ events, frames, frame, names, onSeek, children }: Props & { children: ReactNode }) {
  const last = Math.max(1, frames - 1);
  return (
    <div className={styles.track}>
      {events.length > 0 && (
        <div className={styles.marks} aria-hidden>
          {events.map((e, i) => (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              className={styles.mark}
              data-kind={e.kind}
              data-past={e.frame <= frame || undefined}
              style={{ left: `${(e.frame / last) * 100}%`, "--c": PLAYER_COLORS[e.slot] } as CSSProperties}
              title={`${clock(e.frame)}  ${describe(e, nameOf(names, e.slot))}`}
              onClick={() => onSeek(target(e))}
            >
              {GLYPH[e.kind]}
            </button>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

// The same moments as a list behind a disclosure, for keyboard and screen readers.
export function MomentList({ events, frame, names, onSeek }: Omit<Props, "frames">) {
  if (events.length === 0) return null;
  return (
    <details className={styles.moments}>
      <summary>Key moments · {events.length}</summary>
      <ol>
        {events.map((e, i) => (
          <li key={i} data-past={e.frame <= frame || undefined}>
            <button type="button" onClick={() => onSeek(target(e))} style={{ "--c": PLAYER_COLORS[e.slot] } as CSSProperties}>
              <time>{clock(e.frame)}</time>
              <i data-kind={e.kind} aria-hidden>
                {GLYPH[e.kind]}
              </i>
              {describe(e, nameOf(names, e.slot))}
            </button>
          </li>
        ))}
      </ol>
    </details>
  );
}
