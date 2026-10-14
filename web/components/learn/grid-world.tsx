"use client";

import { useState } from "react";
import { ARROW, COLS, GOAL, PIT, ROWS, START, greedyMove, isTerminal, isWall, sweep, zeros, type Cell, type Values } from "@/lib/learn/gridworld";

// Chapter 6's demo: watch value iteration spread value outward from the goal, one sweep at a time.
export function GridWorld() {
  const [gamma, setGamma] = useState(0.9);
  const [slip, setSlip] = useState(0);
  const [values, setValues] = useState<Values>(zeros());
  const [sweeps, setSweeps] = useState(0);
  const [change, setChange] = useState<number | null>(null);

  function reset(nextGamma = gamma, nextSlip = slip) {
    setGamma(nextGamma);
    setSlip(nextSlip);
    setValues(zeros());
    setSweeps(0);
    setChange(null);
  }

  function step(count: number) {
    let v = values;
    let last = change;
    for (let i = 0; i < count; i++) {
      const out = sweep(v, gamma, slip);
      v = out.values;
      last = out.change;
    }
    setValues(v);
    setSweeps((s) => s + count);
    setChange(last);
  }

  const settled = change !== null && change < 1e-9; // the same tolerance the lesson and the Python use

  function tile(r: number, c: number) {
    const cell: Cell = [r, c];
    if (isWall(cell)) return <div key={`${r}${c}`} className="gw gw-wall" aria-label="wall" />;
    if (cell[0] === GOAL[0] && cell[1] === GOAL[1]) return <div key={`${r}${c}`} className="gw gw-goal">+1</div>;
    if (cell[0] === PIT[0] && cell[1] === PIT[1]) return <div key={`${r}${c}`} className="gw gw-pit">−1</div>;
    const val = values[r][c];
    const strength = Math.min(1, Math.abs(val));
    const bg = val >= 0 ? `color-mix(in srgb, var(--up) ${Math.round(strength * 55)}%, transparent)` : `color-mix(in srgb, var(--down) ${Math.round(strength * 55)}%, transparent)`;
    const isStart = cell[0] === START[0] && cell[1] === START[1];
    return (
      <div key={`${r}${c}`} className="gw" style={{ background: bg }}>
        <span className="gw-tag">{isStart ? "start" : ""}</span>
        <span className="gw-arrow">{sweeps > 0 && !isTerminal(cell) ? ARROW[greedyMove(values, cell, gamma, slip)] : ""}</span>
        <span className="gw-val">{val.toFixed(2)}</span>
      </div>
    );
  }

  return (
    <div className="demo" aria-label="Grid world">
      <p className="demo-title">Grid world</p>
      <p className="small muted">
        Reach the +1 and avoid the −1. Every step costs a little. Press <em>Sweep</em> to apply the Bellman optimality update once to every cell and watch the value spread out from the goal. The arrows show the best move according to the values so far.
      </p>

      <div className="gw-grid" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
        {Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => tile(r, c)))}
      </div>

      <div className="actions">
        <button type="button" className="btn" onClick={() => step(1)} disabled={settled}>
          Sweep once
        </button>
        <button type="button" className="btn-secondary" onClick={() => step(20)} disabled={settled}>
          Sweep 20 times
        </button>
        <button type="button" className="link-button small" onClick={() => reset()}>
          Reset
        </button>
      </div>

      <div className="actions">
        <label className="small">
          γ = <strong>{gamma.toFixed(2)}</strong>{" "}
          <input type="range" min={0} max={0.99} step={0.01} value={gamma} onChange={(e) => reset(Number(e.target.value), slip)} aria-label="Discount factor gamma" />
        </label>
        <label className="small">
          slip = <strong>{slip.toFixed(2)}</strong>{" "}
          <input type="range" min={0} max={0.4} step={0.05} value={slip} onChange={(e) => reset(gamma, Number(e.target.value))} aria-label="Chance of slipping sideways" />
        </label>
      </div>

      <p className="demo-status" aria-live="polite">
        Sweeps so far: <strong>{sweeps}</strong>
        {change !== null ? (settled ? <span className="up"> · the values have settled</span> : <> · biggest change last sweep: <strong>{change < 0.001 ? change.toExponential(1) : change.toFixed(4)}</strong></>) : null}
      </p>
      <p className="small muted">Moving the sliders starts over. Slip is the chance of moving sideways instead of where you meant to.</p>
    </div>
  );
}
