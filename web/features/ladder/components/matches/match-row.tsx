import Link from "next/link";
import type { CSSProperties } from "react";
import { BotCharacter } from "@/components/character/bot-character";
import { Status, type StatusTone } from "@/components/ui/status";
import { characterFor } from "@/lib/character/for-bot";
import { MATCH_STATUS, percent, relativeTime } from "@/features/ladder/format";
import { matchHref } from "@/features/ladder/links";
import type { MatchStatus, MatchSummary, SeatSummary } from "@/features/ladder/queries";
import styles from "./matches.module.css";

const TONE: Record<MatchStatus, StatusTone> = { queued: "waiting", running: "live", done: "done", failed: "failed" };
const CTA: Record<MatchStatus, string> = { queued: "View match", running: "View match", done: "Watch replay", failed: "View error" };

const nameOf = (s: SeatSummary) => s.name ?? "deleted bot";

function Face({ seat, size }: { seat: SeatSummary; size: number }) {
  return <BotCharacter genome={characterFor(seat)} size={size} accent={`var(--slot-${seat.slot})`} state="still" label="" />;
}

// The other four, smallest to the right: a face with its place, then the names in one muted line.
function Field({ seats }: { seats: SeatSummary[] }) {
  return (
    <span className={styles.field}>
      <span className={styles.faces}>
        {seats.map((s) => (
          <span key={s.slot} className={styles.face} data-crashed={s.crashed || undefined}>
            <Face seat={s} size={24} />
            <span className={styles.place}>{s.placement}</span>
            {s.crashed && <span className={styles.crashMark} title="Crashed" />}
          </span>
        ))}
      </span>
      <span className={styles.names}>
        {seats.map((s, i) => (
          <span key={s.slot}>
            {i > 0 && ", "}
            <span className={s.crashed ? styles.crashed : undefined}>{nameOf(s)}</span>
            {s.crashed && <span className="sr-only"> (crashed)</span>}
          </span>
        ))}
      </span>
    </span>
  );
}

// Before a match has a result, all five stand in a row in seat order.
function Lineup({ seats }: { seats: SeatSummary[] }) {
  return (
    <span className={styles.lineup}>
      <span className={styles.lineupFaces}>
        {seats.map((s) => (
          <span key={s.slot} className={styles.lineupFace}>
            <Face seat={s} size={24} />
          </span>
        ))}
      </span>
      <span className={styles.names}>{seats.map(nameOf).join(", ")}</span>
    </span>
  );
}

// Each seat's share of the board, in finishing order. Unclaimed ground is the track.
function Territory({ seats }: { seats: SeatSummary[] }) {
  const shares = seats.filter((s) => (s.coverage ?? 0) > 0);
  if (shares.length === 0) return null;
  return (
    <span className={styles.territory} aria-hidden="true">
      {shares.map((s) => (
        <span key={s.slot} style={{ width: `${Math.min(100, s.coverage ?? 0)}%`, background: `var(--slot-${s.slot})` }} />
      ))}
    </span>
  );
}

export function MatchRow({ match }: { match: MatchSummary }) {
  const winner = match.status === "done" ? match.seats.find((s) => s.placement === 1) : undefined;
  const rest = winner ? match.seats.filter((s) => s !== winner) : match.seats;
  const when = relativeTime(match.finishedAt ?? match.createdAt);
  const accent: CSSProperties & { "--accent"?: string } = winner ? { "--accent": `var(--slot-${winner.slot})` } : {};
  const label = winner
    ? `Match ${match.id}, won by ${nameOf(winner)}, ${when}`
    : `Match ${match.id}, ${MATCH_STATUS[match.status].toLowerCase()}, ${when}`;

  return (
    <li className={styles.item}>
      <Link href={matchHref(match.id)} className={styles.row} data-status={match.status} data-winner={winner ? "" : undefined} aria-label={label}>
        <span className={styles.id}>
          <span className={styles.hash}>#</span>
          {match.id}
        </span>

        {winner ? (
          <>
            <span className={styles.winner} style={accent}>
              <span className={styles.stage}>
                <Face seat={winner} size={36} />
              </span>
              <span className={styles.winnerText}>
                <span className={styles.eyebrow}>
                  Winner{winner.coverage !== null && <> · {percent(winner.coverage)}<span className={styles.wide}> of the board</span></>}
                </span>
                <span className={styles.winnerName}>
                  <span className={styles.truncate}>{nameOf(winner)}</span>
                  {winner.isHouse && <span className={styles.house}>house</span>}
                </span>
              </span>
            </span>
            <Field seats={rest} />
          </>
        ) : (
          <Lineup seats={rest} />
        )}

        <span className={styles.meta}>
          <span className={styles.metaIdle}>
            {match.status !== "done" && <Status tone={TONE[match.status]} label={MATCH_STATUS[match.status]} />}
            <span className={styles.when}>{when}</span>
          </span>
          <span className={styles.cta} aria-hidden="true">
            {CTA[match.status]} <span className={styles.arrow}>→</span>
          </span>
        </span>

        {winner && <Territory seats={match.seats} />}
      </Link>
    </li>
  );
}
