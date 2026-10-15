import type { ReactNode } from "react";
import { BotCharacter } from "@/components/character/bot-character";
import { genomeFromSeed } from "@/lib/character/genome";
import styles from "./lesson-art.module.css";

// Small pixel drawings, one per lesson, on a 64 x 36 grid of whole pixels.
// Colours come from classes so both themes repaint them: ink, rule, soft, muted, s0 to s4 (slot colours).

type Tone = "ink" | "rule" | "soft" | "muted" | "s0" | "s1" | "s2" | "s3" | "s4";
const SLOTS: Tone[] = ["s0", "s1", "s2", "s3", "s4"];

function P({ x, y, w = 1, h = 1, c = "ink", o }: { x: number; y: number; w?: number; h?: number; c?: Tone; o?: number }) {
  return <rect x={x} y={y} width={w} height={h} className={styles[c]} opacity={o} />;
}

// A seeded random source so a drawing is the same on every render.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function Bot({ seed, x, y, size, slot }: { seed: string; x: number; y: number; size: number; slot: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <BotCharacter genome={genomeFromSeed(seed)} size={size} accent={`var(--slot-${slot})`} state="still" label="" />
    </g>
  );
}

function ArrowRight({ x, y, len, c = "muted" }: { x: number; y: number; len: number; c?: Tone }) {
  return (
    <>
      <P x={x} y={y} w={len} c={c} />
      <P x={x + len - 2} y={y - 1} c={c} />
      <P x={x + len - 2} y={y + 1} c={c} />
      <P x={x + len - 3} y={y - 2} c={c} />
      <P x={x + len - 3} y={y + 2} c={c} />
    </>
  );
}

function ArrowLeft({ x, y, len, c = "muted" }: { x: number; y: number; len: number; c?: Tone }) {
  return (
    <>
      <P x={x} y={y} w={len} c={c} />
      <P x={x + 1} y={y - 1} c={c} />
      <P x={x + 1} y={y + 1} c={c} />
      <P x={x + 2} y={y - 2} c={c} />
      <P x={x + 2} y={y + 2} c={c} />
    </>
  );
}

// Chevrons for policy grids: 2 x 3 pointing right, 3 x 2 pointing up.
function Glyph({ x, y, dir, c = "muted" }: { x: number; y: number; dir: "up" | "right"; c?: Tone }) {
  return dir === "right" ? (
    <>
      <P x={x} y={y} c={c} />
      <P x={x + 1} y={y + 1} c={c} />
      <P x={x} y={y + 2} c={c} />
    </>
  ) : (
    <>
      <P x={x + 1} y={y} c={c} />
      <P x={x} y={y + 1} c={c} />
      <P x={x + 2} y={y + 1} c={c} />
    </>
  );
}

// 00: the agent acts on the world, the world answers with a reward.
function Loop() {
  const cells = [2, 2, 1, 1, 2, 0, 1, 1, 0, 0, 3, 3, 4, 0, 3, 3];
  return (
    <>
      <Bot seed="welcome" x={6} y={12} size={12} slot={1} />
      <ArrowRight x={21} y={10} len={18} />
      <ArrowLeft x={21} y={26} len={18} c="s2" />
      {cells.map((s, i) => (
        <P key={i} x={42 + (i % 4) * 4} y={10 + Math.floor(i / 4) * 4} w={3} h={3} c={SLOTS[s]} o={0.85} />
      ))}
    </>
  );
}

// 01: a histogram with its expected value marked.
function Toolkit() {
  const heights = [5, 9, 14, 19, 17, 12, 8, 4];
  return (
    <>
      <P x={6} y={30} w={52} c="rule" />
      {heights.map((h, i) => (
        <P key={i} x={8 + i * 6} y={30 - h} w={4} h={h} c={i === 3 ? "s1" : "ink"} o={i === 3 ? 1 : 0.75} />
      ))}
      {[4, 8, 12, 16, 20, 24].map((y) => (
        <P key={y} x={30} y={y} h={2} c="s0" />
      ))}
    </>
  );
}

// 02: an array of numbers between brackets.
function Arrays() {
  const r = rng(2);
  return (
    <>
      <P x={8} y={7} h={23} c="muted" />
      <P x={8} y={7} w={3} c="muted" />
      <P x={8} y={29} w={3} c="muted" />
      <P x={55} y={7} h={23} c="muted" />
      <P x={53} y={7} w={3} c="muted" />
      <P x={53} y={29} w={3} c="muted" />
      {Array.from({ length: 24 }, (_, i) => (
        <P key={i} x={13 + (i % 8) * 5} y={11 + Math.floor(i / 8) * 5} w={4} h={4} c={i === 13 ? "s4" : "ink"} o={i === 13 ? 1 : 0.15 + r() * 0.6} />
      ))}
    </>
  );
}

// 03: five slot machines and the coins each one paid.
function Bandits() {
  const coins = [1, 3, 2, 6, 1];
  return (
    <>
      {coins.map((n, i) => {
        const x = 5 + i * 12;
        return (
          <g key={i}>
            <P x={x} y={6} w={8} h={13} c="rule" />
            <P x={x + 2} y={9} w={4} h={4} c={SLOTS[i]} />
            <P x={x + 9} y={7} h={7} c="muted" />
            <P x={x + 8} y={6} w={3} h={2} c="muted" />
            {Array.from({ length: n }, (_, k) => (
              <P key={k} x={x + 1} y={30 - k * 2} w={6} h={1} c="s3" />
            ))}
          </g>
        );
      })}
    </>
  );
}

// 04: rewards further in the future count for less.
function Discount() {
  return (
    <>
      <P x={4} y={31} w={56} c="rule" />
      {Array.from({ length: 8 }, (_, i) => {
        const h = Math.max(1, Math.round(24 * 0.72 ** i));
        return <P key={i} x={6 + i * 7} y={31 - h} w={5} h={h} c={i === 0 ? "s2" : "ink"} o={i === 0 ? 1 : 0.7} />;
      })}
    </>
  );
}

const GOAL = { x: 7, y: 0 };

// 05: how good each square is, darker nearer the goal.
function Values() {
  return (
    <>
      {Array.from({ length: 32 }, (_, i) => {
        const x = i % 8;
        const y = Math.floor(i / 8);
        const px = 4 + x * 7;
        const py = 4 + y * 7;
        if (x === GOAL.x && y === GOAL.y) return <P key={i} x={px} y={py} w={6} h={6} c="s2" />;
        if (x === 5 && y === 2) return <P key={i} x={px} y={py} w={6} h={6} c="s0" />;
        if (x === 2 && y > 0 && y < 3) return <P key={i} x={px} y={py} w={6} h={6} c="rule" />;
        const d = GOAL.x - x + y;
        return <P key={i} x={px} y={py} w={6} h={6} c="s1" o={Math.max(0.08, 0.85 - d * 0.1)} />;
      })}
    </>
  );
}

// 06: a policy, one arrow per square, all leading to the goal.
function Policy() {
  return (
    <>
      {Array.from({ length: 32 }, (_, i) => {
        const x = i % 8;
        const y = Math.floor(i / 8);
        const px = 4 + x * 7;
        const py = 4 + y * 7;
        if (x === GOAL.x && y === GOAL.y) return <P key={i} x={px} y={py} w={6} h={6} c="s2" />;
        return (
          <g key={i}>
            <P x={px} y={py} w={6} h={6} c="soft" />
            {x === GOAL.x || (y > 0 && x >= 5) ? (
              <Glyph x={px + 2} y={py + 2} dir="up" c={x === GOAL.x ? "ink" : "muted"} />
            ) : (
              <Glyph x={px + 2} y={py + 2} dir="right" c={y === 0 ? "ink" : "muted"} />
            )}
          </g>
        );
      })}
    </>
  );
}

// 07: many whole games, each walking its own path to the end.
function Walks() {
  return (
    <>
      <P x={58} y={6} w={2} h={24} c="s2" />
      {[0, 1, 4].map((slot, k) => {
        const r = rng(7 + k * 31);
        let y = 18;
        return Array.from({ length: 18 }, (_, i) => {
          y = Math.min(30, Math.max(5, y + Math.round((r() - 0.5) * 6)));
          return <P key={`${k}-${i}`} x={4 + i * 3} y={y} w={2} h={2} c={SLOTS[slot]} o={0.35 + (i / 18) * 0.65} />;
        });
      })}
    </>
  );
}

// 08: learn one step at a time, each state nudging the one before it.
function Td() {
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => (
        <P key={i} x={4 + i * 10} y={9} w={6} h={6} c={i === 2 ? "s1" : "ink"} o={i === 2 ? 1 : 0.7} />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <P x={7 + i * 10} y={18} h={4} c={i === 2 ? "s1" : "rule"} />
          <P x={17 + i * 10} y={18} h={4} c={i === 2 ? "s1" : "rule"} />
          <P x={7 + i * 10} y={22} w={11} c={i === 2 ? "s1" : "rule"} />
          <P x={6 + i * 10} y={19} w={3} c={i === 2 ? "s1" : "rule"} />
        </g>
      ))}
    </>
  );
}

// 09: gradient descent, a ball stepping down a curve.
function Descent() {
  const curve = (x: number) => Math.round(30 - ((x - 34) * (x - 34)) / 36);
  const steps = [8, 18, 25, 29, 32, 34];
  return (
    <>
      {Array.from({ length: 54 }, (_, i) => {
        const x = 6 + i;
        const y = curve(x);
        return y >= 4 ? <P key={i} x={x} y={y} c="muted" /> : null;
      })}
      {steps.map((x, i) => (
        <P key={x} x={x - 1} y={curve(x) - 3} w={3} h={3} c="s1" o={0.25 + (i / (steps.length - 1)) * 0.75} />
      ))}
      <P x={33} y={32} w={3} h={1} c="s2" />
    </>
  );
}

const LAYERS = [
  { x: 10, n: 3, c: "ink" as Tone },
  { x: 31, n: 4, c: "s1" as Tone },
  { x: 52, n: 2, c: "s2" as Tone },
];
const nodeY = (n: number, k: number) => 18 - ((n - 1) * 7) / 2 + k * 7;

// 10: a tiny network, weighted sums stacked in layers.
function Net() {
  return (
    <>
      {LAYERS.slice(0, -1).flatMap((a, li) =>
        Array.from({ length: a.n }, (_, i) =>
          Array.from({ length: LAYERS[li + 1].n }, (_, j) => (
            <line
              key={`${li}-${i}-${j}`}
              x1={a.x + 2}
              y1={nodeY(a.n, i)}
              x2={LAYERS[li + 1].x + 2}
              y2={nodeY(LAYERS[li + 1].n, j)}
              className={styles.wire}
            />
          )),
        ),
      )}
      {LAYERS.flatMap((l) => Array.from({ length: l.n }, (_, k) => <P key={`${l.x}-${k}`} x={l.x} y={nodeY(l.n, k) - 2} w={4} h={4} c={l.c} />))}
    </>
  );
}

// 11: a game screen goes in, a value per action comes out.
function Dqn() {
  const r = rng(11);
  const q = [7, 13, 5, 10];
  return (
    <>
      {Array.from({ length: 36 }, (_, i) => (
        <P key={i} x={4 + (i % 6) * 3} y={9 + Math.floor(i / 6) * 3} w={3} h={3} c={r() > 0.45 ? SLOTS[Math.floor(r() * 5)] : "soft"} o={0.8} />
      ))}
      <ArrowRight x={24} y={18} len={6} />
      <P x={32} y={11} w={4} h={4} c="ink" />
      <P x={32} y={21} w={4} h={4} c="ink" />
      <P x={38} y={16} w={4} h={4} c="s1" />
      <ArrowRight x={44} y={18} len={4} />
      {q.map((w, i) => (
        <P key={i} x={50} y={10 + i * 4} w={w} h={2} c={i === 1 ? "s2" : "muted"} />
      ))}
    </>
  );
}

// 12: probabilities over actions, nudged toward what worked.
function Nudge() {
  const before = [12, 12, 10];
  const after = [8, 20, 6];
  return (
    <>
      <P x={6} y={31} w={52} c="rule" />
      {after.map((h, i) => {
        const x = 12 + i * 16;
        return (
          <g key={i}>
            <P x={x} y={31 - before[i]} w={8} h={before[i]} c="soft" />
            <P x={x + 2} y={31 - h} w={4} h={h} c={i === 1 ? "s4" : "ink"} o={i === 1 ? 1 : 0.6} />
          </g>
        );
      })}
      <P x={32} y={2} h={7} c="s4" />
      <P x={31} y={3} w={3} c="s4" />
      <P x={30} y={4} c="s4" />
      <P x={34} y={4} c="s4" />
    </>
  );
}

// 13: two players learning against each other, and the Elo curve between them.
function Versus() {
  return (
    <>
      <Bot seed="red corner" x={3} y={20} size={12} slot={0} />
      <Bot seed="blue corner" x={49} y={20} size={12} slot={1} />
      {Array.from({ length: 30 }, (_, i) => {
        const x = 17 + i;
        const y = Math.round(28 - 22 / (1 + Math.exp(-(x - 32) / 3.5)));
        return <P key={i} x={x} y={y} c="ink" o={0.8} />;
      })}
      <P x={31} y={16} w={3} h={3} c="s3" />
    </>
  );
}

// 14: the Papersseum arena, five territories on a round board.
function Arena() {
  const seeds = [
    [9, 6],
    [21, 5],
    [24, 12],
    [12, 14],
    [17, 9],
  ];
  const cells: ReactNode[] = [];
  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < 32; x++) {
      const dx = x - 15.5;
      const dy = y - 8.5;
      if (dx * dx + dy * dy > 72) continue;
      let best = 0;
      let bestD = Infinity;
      seeds.forEach(([sx, sy], i) => {
        const d = Math.abs(sx - x) + Math.abs(sy - y) * 1.2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      const owned = bestD < 5.5;
      cells.push(<P key={`${x}-${y}`} x={x * 2} y={y * 2} w={2} h={2} c={owned ? SLOTS[best] : "soft"} o={owned ? 0.55 : 1} />);
    }
  }
  return (
    <>
      {cells}
      {seeds.map(([x, y], i) => (
        <P key={i} x={x * 2} y={y * 2} w={2} h={2} c={SLOTS[i]} />
      ))}
    </>
  );
}

// Reference: a glossary, terms then their one-line meaning.
function Glossary() {
  const rows = [
    [8, 30],
    [12, 22],
    [6, 34],
    [10, 26],
    [9, 18],
  ];
  return (
    <>
      {rows.map(([t, d], i) => (
        <g key={i}>
          <P x={8} y={6 + i * 5} w={2} h={2} c={SLOTS[i]} />
          <P x={12} y={6 + i * 5} w={t} h={2} c="ink" o={0.85} />
          <P x={14 + t} y={6 + i * 5} w={d} h={2} c="rule" />
        </g>
      ))}
    </>
  );
}

// Reference: a cheat sheet, formulas in boxes.
function Cheats() {
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => {
        const x = 5 + (i % 3) * 19;
        const y = 5 + Math.floor(i / 3) * 14;
        return (
          <g key={i}>
            <P x={x} y={y} w={16} h={11} c="soft" />
            <P x={x + 2} y={y + 3} w={3} h={3} c={SLOTS[i % 5]} />
            <P x={x + 6} y={y + 4} w={8} c="ink" o={0.7} />
            <P x={x + 2} y={y + 8} w={10} c="muted" o={0.6} />
          </g>
        );
      })}
    </>
  );
}

// Anything without its own drawing gets seeded pixel noise in slot colours.
function Noise({ seed }: { seed: string }) {
  const r = rng(hash(seed));
  return (
    <>
      {Array.from({ length: 60 }, (_, i) => (
        <P key={i} x={4 + (i % 12) * 5} y={4 + Math.floor(i / 12) * 6} w={4} h={4} c={r() > 0.6 ? SLOTS[Math.floor(r() * 5)] : "soft"} o={0.8} />
      ))}
    </>
  );
}

const ART: Record<string, () => ReactNode> = {
  "00-welcome": Loop,
  "01-maths-toolkit": Toolkit,
  "02-python-numpy": Arrays,
  "03-bandits": Bandits,
  "04-mdps": Discount,
  "05-value-functions": Values,
  "06-dynamic-programming": Policy,
  "07-monte-carlo": Walks,
  "08-td-learning": Td,
  "09-function-approximation": Descent,
  "10-neural-networks": Net,
  "11-dqn": Dqn,
  "12-policy-gradients": Nudge,
  "13-multi-agent": Versus,
  "14-papersseum": Arena,
  glossary: Glossary,
  cheatsheet: Cheats,
};

export function LessonArt({ slug, className }: { slug: string; className?: string }) {
  const Drawing = ART[slug];
  return (
    <svg viewBox="0 0 64 36" className={className ? `${styles.art} ${className}` : styles.art} shapeRendering="crispEdges" aria-hidden="true">
      {Drawing ? <Drawing /> : <Noise seed={slug} />}
    </svg>
  );
}
