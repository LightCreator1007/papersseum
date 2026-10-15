"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { BotCharacter } from "@/components/character/bot-character";
import type { BotGenome } from "@/lib/character/genome";
import { inLine, waitLine } from "@/features/upload/progress-copy";
import styles from "./check-progress.module.css";

// The upload state machine on /me (FigJam C1): uploaded, in line, scan and test match, verdict.
// Every wait has a stage and a ceiling: after STUCK_AFTER_MS the card says so and links to
// Status, and a paused arena is named straight away rather than after the ceiling.

export const STUCK_AFTER_MS = 10 * 60_000;

type Props = {
  version: number;
  stage: "queued" | "checking";
  createdAt: string;
  ahead: number | null;
  attempts: number;
  maxAttempts: number;
  workerPaused: boolean;
  genome: BotGenome;
  accent: string;
};

// A one-second clock shared by every subscriber; null on the server so the first client render
// matches the HTML and the elapsed time appears after hydration.
const subscribe = (tick: () => void) => {
  const id = window.setInterval(tick, 1000);
  return () => window.clearInterval(id);
};
const nowSecond = () => Math.floor(Date.now() / 1000) * 1000;
const noClock = () => null;

function elapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const h = Math.floor(s / 3600);
  return `${h} h ${Math.floor((s % 3600) / 60)} min`;
}

export function CheckProgress(p: Props) {
  const now = useSyncExternalStore(subscribe, nowSecond, noClock);
  const waited = now === null ? null : now - Date.parse(p.createdAt);
  const stuck = waited !== null && waited > STUCK_AFTER_MS;
  const current = p.stage === "queued" ? 1 : 2;

  const steps = [
    { label: "Uploaded", sub: `Version ${p.version}` },
    { label: "In line", sub: p.stage === "queued" ? inLine(p.ahead) : "Picked up" },
    { label: "Scan and test match", sub: "200 decisions vs house bots" },
    { label: "Verdict", sub: "Plays from the next round" },
  ];

  return (
    <section className={styles.card} aria-labelledby="check-title" data-stuck={stuck || p.workerPaused || undefined}>
      <header className={styles.head}>
        <BotCharacter genome={p.genome} size={40} accent={p.accent} state={p.workerPaused ? "still" : "working"} label="" />
        <div>
          <h2 id="check-title">Checking version {p.version}</h2>
          <p>{waitLine({ stage: p.stage, ahead: p.ahead, paused: p.workerPaused, stuck })}</p>
        </div>
        <time className={styles.clock} aria-label="Time since upload">
          {waited === null ? " " : elapsed(waited)}
        </time>
      </header>

      <ol className={styles.steps}>
        {steps.map((s, i) => (
          <li key={s.label} data-state={i < current ? "done" : i === current ? "now" : "next"} aria-current={i === current ? "step" : undefined}>
            <i aria-hidden />
            <span>{s.label}</span>
            <small>{s.sub}</small>
          </li>
        ))}
      </ol>

      {p.attempts > 1 && (
        <p className={styles.note}>
          Attempt {p.attempts} of {p.maxAttempts}. The last try couldn&apos;t run on our side, so it&apos;s being retried.
        </p>
      )}
      {p.workerPaused ? (
        <p className={styles.warn} role="status">
          Matches are paused, so checks are waiting too. Your upload is saved and gets checked when they resume.{" "}
          <Link href="/status">See status</Link>
        </p>
      ) : (
        stuck && (
          <p className={styles.warn} role="status">
            This is taking longer than usual. Your upload is saved; nothing to redo.{" "}
            <Link href="/status">See status</Link>
          </p>
        )
      )}
    </section>
  );
}
