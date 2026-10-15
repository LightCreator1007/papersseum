"use client";

import { useEffect, useRef, useState } from "react";
import { compose } from "@/lib/character/compose";
import { genomeFromSeed, type BotGenome } from "@/lib/character/genome";
import { PLAYER_COLORS } from "@/features/ladder/colors";
import styles from "./dino-game.module.css";

// A Chrome-dino style runner for the 404 page. Our pixel bot runs along the
// board edge and jumps territory blocks in the five slot colours.
// Space / ArrowUp / W / tap / click to start and jump. Best score is kept locally.

const W = 760; // logical canvas size; scaled to fit with CSS
const H = 220;
const GROUND = 184;
const PX = 4; // one character cell in canvas px
const BOT = 12 * PX;
const GRAVITY = 0.62;
const JUMP = -11.2;
const START_SPEED = 6;
const MAX_SPEED = 15;
const BEST_KEY = "papersseum:404-best";

type Phase = "ready" | "running" | "over";
type Block = { x: number; w: number; h: number; slot: number; fly: boolean };
type Cloud = { x: number; y: number; s: number };

function colours() {
  const css = getComputedStyle(document.documentElement);
  const read = (v: string, fallback: string) => css.getPropertyValue(v).trim() || fallback;
  return { text: read("--text", "#111"), bg: read("--bg", "#fafaf8"), rule: read("--rule", "#e4e4e0"), muted: read("--muted", "#666") };
}

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0; // storage blocked: the best score just isn't remembered
  }
}

export function DinoGame({ seed = "lost" }: { seed?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const jumpRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.imageSmoothingEnabled = false;

    const genome: BotGenome = genomeFromSeed(seed);
    const cells = compose(genome);
    const accent = PLAYER_COLORS[genome.signature];
    let c = colours();
    let state: Phase = "ready";
    let y = GROUND - BOT;
    let vy = 0;
    let speed = START_SPEED;
    let dist = 0;
    let blocks: Block[] = [];
    const clouds: Cloud[] = Array.from({ length: 4 }, (_, i) => ({ x: i * 220 + 60, y: 30 + (i % 3) * 22, s: 3 + (i % 2) }));
    let nextBlock = 420;
    let frame = 0;
    let raf = 0;
    let last = performance.now();
    let hiScore = readBest();
    setBest(hiScore);

    const onGround = () => y >= GROUND - BOT - 0.5;

    const drawBot = (x: number, top: number, dead: boolean) => {
      const bob = state === "running" && onGround() && Math.floor(frame / 5) % 2 === 0 ? -PX / 2 : 0;
      for (const cell of cells) {
        ctx.fillStyle =
          cell.part === "eye" ? c.bg : cell.part === "accent" ? accent : cell.part === "mouth" ? c.bg : c.text;
        if (dead && cell.part === "eye") ctx.fillStyle = PLAYER_COLORS[0];
        ctx.fillRect(x + cell.x * PX, top + cell.y * PX + bob, PX, PX);
      }
      // feet: two-frame run cycle
      ctx.fillStyle = c.text;
      const step = state === "running" && onGround() ? Math.floor(frame / 5) % 2 : 0;
      ctx.fillRect(x + 3 * PX, top + BOT + bob, PX * 2, PX * (step ? 1 : 2));
      ctx.fillRect(x + 7 * PX, top + BOT + bob, PX * 2, PX * (step ? 2 : 1));
    };

    const drawLogo = (x: number, yy: number, s: number) => {
      // the 3x3 plus/checker mark, faint, as clouds
      ctx.fillStyle = c.rule;
      const on = [[1, 0], [0, 1], [2, 1], [1, 2], [0, 0], [2, 2]];
      for (const [gx, gy] of on) ctx.fillRect(x + gx * s * 2, yy + gy * s * 2, s * 2, s * 2);
    };

    const drawBlock = (b: Block) => {
      const top = b.fly ? GROUND - BOT - 34 - b.h : GROUND - b.h;
      ctx.fillStyle = PLAYER_COLORS[b.slot];
      ctx.fillRect(b.x, top, b.w, b.h);
      // trail notch pattern so blocks read as pixel territory, not flat bars
      ctx.fillStyle = c.bg;
      for (let i = PX; i < b.w; i += PX * 3) ctx.fillRect(b.x + i, top + PX, PX, PX);
    };

    const render = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      for (const cl of clouds) drawLogo(cl.x, cl.y, cl.s);
      // ground: a dashed board edge
      ctx.fillStyle = c.text;
      ctx.fillRect(0, GROUND, W, 2);
      ctx.fillStyle = c.rule;
      for (let gx = -((dist * 1) % 24); gx < W; gx += 24) ctx.fillRect(gx, GROUND + 8, 10, 2);
      for (const b of blocks) drawBlock(b);
      drawBot(56, y, state === "over");
    };

    const hits = (b: Block) => {
      const bx = 56 + PX * 2;
      const bw = BOT - PX * 4;
      const by = y + PX * 3;
      const bh = BOT - PX * 3;
      const top = b.fly ? GROUND - BOT - 34 - b.h : GROUND - b.h;
      return bx < b.x + b.w && bx + bw > b.x && by < top + b.h && by + bh > top;
    };

    const spawn = () => {
      const fly = dist > 1200 && Math.random() < 0.25;
      const w = PX * (fly ? 6 : 2 + Math.floor(Math.random() * 4));
      const h = fly ? PX * 4 : PX * (5 + Math.floor(Math.random() * 6));
      blocks.push({ x: W + 10, w, h, slot: Math.floor(Math.random() * 5), fly });
      // clusters early on are friendlier; gaps tighten with speed
      nextBlock = 260 + Math.random() * 320 + speed * 8;
    };

    const tick = (now: number) => {
      const dt = Math.min(2, (now - last) / 16.67);
      last = now;
      frame++;
      if (state === "running") {
        speed = Math.min(MAX_SPEED, START_SPEED + dist / 1400);
        dist += speed * dt;
        vy += GRAVITY * dt;
        y = Math.min(GROUND - BOT, y + vy * dt);
        if (onGround()) vy = 0;
        nextBlock -= speed * dt;
        if (nextBlock <= 0) spawn();
        for (const b of blocks) b.x -= speed * dt;
        blocks = blocks.filter((b) => b.x + b.w > -10);
        for (const cl of clouds) {
          cl.x -= speed * 0.15 * dt;
          if (cl.x < -40) cl.x = W + Math.random() * 120;
        }
        const s = Math.floor(dist / 10);
        if (frame % 3 === 0) setScore(s);
        if (blocks.some(hits)) {
          state = "over";
          setPhase("over");
          setScore(s);
          if (s > hiScore) {
            hiScore = s;
            setBest(s);
            try {
              localStorage.setItem(BEST_KEY, String(s));
            } catch {
              // storage blocked: keep the best for this visit only
            }
          }
        }
      }
      render();
      raf = state === "running" ? requestAnimationFrame(tick) : 0;
    };

    const start = () => {
      blocks = [];
      dist = 0;
      speed = START_SPEED;
      nextBlock = 420;
      y = GROUND - BOT;
      vy = 0;
      state = "running";
      setPhase("running");
      setScore(0);
      last = performance.now();
      if (!raf) raf = requestAnimationFrame(tick);
    };

    jumpRef.current = () => {
      if (state !== "running") return start();
      if (onGround()) vy = JUMP;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        jumpRef.current();
      }
    };
    const onTheme = () => {
      c = colours();
      render();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("themechange", onTheme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", onTheme);
    render();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("themechange", onTheme);
      media.removeEventListener("change", onTheme);
    };
  }, [seed]);

  return (
    <div className={styles.game}>
      <div className={styles.hud} aria-live="polite">
        <span>HI {String(best).padStart(5, "0")}</span>
        <span>{String(score).padStart(5, "0")}</span>
      </div>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onPointerDown={(e) => {
          e.preventDefault();
          jumpRef.current();
        }}
        role="img"
        aria-label="A small game: a pixel bot jumping over coloured blocks. Press space or tap to jump."
      />
      {phase !== "running" && (
        <p className={styles.prompt}>
          {phase === "ready" ? "Press space or tap to run" : `Game over · ${score} · press space or tap to retry`}
        </p>
      )}
    </div>
  );
}
