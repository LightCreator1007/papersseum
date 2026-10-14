"use client";

import { useState } from "react";
import { STREAMS, breakEvenGamma, discounted, totalReturn } from "@/lib/learn/discount";

// Chapter 4's demo: slide gamma and watch which stream of rewards is worth more.
export function DiscountPlayground() {
  const [gamma, setGamma] = useState(0.8);
  const [a, b] = STREAMS;
  const even = breakEvenGamma(a.rewards, b.rewards);
  const peak = Math.max(...STREAMS.flatMap((s) => s.rewards));
  const totals = STREAMS.map((s) => totalReturn(s.rewards, gamma));
  const winner = totals[0] === totals[1] ? -1 : totals[0] > totals[1] ? 0 : 1;

  return (
    <div className="demo" aria-label="Discount playground">
      <p className="demo-title">Discount playground</p>
      <p className="small muted">
        Two ways to collect rewards over ten steps. Each reward is multiplied by γ for every step it is away from now. Slide γ and see which one is worth more.
      </p>

      <label className="small">
        γ = <strong>{gamma.toFixed(2)}</strong>{" "}
        <input type="range" min={0} max={0.99} step={0.01} value={gamma} onChange={(e) => setGamma(Number(e.target.value))} aria-label="Discount factor gamma" />
      </label>

      {STREAMS.map((s, idx) => {
        const d = discounted(s.rewards, gamma);
        return (
          <div key={s.id} className={`stream${winner === idx ? " stream-win" : ""}`}>
            <p className="small">
              <strong>{s.label}</strong> · worth <strong>{totals[idx].toFixed(2)}</strong>
            </p>
            <div className="bars" role="img" aria-label={`Rewards after discounting for: ${s.label}`}>
              {s.rewards.map((r, k) => (
                <div key={k} className="bar-col">
                  <div className="bar-ghost" style={{ height: `${(r / peak) * 100}%` }} title={`reward ${r}`} />
                  <div className="bar" style={{ height: `${(d[k] / peak) * 100}%` }} title={`worth ${d[k].toFixed(2)} now`} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <p className="small muted">The faint bar is the reward as paid. The solid bar is what it is worth today.</p>
      {even !== null ? (
        <p className="small" aria-live="polite">
          The two are worth the same at γ ≈ <strong>{even.toFixed(2)}</strong>. Below that the steady trickle wins; above it, the prize does.
        </p>
      ) : null}
    </div>
  );
}
