"use client";

import { useEffect, useRef, useState } from "react";
import {
  THEMES, applyFrame, buildColorTable, decodeReplay, headsAt, paintCells, type Replay, type Theme,
} from "@/features/replay/replay-format";

const STEP_MS = 100; // 10 decisions per second: real match speed
const HOLD_MS = 3000; // pause on the final board before restarting
const MAX_CATCH_UP = 5; // frames per animation tick after a hiccup

async function loadReplay(signal: AbortSignal): Promise<Replay> {
  const res = await fetch("/home-replay.dat", { signal });
  if (!res.ok || !res.body) throw new Error(`replay fetch failed: ${res.status}`);
  const raw = await new Response(res.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  return decodeReplay(new Uint8Array(raw));
}

// Replays one real match on loop. Shows the static board until it is ready,
// and keeps showing it without JavaScript or when reduced motion is preferred.
export function BoardReplay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof DecompressionStream === "undefined") return;

    const controller = new AbortController();
    let stop = () => {};

    const start = (replay: Replay) => {
      const cleanups: (() => void)[] = [];
      stop = () => cleanups.splice(0).forEach((cleanup) => cleanup());
      try {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) throw new Error("the canvas is not available");
        canvas.width = replay.width;
        canvas.height = replay.height;

        const dark = window.matchMedia("(prefers-color-scheme: dark)");
        let theme: Theme = dark.matches ? "dark" : "light";
        let table = buildColorTable(theme);
        const image = ctx.createImageData(replay.width, replay.height);
        const cells = replay.initial.slice();
        let frame = 0;
        let last = performance.now();
        let holdUntil = 0;
        let raf = 0;
        let onScreen = true;

        const draw = () => {
          paintCells(image.data, cells, table);
          ctx.putImageData(image, 0, 0);
          ctx.fillStyle = THEMES[theme].head;
          for (const head of headsAt(replay, frame)) if (head) ctx.fillRect(head[1] - 1, head[0] - 1, 3, 3);
        };

        const tick = (now: number) => {
          if (holdUntil) {
            if (now >= holdUntil) {
              holdUntil = 0;
              cells.set(replay.initial);
              frame = 0;
              last = now;
              draw();
            }
          } else {
            let steps = 0;
            while (now - last >= STEP_MS && frame < replay.frames - 1 && steps < MAX_CATCH_UP) {
              frame++;
              applyFrame(cells, replay, frame);
              last += STEP_MS;
              steps++;
            }
            if (steps === MAX_CATCH_UP) last = now;
            if (steps) draw();
            if (frame === replay.frames - 1) holdUntil = now + HOLD_MS;
          }
          raf = requestAnimationFrame(tick);
        };

        const running = () => raf !== 0;
        const play = () => {
          if (running() || !onScreen || document.hidden) return;
          last = performance.now();
          raf = requestAnimationFrame(tick);
        };
        const pause = () => {
          cancelAnimationFrame(raf);
          raf = 0;
        };
        cleanups.push(pause);

        const observer = new IntersectionObserver((entries) => {
          // Several entries can arrive in one batch; the last one is the current state.
          onScreen = entries[entries.length - 1].isIntersecting;
          if (onScreen) play();
          else pause();
        });
        cleanups.push(() => observer.disconnect());
        observer.observe(canvas);
        const onVisibility = () => (document.hidden ? pause() : play());
        document.addEventListener("visibilitychange", onVisibility);
        cleanups.push(() => document.removeEventListener("visibilitychange", onVisibility));
        const onTheme = () => {
          theme = dark.matches ? "dark" : "light";
          table = buildColorTable(theme);
          draw();
        };
        dark.addEventListener("change", onTheme);
        cleanups.push(() => dark.removeEventListener("change", onTheme));

        draw();
        setReady(true);
        play();
      } catch (error) {
        // Release whatever was set up and keep the static board.
        stop();
        setReady(false);
        console.warn("Board replay could not start; showing the static board.", error);
      }
    };

    loadReplay(controller.signal).then(
      (replay) => {
        if (!controller.signal.aborted) start(replay);
      },
      (error) => {
        if (controller.signal.aborted) return; // unmounted while loading
        console.warn("Board replay could not be loaded; showing the static board.", error);
      },
    );

    return () => {
      controller.abort();
      stop();
    };
  }, []);

  return (
    <>
      {!ready && (
        <picture>
          <source srcSet="/board-dark.svg" media="(prefers-color-scheme: dark)" />
          <img src="/board-light.svg" alt="A Papersseum board mid-match: five players' territories in an arena" width={120} height={120} />
        </picture>
      )}
      <canvas
        ref={canvasRef}
        width={120}
        height={120}
        hidden={!ready}
        role="img"
        aria-label="A recorded Papersseum match replaying: five players' territories in an arena"
      />
    </>
  );
}
