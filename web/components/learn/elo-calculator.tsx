"use client";

import { useState } from "react";
import { expectedScore, update } from "@/lib/learn/elo";

// Chapter 13's demo: set two ratings, see the predicted score, then record a result and watch the points move.
export function EloCalculator() {
  const [a, setA] = useState(1000);
  const [b, setB] = useState(1200);
  const [k, setK] = useState(32);
  const e = expectedScore(a, b);

  function record(score: number) {
    const [na, nb] = update(a, b, score, k);
    setA(na);
    setB(nb);
  }

  return (
    <div className="demo" aria-label="Elo calculator">
      <p className="demo-title">Elo calculator</p>
      <div className="actions">
        <label className="small">
          Player A: <strong>{a.toFixed(1)}</strong>{" "}
          <input type="range" min={600} max={1800} step={10} value={Math.round(a)} onChange={(ev) => setA(Number(ev.target.value))} aria-label="Rating of player A" />
        </label>
        <label className="small">
          Player B: <strong>{b.toFixed(1)}</strong>{" "}
          <input type="range" min={600} max={1800} step={10} value={Math.round(b)} onChange={(ev) => setB(Number(ev.target.value))} aria-label="Rating of player B" />
        </label>
        <label className="small">
          K = <strong>{k}</strong>{" "}
          <input type="range" min={4} max={64} step={4} value={k} onChange={(ev) => setK(Number(ev.target.value))} aria-label="K factor" />
        </label>
      </div>

      <div className="pn-track" role="img" aria-label={`Expected score for A: ${e.toFixed(3)}`}>
        <div className="pn-fill" style={{ width: `${e * 100}%` }} />
      </div>
      <p className="small">
        Expected score for A: <strong>{e.toFixed(4)}</strong> · for B: <strong>{(1 - e).toFixed(4)}</strong>
      </p>

      <div className="actions">
        <button type="button" className="btn" onClick={() => record(1)}>
          A wins
        </button>
        <button type="button" className="btn-secondary" onClick={() => record(0.5)}>
          Draw
        </button>
        <button type="button" className="btn-secondary" onClick={() => record(0)}>
          B wins
        </button>
        <button
          type="button"
          className="link-button small"
          onClick={() => {
            setA(1000);
            setB(1200);
            setK(32);
          }}
        >
          Reset
        </button>
      </div>
      <p className="small muted">Whatever A gains, B loses. An upset (the lower rating winning) moves far more points than an expected result.</p>
    </div>
  );
}
