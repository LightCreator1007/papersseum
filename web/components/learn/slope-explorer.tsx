"use client";

import { useState } from "react";
import { FUNCTIONS, isFlat, sample, tangent, yRange } from "@/lib/learn/slope";

const W = 320;
const H = 190;
const PAD = 14;

// Chapter 1's demo: slide a point along a curve and watch the slope of the tangent line.
export function SlopeExplorer() {
  const [which, setWhich] = useState(0);
  const fn = FUNCTIONS[which];
  const [t, setT] = useState(0.8); // 0..1 along the curve
  const x = fn.min + (fn.max - fn.min) * t;
  const y = fn.f(x);
  const slope = fn.df(x);

  const { lo, hi } = yRange(fn);
  const sx = (v: number) => PAD + ((v - fn.min) / (fn.max - fn.min)) * (W - 2 * PAD);
  const sy = (v: number) => H - PAD - ((v - lo) / (hi - lo)) * (H - 2 * PAD);
  const curve = sample(fn).map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ");
  const tg = tangent(fn, x, (fn.max - fn.min) / 5);
  const flat = isFlat(slope);

  return (
    <div className="demo" aria-label="Slope explorer">
      <p className="demo-title">Slope explorer</p>
      <div className="actions">
        {FUNCTIONS.map((f, i) => (
          <button key={f.id} type="button" className={i === which ? "btn" : "btn-secondary"} onClick={() => setWhich(i)}>
            {f.id === "parabola" ? "Parabola" : f.id === "cubic" ? "Cubic" : "Sine"}
          </button>
        ))}
      </div>
      <p className="mono small">{fn.label}</p>

      <svg viewBox={`0 0 ${W} ${H}`} className="plot" role="img" aria-label="The curve with a tangent line at the chosen point">
        <polyline points={curve} className="spark-line" fill="none" />
        <line x1={sx(tg.x1)} y1={sy(tg.y1)} x2={sx(tg.x2)} y2={sy(tg.y2)} className={flat ? "tangent tangent-flat" : "tangent"} />
        <circle cx={sx(x)} cy={sy(y)} r="4.5" className="plot-dot" />
      </svg>

      <label className="small">
        Slide the point{" "}
        <input type="range" min={0} max={1} step={0.005} value={t} onChange={(e) => setT(Number(e.target.value))} aria-label="Position along the curve" />
      </label>

      <p className="demo-status" aria-live="polite">
        x = <strong>{x.toFixed(2)}</strong> · height = <strong>{y.toFixed(2)}</strong> · slope = <strong>{slope.toFixed(2)}</strong>
        {flat ? <span className="up"> · flat: a lowest or highest point is right here</span> : slope > 0 ? " · going up" : " · going down"}
      </p>
    </div>
  );
}
