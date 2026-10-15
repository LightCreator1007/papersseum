"use client";

import { useState } from "react";
import { ACTION_NAMES, FRESH, STATE_NAMES, TIRED, improvements, qValues, values, type Policy } from "@/features/learn/student";

// Chapter 5's demo: choose what the student does in each condition and see the exact value of every state.
export function ValueExplorer() {
  const [policy, setPolicy] = useState<Policy>([0, 0]);
  const [gamma, setGamma] = useState(0.9);
  const v = values(policy, gamma);
  const q = qValues(v, gamma);
  const better = improvements(policy, q);

  function choose(state: number, action: number) {
    setPolicy((p) => (state === FRESH ? [action, p[1]] : [p[0], action]));
  }

  return (
    <div className="demo" aria-label="Value explorer">
      <p className="demo-title">Value explorer</p>
      <p className="small muted">
        Choose what the student does in each condition. The numbers show how much each situation is worth under that plan, found by solving the Bellman equations exactly.
      </p>

      {[FRESH, TIRED].map((s) => (
        <div key={s} className="actions">
          <span className="small" style={{ minWidth: 88 }}>
            When {STATE_NAMES[s].toLowerCase()}:
          </span>
          {ACTION_NAMES.map((name, a) => (
            <button key={name} type="button" className={policy[s] === a ? "btn" : "btn-secondary"} onClick={() => choose(s, a)} aria-pressed={policy[s] === a}>
              {name}
            </button>
          ))}
        </div>
      ))}

      <label className="small">
        γ = <strong>{gamma.toFixed(2)}</strong>{" "}
        <input type="range" min={0} max={0.99} step={0.01} value={gamma} onChange={(e) => setGamma(Number(e.target.value))} aria-label="Discount factor gamma" />
      </label>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Condition</th>
              <th className="num">Value under this plan</th>
              <th className="num">Q if you study</th>
              <th className="num">Q if you rest</th>
            </tr>
          </thead>
          <tbody>
            {[FRESH, TIRED].map((s) => (
              <tr key={s}>
                <td>{STATE_NAMES[s]}</td>
                <td className="num">
                  <strong>{v[s].toFixed(2)}</strong>
                </td>
                {[0, 1].map((a) => (
                  <td key={a} className={`num${policy[s] === a ? "" : " muted"}`}>
                    {q[s][a].toFixed(2)}
                    {policy[s] === a ? " (plan)" : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="small" aria-live="polite">
        {better.length === 0 ? (
          <span className="up">No action beats the plan in either condition, so this is the best plan.</span>
        ) : (
          <>
            This plan can be improved: when {better.map((b) => `${STATE_NAMES[b.state].toLowerCase()} the student should ${ACTION_NAMES[b.better].toLowerCase()}`).join(", and when ")} instead.
          </>
        )}
      </p>
    </div>
  );
}
