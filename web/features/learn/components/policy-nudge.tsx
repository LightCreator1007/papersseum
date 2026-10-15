"use client";

import { useRef, useState } from "react";
import { CHANCES, makeLearner, probabilities, pullOnce, type Learner } from "@/features/learn/policybandit";

type View = { probs: number[]; pulls: number; last: { action: number; reward: number } | null };
const NAMES = ["A", "B", "C"];

function view(l: Learner, last: View["last"]): View {
  return { probs: probabilities(l), pulls: l.pulls, last };
}

// Chapter 12's demo: a policy over three slot machines, nudged by what it earns. Try a big bonus with and without the baseline.
export function PolicyNudge() {
  const [baseline, setBaseline] = useState(true);
  const [shift, setShift] = useState(0);
  const seed = useRef(1);
  const learner = useRef<Learner>(makeLearner(1));
  const [v, setV] = useState<View>(() => view(makeLearner(1), null));

  function restart(nextBaseline: boolean, nextShift: number) {
    seed.current += 1;
    setBaseline(nextBaseline);
    setShift(nextShift);
    learner.current = makeLearner(seed.current, { useBaseline: nextBaseline, shift: nextShift });
    setV(view(learner.current, null));
  }

  function pull(count: number) {
    const l = learner.current;
    let last = null;
    for (let i = 0; i < count; i++) last = pullOnce(l);
    setV(view(l, last));
  }

  return (
    <div className="demo" aria-label="Policy nudge">
      <p className="demo-title">Policy nudge</p>
      <p className="small muted">
        The learner has no estimates of value at all. It just has a probability for each machine, and after every pull it nudges those probabilities toward machines that paid well. The machines pay 1 coin with chances of 20%, 50% and 80%, plus the bonus you choose below.
      </p>

      <div className="pn-bars" role="img" aria-label="The probability the learner picks each machine">
        {v.probs.map((p, k) => (
          <div key={k} className="pn-row">
            <span className="small">Machine {NAMES[k]}</span>
            <div className="pn-track">
              <div className="pn-fill" style={{ width: `${Math.round(p * 100)}%` }} />
            </div>
            <span className="small pn-num">{Math.round(p * 100)}%</span>
            <span className="small muted">pays {Math.round(CHANCES[k] * 100)}%</span>
          </div>
        ))}
      </div>

      <div className="actions">
        <button type="button" className="btn" onClick={() => pull(1)}>
          One pull
        </button>
        <button type="button" className="btn-secondary" onClick={() => pull(10)}>
          Ten
        </button>
        <button type="button" className="btn-secondary" onClick={() => pull(100)}>
          A hundred
        </button>
        <button type="button" className="link-button small" onClick={() => restart(baseline, shift)}>
          Start over
        </button>
      </div>

      <div className="actions">
        <label className="small">
          <input type="checkbox" checked={baseline} onChange={(e) => restart(e.target.checked, shift)} /> subtract a baseline
        </label>
        <label className="small">
          bonus on every reward = <strong>{shift}</strong>{" "}
          <input type="range" min={0} max={10} step={1} value={shift} onChange={(e) => restart(baseline, Number(e.target.value))} aria-label="Bonus added to every reward" />
        </label>
      </div>

      <p className="demo-status" aria-live="polite">
        Pulls so far: <strong>{v.pulls}</strong>
        {v.last ? (
          <>
            {" "}
            · last: machine <strong>{NAMES[v.last.action]}</strong> paid <strong>{v.last.reward}</strong>
          </>
        ) : null}
      </p>
      <p className="small muted">Try it with a bonus of 10 and the baseline switched off, a few times. Then switch the baseline back on.</p>
    </div>
  );
}
