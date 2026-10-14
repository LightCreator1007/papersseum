"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Swatch } from "@/components/swatch";
import { engineClient } from "@/lib/engine-client";
import type { ErrorStage, ReplayMeta, WorkerOut } from "@/lib/engine-protocol";
import {
  FrameStore, THEMES, applyFrame, buildColorTable, clock, headsAt, paintCells, type Theme,
} from "@/lib/replay-format";
import { parseResult, seatNames, verdict, verdictText, type ExpectedSeat } from "@/lib/replay-verdict";

export type ReplaySource = { url: string } | { bytes: Uint8Array };

const STEP_MS = 100; // 10 decisions per second at 1x: real match speed
const SPEEDS = [1, 2, 4];
const MAX_CATCH_UP = 20; // frames per animation tick after a hiccup

type Phase =
  | { kind: "fetching" }
  | { kind: "loading-engine" }
  | { kind: "computing" }
  | { kind: "done"; text: string }
  | { kind: "error"; stage: ErrorStage | "fetch"; message: string };

function errorText(phase: Extract<Phase, { kind: "error" }>, available: number): string {
  switch (phase.stage) {
    case "fetch":
      return "Couldn't fetch this replay.";
    case "engine":
      return "Couldn't load the replay engine.";
    case "replay":
      return `This isn't a Papersseum replay: ${phase.message}.`;
    case "run":
      return `The replay stopped at ${clock(Math.max(0, available - 1))}: ${phase.message}`;
  }
}

type Props = { source: ReplaySource; expected?: ExpectedSeat[] };

// Re-runs a match with the real engine in the browser and plays it. A Retry
// remounts the inner run, so every attempt starts from clean state.
export function ReplayViewer(props: Props) {
  const [attempt, setAttempt] = useState(0);
  return <ViewerRun key={attempt} {...props} onRetry={() => setAttempt((a) => a + 1)} />;
}

function ViewerRun({ source, expected, onRetry }: Props & { onRetry: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const storeRef = useRef<FrameStore | null>(null);
  const cellsRef = useRef(new Uint8Array(0));
  const imageRef = useRef<ImageData | null>(null);
  const frameRef = useRef(0);
  const endedRef = useRef(false); // the run failed: no more frames will arrive
  const themeRef = useRef<Theme>("light");
  const tableRef = useRef<Uint8ClampedArray | null>(null);
  const [frames, setFrames] = useState(0); // 0 until the header arrives
  const [available, setAvailable] = useState(0);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [phase, setPhase] = useState<Phase>("url" in source ? { kind: "fetching" } : { kind: "loading-engine" });
  const [names, setNames] = useState(() => seatNames(null, expected));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const store = storeRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !store) return;
    if (!imageRef.current) {
      canvas.width = store.width;
      canvas.height = store.height;
      imageRef.current = ctx.createImageData(store.width, store.height);
    }
    tableRef.current ??= buildColorTable(themeRef.current);
    paintCells(imageRef.current.data, cellsRef.current, tableRef.current);
    ctx.putImageData(imageRef.current, 0, 0);
    ctx.fillStyle = THEMES[themeRef.current].head;
    for (const head of headsAt(store, frameRef.current)) if (head) ctx.fillRect(head[1] - 1, head[0] - 1, 3, 3);
  }, []);

  // Light or dark board, following the system setting live.
  useEffect(() => {
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      themeRef.current = dark.matches ? "dark" : "light";
      tableRef.current = buildColorTable(themeRef.current);
      draw();
    };
    apply();
    dark.addEventListener("change", apply);
    return () => dark.removeEventListener("change", apply);
  }, [draw]);

  // Fetch (match page) or take the bytes (drop page), then run the engine.
  useEffect(() => {
    let cancelled = false;
    let cancelRun = () => {};
    let meta: ReplayMeta | null = null;
    const autoplay = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const onMessage = (m: WorkerOut) => {
      switch (m.type) {
        case "status":
          setPhase({ kind: m.stage });
          break;
        case "start": {
          meta = m.meta;
          const store = new FrameStore(m.header);
          storeRef.current = store;
          cellsRef.current = store.initial.slice();
          frameRef.current = 0;
          setNames(seatNames(m.meta.players, expected));
          setFrames(store.frames);
          setAvailable(store.available);
          draw();
          break;
        }
        case "frames": {
          const store = storeRef.current;
          if (!store) return;
          const first = store.available === 1;
          try {
            store.append(m.bytes);
          } catch (error) {
            cancelRun();
            endedRef.current = true;
            setPhase({ kind: "error", stage: "run", message: String(error) });
            return;
          }
          setAvailable(store.available);
          if (first && autoplay) setPlaying(true);
          break;
        }
        case "done": {
          if (!meta) return;
          const v = verdict({
            shippedHash: meta.shippedHash,
            engineHash: meta.engineHash,
            got: m.result,
            recorded: parseResult(meta.recorded),
            expected,
          });
          setPhase({ kind: "done", text: verdictText(v, seatNames(meta.players, expected)) });
          break;
        }
        case "error":
          endedRef.current = true;
          setPhase({ kind: "error", stage: m.stage, message: m.message });
          break;
      }
    };

    (async () => {
      let bytes: Uint8Array;
      if ("bytes" in source) {
        bytes = source.bytes;
      } else {
        try {
          const res = await fetch(source.url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          bytes = new Uint8Array(await res.arrayBuffer());
        } catch (error) {
          if (!cancelled) setPhase({ kind: "error", stage: "fetch", message: String(error) });
          return;
        }
      }
      if (!cancelled) cancelRun = engineClient().run(bytes, onMessage);
    })();

    return () => {
      cancelled = true;
      cancelRun();
    };
  }, [source, expected, draw]);

  // Playback: advance at 10 decisions per second times the speed, waiting at
  // the edge of what the engine has computed so far.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const store = storeRef.current;
      if (!store) return;
      const step = STEP_MS / speed;
      let steps = 0;
      while (now - last >= step && frameRef.current < store.available - 1 && steps < MAX_CATCH_UP) {
        frameRef.current++;
        applyFrame(cellsRef.current, store, frameRef.current);
        last += step;
        steps++;
      }
      if (steps) {
        draw();
        setFrame(frameRef.current);
      }
      if (frameRef.current >= store.frames - 1 || (endedRef.current && frameRef.current >= store.available - 1)) {
        setPlaying(false);
        return;
      }
      if (steps === MAX_CATCH_UP || frameRef.current >= store.available - 1) last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, draw]);

  const seek = (target: number) => {
    const store = storeRef.current;
    if (!store) return;
    const to = Math.max(0, Math.min(target, store.available - 1));
    if (to < frameRef.current) {
      cellsRef.current.set(store.initial);
      frameRef.current = 0;
    }
    while (frameRef.current < to) {
      frameRef.current++;
      applyFrame(cellsRef.current, store, frameRef.current);
    }
    draw();
    setFrame(to);
  };

  const toggle = () => {
    const store = storeRef.current;
    if (!store) return;
    if (!playing && (frameRef.current >= store.frames - 1 || (endedRef.current && frameRef.current >= store.available - 1))) seek(0);
    setPlaying(!playing);
  };

  const ready = frames > 0;
  const status =
    phase.kind === "error"
      ? errorText(phase, available)
      : phase.kind === "done"
        ? phase.text
        : phase.kind === "fetching"
          ? "Fetching the replay…"
          : phase.kind === "loading-engine"
            ? "Loading the replay engine (one-time download)…"
            : `Computing the match… ${frames ? Math.floor((available / frames) * 100) : 0}%`;
  const canRetry = phase.kind === "error" && (phase.stage === "fetch" || phase.stage === "engine");
  const failedBeforeStart = phase.kind === "error" && !ready;

  return (
    <div className="replay">
      {!failedBeforeStart && (
        <div className="board">
          <canvas
            ref={canvasRef}
            width={120}
            height={120}
            hidden={!ready}
            role="img"
            aria-label="Replay of this match: five players' territories in the arena"
          />
          {!ready && <div className="replay-empty" />}
        </div>
      )}
      {ready && (
        <div className="actions replay-controls">
          <button type="button" className="btn-secondary" onClick={toggle}>
            {playing ? "Pause" : "Play"}
          </button>
          <input
            type="range"
            className="replay-scrub"
            min={0}
            max={frames - 1}
            value={frame}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Match time"
          />
          <span className="num small">
            {clock(frame)} / {clock(frames - 1)}
          </span>
          <span className="replay-speeds">
            {SPEEDS.map((s) => (
              <button key={s} type="button" className="link-button" aria-pressed={speed === s} onClick={() => setSpeed(s)}>
                {s}×
              </button>
            ))}
          </span>
        </div>
      )}
      <ul className="list-plain replay-legend">
        {names.map((name, slot) => (
          <li key={slot} className="seat">
            <Swatch slot={slot} />
            {name}
          </li>
        ))}
      </ul>
      <p className="small replay-status" role="status">
        <span className={phase.kind === "error" ? "error-text" : "muted"}>{status}</span>
        {canRetry && (
          <>
            {" "}
            <button type="button" className="link-button" onClick={onRetry}>
              Retry
            </button>
          </>
        )}
      </p>
    </div>
  );
}
