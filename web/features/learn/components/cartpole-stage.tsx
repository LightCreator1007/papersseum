"use client";

import { useEffect, useRef, useState } from "react";
import { mulberry32, type Rng } from "@/features/learn/bandit";
import { ANGLE_LIMIT, MAX_STEPS, TRACK_LIMIT, reset, step, trainedAction, type State } from "@/features/learn/cartpole";

type Mode = "trained" | "random" | "you";
const MODES: { id: Mode; label: string }[] = [
  { id: "trained", label: "Trained network" },
  { id: "random", label: "Random pushes" },
  { id: "you", label: "You" },
];

type Frame = { state: State; steps: number; over: "fell" | "done" | null; best: number };

const W = 340;
const H = 150;
const SCALE = (W / 2 - 30) / TRACK_LIMIT;

// Chapter 11's demo: watch the trained network balance a pole, compare with random pushing, or try it yourself.
export function CartPoleStage() {
  const [mode, setMode] = useState<Mode>("trained");
  const [slow, setSlow] = useState(false);
  const seed = useRef(1);
  const rng = useRef<Rng>(mulberry32(1));
  const sim = useRef<{ state: State; steps: number; over: Frame["over"]; best: number }>({ state: [0, 0, 0, 0], steps: 0, over: null, best: 0 });
  const push = useRef(1); // the direction last chosen by the person (1 = right)
  const [frame, setFrame] = useState<Frame>({ state: [0, 0, 0, 0], steps: 0, over: null, best: 0 });
  const [round, setRound] = useState(0); // bumps to start a fresh episode

  useEffect(() => {
    // start a fresh episode whenever the mode or round changes
    seed.current += 1;
    rng.current = mulberry32(seed.current);
    sim.current = { state: reset(rng.current), steps: 0, over: null, best: sim.current.best };
    push.current = 1;
    setFrame({ ...sim.current });
    let restartTimer: ReturnType<typeof setTimeout> | undefined;

    const timer = setInterval(
      () => {
        const s = sim.current;
        if (s.over) return;
        let action: number;
        if (mode === "trained") action = trainedAction(s.state);
        else if (mode === "random") action = rng.current() < 0.5 ? 0 : 1;
        else action = push.current;
        const out = step(s.state, action);
        s.state = out.state;
        s.steps += 1;
        if (out.fell) s.over = "fell";
        else if (s.steps >= MAX_STEPS) s.over = "done";
        if (s.over) {
          s.best = Math.max(s.best, s.steps);
          if (mode !== "you") restartTimer = setTimeout(() => setRound((r) => r + 1), 1200);
        }
        setFrame({ state: s.state, steps: s.steps, over: s.over, best: s.best });
      },
      slow ? 70 : 20,
    );

    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") push.current = 0;
      else if (e.key === "ArrowRight") push.current = 1;
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(timer);
      if (restartTimer) clearTimeout(restartTimer);
      window.removeEventListener("keydown", onKey);
    };
  }, [mode, slow, round]);

  const [x, , theta] = frame.state;
  const cartX = W / 2 + x * SCALE;
  const poleLen = 62;
  const tipX = cartX + poleLen * Math.sin(theta);
  const tipY = 100 - poleLen * Math.cos(theta);
  const limitX = W / 2 + TRACK_LIMIT * SCALE;
  const warn = Math.abs(theta) > ANGLE_LIMIT * 0.66;

  return (
    <div className="demo" aria-label="Cart-pole">
      <p className="demo-title">Balance the pole</p>
      <p className="small muted">
        A cart slides along a track and a pole is hinged on top. Every step the cart is pushed left or right, and you score 1 for each step the pole stays up. The most you can score is {MAX_STEPS}.
      </p>

      <div className="actions">
        {MODES.map((m) => (
          <button key={m.id} type="button" className={m.id === mode ? "btn" : "btn-secondary"} onClick={() => (m.id === mode ? setRound((r) => r + 1) : setMode(m.id))} aria-pressed={m.id === mode}>
            {m.label}
          </button>
        ))}
        <label className="small">
          <input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} /> slow motion
        </label>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="plot" role="img" aria-label="A cart with a pole balanced on top of it">
        <line x1={W / 2 - limitX + W / 2} x2={limitX} y1={118} y2={118} className="spark-ref" />
        <rect x={cartX - 22} y={100} width={44} height={18} rx={3} className="cp-cart" />
        <line x1={cartX} y1={100} x2={tipX} y2={tipY} className={warn ? "cp-pole cp-pole-warn" : "cp-pole"} />
        <circle cx={tipX} cy={tipY} r={4} className="cp-tip" />
      </svg>

      {mode === "you" ? (
        <div className="actions">
          <button type="button" className="btn-secondary" onPointerDown={() => (push.current = 0)}>
            ← push left
          </button>
          <button type="button" className="btn-secondary" onPointerDown={() => (push.current = 1)}>
            push right →
          </button>
          <button type="button" className="link-button small" onClick={() => setRound((r) => r + 1)}>
            Try again
          </button>
          <span className="small muted">or use the ← → arrow keys. The cart is always being pushed one way or the other, so you can only switch direction.</span>
        </div>
      ) : null}

      <p className="demo-status" aria-live="polite">
        Steps: <strong>{frame.steps}</strong> · best so far: <strong>{frame.best}</strong>
        {frame.over === "fell" ? <span className="down"> · the pole fell</span> : null}
        {frame.over === "done" ? <span className="up"> · balanced for the full {MAX_STEPS} steps</span> : null}
      </p>
    </div>
  );
}
