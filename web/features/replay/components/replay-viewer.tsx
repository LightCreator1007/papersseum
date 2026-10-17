"use client";

import stage from "@/components/arena/arena-stage.module.css";
import { HeadOverlay } from "@/components/arena/head-overlay";
import { currentBoardTheme, onBoardThemeChange } from "@/lib/arena/board-theme";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Swatch } from "@/features/ladder/components/swatch";
import { engineClient } from "@/features/replay/engine-client";
import type { ErrorStage, ReplayMeta, WorkerOut } from "@/features/replay/engine-protocol";
import {
  FrameStore, THEMES, applyFrame, buildColorTable, clock, headsAt, paintCells, type Theme,
} from "@/features/replay/replay-format";
import { parseResult, seatAppearances, seatNames, verdict, verdictText, type ExpectedSeat } from "@/features/replay/replay-verdict";
import { MomentList, MomentMarks } from "@/features/replay/components/replay-moments";
import { FinalBoard } from "@/features/replay/components/final-board";
import { finalBoard } from "@/features/replay/replay-fallback";
import { LoadBoundary } from "@/components/load-boundary";
import styles from "./replay-viewer.module.css";
import { eventsFrom, keyMoments, playableCells, type ArenaEvent } from "@/lib/arena/events";

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
//
// Next keeps left pages alive but hidden (React <Activity>): hiding runs the
// effects' cleanups (cancelling a run in progress) and showing runs them again
// with state and refs kept. So a finished run is not run again on return, and a
// run interrupted by leaving restarts from a fully reset player.
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
  const seekedRef = useRef(false); // a seek happened: playback restarts its step clock
  const endedRef = useRef(false); // the run failed: no more frames will arrive
  const finishedRef = useRef(false); // verdict shown, or failed after frames arrived: never re-run
  const expectedRef = useRef(expected);
  const themeRef = useRef<Theme>("light");
  const tableRef = useRef<Uint8ClampedArray | null>(null);
  const [frames, setFrames] = useState(0); // 0 until the header arrives
  const [available, setAvailable] = useState(0);
  const [frame, setFrame] = useState(0);
  const [events, setEvents] = useState<ArenaEvent[]>([]); // known once every frame is computed
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [phase, setPhase] = useState<Phase>("url" in source ? { kind: "fetching" } : { kind: "loading-engine" });
  const [names, setNames] = useState(() => seatNames(null, expected));
  const [appearances] = useState(() => seatAppearances(expected));
  const [board, setBoard] = useState<{ width: number; height: number; heads: ReturnType<typeof headsAt> } | null>(null);

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
    const heads = headsAt(store, frameRef.current);
    for (const head of heads) if (head) ctx.fillRect(head[1] - 1, head[0] - 1, 3, 3);
    setBoard({ width: store.width, height: store.height, heads });
  }, []);

  // Light or dark board, following the site theme live.
  useEffect(() => {
    const apply = (theme: Theme) => {
      themeRef.current = theme;
      tableRef.current = buildColorTable(theme);
      draw();
    };
    apply(currentBoardTheme());
    return onBoardThemeChange(apply);
  }, [draw]);

  // Pause when the page is hidden, so the button reads "Play" on return.
  useLayoutEffect(() => () => setPlaying(false), []);

  // Read through a ref so a new (equal) array from a re-render doesn't restart the run.
  useEffect(() => {
    expectedRef.current = expected;
  }, [expected]);

  // Fetch (match page) or take the bytes (drop page), then run the engine.
  const url = "url" in source ? source.url : null;
  const givenBytes = "bytes" in source ? source.bytes : null;
  useEffect(() => {
    if (finishedRef.current) return; // shown again after it finished: keep the board and verdict
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
          // A restart (left mid-run and came back) begins playback afresh too.
          frameRef.current = 0;
          setEvents([]);
          endedRef.current = false;
          setFrame(0);
          setPlaying(false);
          setNames(seatNames(m.meta.players, expectedRef.current));
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
            finishedRef.current = true;
            setPhase({ kind: "error", stage: "run", message: String(error) });
            return;
          }
          setAvailable(store.available);
          if (store.available >= store.frames) setEvents(keyMoments(eventsFrom(store), playableCells(store)));
          if (first && autoplay) setPlaying(true);
          break;
        }
        case "done": {
          if (!meta) return;
          const expected = expectedRef.current;
          const v = verdict({
            shippedHash: meta.shippedHash,
            engineHash: meta.engineHash,
            got: m.result,
            recorded: parseResult(meta.recorded),
            expected,
          });
          finishedRef.current = true;
          setPhase({ kind: "done", text: verdictText(v, seatNames(meta.players, expected)) });
          break;
        }
        case "error":
          endedRef.current = true;
          if (storeRef.current) finishedRef.current = true; // the frames so far stay playable
          setPhase({ kind: "error", stage: m.stage, message: m.message });
          break;
      }
    };

    (async () => {
      let bytes: Uint8Array;
      if (givenBytes) {
        bytes = givenBytes;
      } else {
        try {
          const res = await fetch(url!);
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
  }, [url, givenBytes, draw]);

  // Playback: advance at 10 decisions per second times the speed, waiting at
  // the edge of what the engine has computed so far.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const store = storeRef.current;
      if (!store) return;
      if (seekedRef.current) {
        seekedRef.current = false;
        last = now; // count the next step from the seek, not from before it
      }
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
    seekedRef.current = true;
  };

  const toggle = () => {
    const store = storeRef.current;
    if (!store) return;
    if (!playing && (frameRef.current >= store.frames - 1 || (endedRef.current && frameRef.current >= store.available - 1))) seek(0);
    setPlaying(!playing);
  };

  const ready = frames > 0;
  // The live region below holds only this message, which changes per stage, so
  // a screen reader hears each stage and the verdict but not every percent.
  const failedBeforeStart = phase.kind === "error" && !ready;
  // Without a playable replay, the recorded result still shows how the board ended.
  const fallback = failedBeforeStart ? finalBoard(expected) : null;
  const status =
    phase.kind === "error"
      ? errorText(phase, available) + (fallback ? " The final territory is shown instead." : "")
      : phase.kind === "done"
        ? phase.text
        : phase.kind === "fetching"
          ? "Preparing replay: fetching the file…"
          : phase.kind === "loading-engine"
            ? "Preparing replay: loading the engine (one-time download)…"
            : "Computing the match…";
  const progress = phase.kind === "computing" ? ` ${frames ? Math.floor((available / frames) * 100) : 0}%` : null;
  const canRetry = phase.kind === "error" && (phase.stage === "fetch" || phase.stage === "engine");

  return (
    <div className="replay">
      {!failedBeforeStart && (
        <div className="board">
          <div className={stage.stage}>
            <canvas
              ref={canvasRef}
              width={120}
              height={120}
              hidden={!ready}
              role="img"
              aria-label="Replay of this match: five players' territories in the arena"
            />
            {ready && board && (
              <HeadOverlay width={board.width} height={board.height} heads={board.heads} names={names} appearances={appearances} still={!playing} />
            )}
          </div>
          {!ready && (
            <div className={styles.waiting} aria-hidden="true">
              Preparing replay
            </div>
          )}
        </div>
      )}
      {fallback && (
        <div className="board">
          <FinalBoard board={fallback} />
        </div>
      )}
      {ready && (
        <div className="actions replay-controls">
          <button type="button" className="btn-secondary" onClick={toggle}>
            {playing ? "Pause" : "Play"}
          </button>
          <MomentMarks events={events} frames={frames} frame={frame} names={names} onSeek={seek}>
            <input
              type="range"
              className="replay-scrub"
              min={0}
              max={frames - 1}
              value={frame}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="Match time"
              aria-valuetext={clock(frame)}
            />
          </MomentMarks>
          <span className="num small">
            {clock(frame)} / {clock(frames - 1)}
          </span>
          <span className="replay-speeds" role="group" aria-label="Playback speed">
            {SPEEDS.map((s) => (
              <button key={s} type="button" className="link-button" aria-pressed={speed === s} onClick={() => setSpeed(s)}>
                {s}×
              </button>
            ))}
          </span>
        </div>
      )}
      {ready && (
        <LoadBoundary what="the key moments">
          <MomentList events={events} frame={frame} names={names} onSeek={seek} />
        </LoadBoundary>
      )}
      {!fallback && (
        <ul className="list-plain replay-legend">
          {names.map((name, slot) => (
            <li key={slot} className="seat">
              <Swatch slot={slot} />
              {name}
            </li>
          ))}
        </ul>
      )}
      <p className="small replay-status">
        <span className={phase.kind === "error" ? "error-text" : "muted"}>
          <span role="status">{status}</span>
          {progress}
        </span>
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
