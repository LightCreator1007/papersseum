"use client";

import { useMemo, useRef, useState } from "react";
import { ARM_NAMES, bestArm, makeProbabilities, mulberry32, pull, runAgent, runningMean, type Rng } from "@/lib/learn/bandit";

const BUDGET = 100;

type Tally = { pulls: number; wins: number };

function Spark({ values, reference }: { values: number[]; reference?: number }) {
  const w = 300;
  const h = 70;
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - v * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="spark" role="img" aria-label="Average reward so far, over the pulls">
      {reference !== undefined ? <line x1="0" x2={w} y1={h - reference * h} y2={h - reference * h} className="spark-ref" /> : null}
      <polyline points={pts} className="spark-line" fill="none" />
    </svg>
  );
}

// Chapter 3's demo: play five slot machines yourself, then watch the learner play the same ones.
export function BanditCasino() {
  const [seed, setSeed] = useState(7);
  const probs = useMemo(() => makeProbabilities(seed), [seed]);
  const best = bestArm(probs);
  const rng = useRef<Rng>(mulberry32(seed * 31 + 1));

  const [tally, setTally] = useState<Tally[]>(() => probs.map(() => ({ pulls: 0, wins: 0 })));
  const [revealed, setRevealed] = useState(false);
  const [epsilon, setEpsilon] = useState(0.1);
  const [runs, setRuns] = useState(0);
  const [agent, setAgent] = useState<ReturnType<typeof runAgent> | null>(null);

  const used = tally.reduce((a, t) => a + t.pulls, 0);
  const score = tally.reduce((a, t) => a + t.wins, 0);
  const done = used >= BUDGET;
  const showTruth = revealed || done;

  function newCasino() {
    const next = Math.floor(Math.random() * 1_000_000) + 1;
    setSeed(next);
    rng.current = mulberry32(next * 31 + 1);
    setTally(makeProbabilities(next).map(() => ({ pulls: 0, wins: 0 })));
    setRevealed(false);
    setAgent(null);
    setRuns(0);
  }

  function play(arm: number) {
    if (done) return;
    const won = pull(probs, arm, rng.current);
    setTally((t) => t.map((x, i) => (i === arm ? { pulls: x.pulls + 1, wins: x.wins + won } : x)));
  }

  function runLearner() {
    setAgent(runAgent(probs, epsilon, BUDGET, seed * 7 + runs + 1));
    setRuns((r) => r + 1);
  }

  return (
    <div className="demo" aria-label="Bandit casino">
      <p className="demo-title">The casino</p>
      <p className="small muted">
        {BUDGET} pulls. Every win is one point. Each machine has its own hidden chance of paying out. Find the best one before you run out.
      </p>

      <div className="arms">
        {probs.map((p, i) => {
          const t = tally[i];
          return (
            <div key={i} className={`arm${showTruth && i === best ? " arm-best" : ""}`}>
              <button type="button" className="btn-secondary" onClick={() => play(i)} disabled={done} aria-label={`Pull machine ${ARM_NAMES[i]}`}>
                Machine {ARM_NAMES[i]}
              </button>
              <p className="small">
                {t.wins} won of {t.pulls}
                {t.pulls > 0 ? <span className="muted"> ({Math.round((t.wins / t.pulls) * 100)}%)</span> : null}
              </p>
              {showTruth ? <p className="small muted">true chance {Math.round(p * 100)}%</p> : null}
            </div>
          );
        })}
      </div>

      <p className="demo-status" aria-live="polite">
        Pulls left: <strong>{BUDGET - used}</strong> · Score: <strong>{score}</strong>
        {done ? (
          <>
            {" "}
            · Best possible on average: <strong>{Math.round(BUDGET * probs[best])}</strong>
          </>
        ) : null}
      </p>
      <div className="actions">
        {!showTruth ? (
          <button type="button" className="link-button small" onClick={() => setRevealed(true)}>
            Reveal the true chances
          </button>
        ) : null}
        <button type="button" className="link-button small" onClick={newCasino}>
          New casino
        </button>
      </div>

      <p className="demo-title">Now watch a learner play the same machines</p>
      <p className="small muted">
        It starts knowing nothing and keeps a running average for each machine. The slider is its <em>ε</em>: how often it tries a random machine instead of its current favourite.
      </p>
      <div className="actions">
        <label className="small">
          ε = <strong>{epsilon.toFixed(2)}</strong>{" "}
          <input type="range" min={0} max={1} step={0.05} value={epsilon} onChange={(e) => setEpsilon(Number(e.target.value))} aria-label="Exploration rate epsilon" />
        </label>
        <button type="button" className="btn" onClick={runLearner}>
          Run the learner ({BUDGET} pulls)
        </button>
      </div>

      {agent ? (
        <div className="agent-result" aria-live="polite">
          <p className="small">
            Learner score: <strong>{agent.total}</strong> of {BUDGET}. Pulls per machine:{" "}
            {agent.counts.map((c, i) => (
              <span key={i} className="seat">
                {ARM_NAMES[i]} {c}
              </span>
            ))}
          </p>
          <Spark values={runningMean(agent.rewards)} reference={showTruth ? probs[best] : undefined} />
          <p className="small muted">Its average reward so far, pull by pull{showTruth ? ". The dashed line is the best machine's true chance." : ". Reveal the true chances to see the target."}</p>
        </div>
      ) : null}
    </div>
  );
}
