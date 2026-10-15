"use client";

import { useState } from "react";
import { BOTTOM, DESCRIPTIONS, behaviour, f, path } from "@/lib/learn/descent";

const W = 340;
const H = 190;
const PAD = 14;
const X0 = -3;
const X1 = 9;
const Y1 = 40; // anything above this is off the chart

// Chapter 9's demo: pick a starting point and a step size, and watch the dots roll down the bowl (or fail to).
export function GradientDescent() {
  const [alpha, setAlpha] = useState(0.1);
  const [start, setStart] = useState(0);
  const [steps, setSteps] = useState(0);

  const pts = path(start, alpha, steps);
  const sx = (v: number) => PAD + ((v - X0) / (X1 - X0)) * (W - 2 * PAD);
  const sy = (v: number) => H - PAD - (Math.min(v, Y1) / Y1) * (H - 2 * PAD);
  const bowl = Array.from({ length: 121 }, (_, i) => {
    const w = X0 + ((X1 - X0) * i) / 120;
    return `${sx(w)},${sy(f(w))}`;
  }).join(" ");
  const last = pts[pts.length - 1];
  const offChart = last < X0 || last > X1;

  return (
    <div className="demo" aria-label="Gradient descent">
      <p className="demo-title">Gradient descent</p>
      <p className="small muted">
        The bowl is f(w) = (w − 3)². Its lowest point is at w = 3. Each step moves w against the slope: <em>w ← w − α × slope</em>. Pick a step size α and press Step.
      </p>

      <svg viewBox={`0 0 ${W} ${H}`} className="plot" role="img" aria-label="A bowl-shaped curve with the points visited by gradient descent">
        <polyline points={bowl} className="spark-line" fill="none" />
        <line x1={sx(BOTTOM)} x2={sx(BOTTOM)} y1={sy(0)} y2={sy(Y1)} className="spark-ref" />
        {pts.map((w, i) => (w >= X0 && w <= X1 ? <circle key={i} cx={sx(w)} cy={sy(f(w))} r={i === pts.length - 1 ? 5 : 3} className={i === pts.length - 1 ? "plot-dot" : "plot-dot-faint"} /> : null))}
      </svg>

      <div className="actions">
        <button type="button" className="btn" onClick={() => setSteps((s) => s + 1)}>
          Step
        </button>
        <button type="button" className="btn-secondary" onClick={() => setSteps((s) => s + 10)}>
          Ten steps
        </button>
        <button type="button" className="link-button small" onClick={() => setSteps(0)}>
          Back to the start
        </button>
      </div>

      <div className="actions">
        <label className="small">
          step size α = <strong>{alpha.toFixed(2)}</strong>{" "}
          <input
            type="range"
            min={0.02}
            max={1.3}
            step={0.02}
            value={alpha}
            onChange={(e) => {
              setAlpha(Number(e.target.value));
              setSteps(0);
            }}
            aria-label="Step size alpha"
          />
        </label>
        <label className="small">
          start at w = <strong>{start.toFixed(1)}</strong>{" "}
          <input
            type="range"
            min={-2}
            max={8}
            step={0.5}
            value={start}
            onChange={(e) => {
              setStart(Number(e.target.value));
              setSteps(0);
            }}
            aria-label="Starting value of w"
          />
        </label>
      </div>

      <p className="demo-status" aria-live="polite">
        After <strong>{steps}</strong> steps: w = <strong>{Math.abs(last) > 1e6 ? last.toExponential(1) : last.toFixed(3)}</strong>
        {offChart ? <span className="down"> (off the chart)</span> : null}
      </p>
      <p className="small">{DESCRIPTIONS[behaviour(alpha)]}</p>
    </div>
  );
}
