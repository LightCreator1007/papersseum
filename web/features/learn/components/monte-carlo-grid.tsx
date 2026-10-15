"use client";

import { useRef, useState } from "react";
import { ARROW, COLS, GOAL, PIT, ROWS, START, isWall, type Cell } from "@/features/learn/gridworld";
import { makeLearner, runEpisode, snapshot, type Learner, type Snapshot } from "@/features/learn/montecarlo";

// Chapter 7's demo: the same grid, but the agent is never told the rules. It plays whole episodes and learns from the returns.
export function MonteCarloGrid() {
  const learner = useRef<Learner>(makeLearner(5)); // mutable; only touched inside the handlers below
  const [snap, setSnap] = useState<Snapshot>(() => snapshot(makeLearner(5)));
  const [epsilon, setEpsilon] = useState(0.1);
  const [slip, setSlip] = useState(0);
  const [last, setLast] = useState<{ steps: number; total: number } | null>(null);

  function play(count: number) {
    const l = learner.current;
    l.epsilon = epsilon;
    l.slip = slip;
    let out = null;
    for (let i = 0; i < count; i++) out = runEpisode(l);
    setLast(out);
    setSnap(snapshot(l));
  }

  function reset() {
    learner.current = makeLearner(Math.floor(Math.random() * 1_000_000) + 1);
    setLast(null);
    setSnap(snapshot(learner.current));
  }

  function tile(r: number, c: number) {
    const cell: Cell = [r, c];
    const k = `${r}${c}`;
    if (isWall(cell)) return <div key={k} className="gw gw-wall" aria-label="wall" />;
    if (cell[0] === GOAL[0] && cell[1] === GOAL[1]) return <div key={k} className="gw gw-goal">+1</div>;
    if (cell[0] === PIT[0] && cell[1] === PIT[1]) return <div key={k} className="gw gw-pit">−1</div>;
    const val = snap.values[r][c];
    const strength = Math.min(1, Math.abs(val));
    const bg = val >= 0 ? `color-mix(in srgb, var(--up) ${Math.round(strength * 55)}%, transparent)` : `color-mix(in srgb, var(--down) ${Math.round(strength * 55)}%, transparent)`;
    const isStart = cell[0] === START[0] && cell[1] === START[1];
    const move = snap.moves[r][c];
    return (
      <div key={k} className="gw" style={{ background: bg }}>
        <span className="gw-tag">{isStart ? "start" : ""}</span>
        <span className="gw-arrow">{move ? ARROW[move] : ""}</span>
        <span className="gw-val">{val.toFixed(2)}</span>
      </div>
    );
  }

  return (
    <div className="demo" aria-label="Monte Carlo grid">
      <p className="demo-title">Learning from played episodes</p>
      <p className="small muted">
        This agent is not told what its moves do. It plays a whole episode from the start, then looks back at the return that followed each move it tried and nudges its estimate toward it. The arrows show its current best move in each cell, and the numbers show how good it thinks that move is.
      </p>

      <div className="gw-grid" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
        {Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => tile(r, c)))}
      </div>

      <div className="actions">
        <button type="button" className="btn" onClick={() => play(1)}>
          One episode
        </button>
        <button type="button" className="btn-secondary" onClick={() => play(10)}>
          Ten
        </button>
        <button type="button" className="btn-secondary" onClick={() => play(100)}>
          A hundred
        </button>
        <button type="button" className="link-button small" onClick={reset}>
          Start over
        </button>
      </div>

      <div className="actions">
        <label className="small">
          exploring ε = <strong>{epsilon.toFixed(2)}</strong>{" "}
          <input type="range" min={0} max={0.5} step={0.05} value={epsilon} onChange={(e) => setEpsilon(Number(e.target.value))} aria-label="Exploration rate epsilon" />
        </label>
        <label className="small">
          slip = <strong>{slip.toFixed(2)}</strong>{" "}
          <input type="range" min={0} max={0.4} step={0.05} value={slip} onChange={(e) => setSlip(Number(e.target.value))} aria-label="Chance of slipping sideways" />
        </label>
      </div>

      <p className="demo-status" aria-live="polite">
        Episodes played: <strong>{snap.episodes}</strong>
        {last ? (
          <>
            {" "}
            · last one took <strong>{last.steps}</strong> steps and scored <strong>{last.total.toFixed(2)}</strong>
          </>
        ) : null}
      </p>
    </div>
  );
}
