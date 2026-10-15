"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { nextRoundAt } from "@/features/ladder/format";
import styles from "./rule-instruments.module.css";

// The four limits from COMPETITION.md, each drawn as a small instrument in one slot colour.
// The list carries data-arm once hydrated (instruments drop to their start state) and
// data-play once it scrolls into view (they run their intro once). Hover or focus on a
// cell loops its instrument and reveals the detail line. Without JS, or with reduced
// motion, every instrument simply shows its finished state.

const ROUND_MS = 15 * 60_000;

function FileMeter() {
  // 5 x 6 cells inside a page with a folded corner; they fill bottom-up like a byte count.
  const cells = [];
  for (let i = 0; i < 30; i++) {
    const col = i % 5;
    const row = 5 - Math.floor(i / 5);
    cells.push(
      <rect
        key={i}
        className={styles.px}
        x={28 + col * 9}
        y={31 + row * 9}
        width={7}
        height={7}
        style={{ "--i": i } as CSSProperties}
      />,
    );
  }
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true">
      <path className={styles.outline} d="M22.5 8.5h37l16 16v63h-53z" />
      <path className={styles.outline} d="M59.5 8.5v16h16" />
      {cells}
    </svg>
  );
}

function MatchClock() {
  // The arena (five seats in the five slot colours) inside a ring that sweeps 180 s.
  const seats = [0, 1, 2, 3, 4].map((s) => {
    const a = (s / 5) * Math.PI * 2 - Math.PI / 2;
    return (
      <circle
        key={s}
        className={styles.seat}
        cx={48 + Math.cos(a) * 15}
        cy={48 + Math.sin(a) * 15}
        r={3.5}
        fill={`var(--slot-${s})`}
      />
    );
  });
  const ticks = [0, 1, 2, 3, 4, 5].map((t) => (
    <line key={t} className={styles.tick} x1={48} y1={5} x2={48} y2={9} transform={`rotate(${t * 60} 48 48)`} />
  ));
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true">
      {ticks}
      <circle className={styles.track} cx={48} cy={48} r={35} />
      <circle className={styles.sweep} cx={48} cy={48} r={35} pathLength={1} transform="rotate(-90 48 48)" />
      <circle className={styles.arena} cx={48} cy={48} r={25} />
      <g className={styles.seats}>{seats}</g>
    </svg>
  );
}

// One second of play: ten decisions, each straight, left or right.
const ACTIONS = [0, 0, 1, 0, 0, 2, 0, 1, 0, 0] as const;
const ARROW = ["M7 11V3M4 6l3-3 3 3", "M11 7H3m3-3L3 7l3 3", "M3 7h8M8 4l3 3-3 3"];

function DecisionTape() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true">
      {ACTIONS.map((a, i) => (
        <g
          key={i}
          className={styles.beat}
          transform={`translate(${5 + (i % 5) * 18} ${i < 5 ? 26 : 46})`}
          style={{ "--i": i } as CSSProperties}
        >
          <rect width={14} height={14} rx={2} />
          <rect className={styles.flash} width={14} height={14} rx={2} />
          <path d={ARROW[a]} />
        </g>
      ))}
      <line className={styles.track} x1={5} y1={72} x2={91} y2={72} />
      <line className={styles.scan} x1={5} y1={72} x2={91} y2={72} pathLength={1} />
    </svg>
  );
}

function RoundDial() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);
  // Minutes gone in the current quarter hour. Before hydration nothing is lit.
  const left = now === null ? null : Math.max(1, Math.ceil((nextRoundAt(now) - now) / 60_000));
  const elapsed = left === null ? -1 : 15 - left;
  const angle = now === null ? 0 : ((now % ROUND_MS) / ROUND_MS) * 360;
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true">
      {Array.from({ length: 15 }, (_, m) => (
        <line
          key={m}
          className={styles.minute}
          data-gone={m < elapsed || undefined}
          x1={48}
          y1={8}
          x2={48}
          y2={16}
          transform={`rotate(${m * 24} 48 48)`}
          style={{ "--i": m } as CSSProperties}
        />
      ))}
      <line className={styles.hand} x1={48} y1={48} x2={48} y2={22} transform={`rotate(${angle} 48 48)`} />
      <circle className={styles.hub} cx={48} cy={48} r={3} />
    </svg>
  );
}

const RULES = [
  {
    value: "1 MB",
    caption: "One .py file, weights included",
    detail: "Weights live inside the file. Pack them as int8 to fit.",
    href: "/docs/competition/what-you-submit",
    slot: 1,
    Meter: FileMeter,
  },
  {
    value: "180 s",
    caption: "Per match, five bots in the arena",
    detail: "Most land when the clock runs out wins.",
    href: "/docs/competition/the-game",
    slot: 0,
    Meter: MatchClock,
  },
  {
    value: "10/s",
    caption: "Decisions your bot makes",
    detail: "Each act() gets 50 ms. Answer late and you go straight.",
    href: "/docs/competition/sandbox",
    slot: 2,
    Meter: DecisionTape,
  },
  {
    value: "15 min",
    caption: "Between ladder rounds",
    detail: "Every active bot plays each round, grouped by rating.",
    href: "/docs/competition/how-it-runs",
    slot: 4,
    Meter: RoundDial,
  },
] as const;

export function RuleInstruments() {
  const ref = useRef<HTMLUListElement>(null);
  const [phase, setPhase] = useState<"rest" | "arm" | "play">("rest");
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase("play");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -20% 0px" },
    );
    // Arm only while the list is still below the fold, so nothing visible blinks back to
    // empty. Already on screen at hydration: leave it at rest.
    if (el.getBoundingClientRect().top <= window.innerHeight) return;
    setPhase("arm");
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <ul
      ref={ref}
      className={styles.list}
      data-arm={phase === "arm" || undefined}
      data-play={phase === "play" || undefined}
    >
      {RULES.map(({ value, caption, detail, href, slot, Meter }) => (
        <li key={value} style={{ "--c": `var(--slot-${slot})` } as CSSProperties}>
          <Link href={href} className={styles.cell}>
            <span className={styles.meter}>
              <Meter />
            </span>
            <span className={styles.value}>{value}</span>
            <span className={styles.caption}>{caption}</span>
            <span className={styles.detail}>
              {detail}
              <span aria-hidden="true"> →</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
