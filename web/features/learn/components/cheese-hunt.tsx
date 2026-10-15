"use client";

import { useRef, useState } from "react";
import { Spark } from "@/features/learn/components/spark";
import { makeLearner, preferences, runEpisode, type Learner } from "@/features/learn/corridor";

const CELLS = 8;

// Chapter 0's demo: a learner finds the cheese at the end of a corridor, getting faster as it goes.
export function CheeseHunt() {
  const learner = useRef<Learner>(makeLearner(CELLS, 11));
  const [steps, setSteps] = useState<number[]>([]);
  const [prefs, setPrefs] = useState<string[]>(() => Array(CELLS - 1).fill("·")); // no preference yet

  function run(episodes: number) {
    const out: number[] = [];
    for (let i = 0; i < episodes; i++) out.push(runEpisode(learner.current).steps);
    setSteps((s) => [...s, ...out]);
    setPrefs(preferences(learner.current));
  }

  function reset() {
    learner.current = makeLearner(CELLS, Math.floor(Math.random() * 1_000_000) + 1);
    setSteps([]);
    setPrefs(preferences(learner.current));
  }

  const last = steps.length ? steps[steps.length - 1] : null;
  const shown = steps.slice(-100);

  return (
    <div className="demo" aria-label="Cheese hunt">
      <p className="demo-title">Cheese hunt</p>
      <p className="small muted">
        A learner starts at the left end of a corridor and wants the cheese at the right end. It does not know where the cheese is, and it is not told what to do. It only finds out how each attempt went.
      </p>

      <div className="corridor" role="img" aria-label="A corridor of eight cells with the cheese in the last one">
        {Array.from({ length: CELLS }, (_, i) => (
          <div key={i} className={`cell${i === CELLS - 1 ? " cell-goal" : ""}`}>
            {i === CELLS - 1 ? "cheese" : i === 0 ? "start" : ""}
            <span className="cell-arrow">{i === CELLS - 1 ? "" : prefs[i]}</span>
          </div>
        ))}
      </div>
      <p className="small muted">The arrows show which way it currently prefers to go from each cell. A dot means it has no idea yet.</p>

      <div className="actions">
        <button type="button" className="btn" onClick={() => run(1)}>
          One attempt
        </button>
        <button type="button" className="btn-secondary" onClick={() => run(10)}>
          Ten attempts
        </button>
        <button type="button" className="link-button small" onClick={reset}>
          Start over
        </button>
      </div>

      <p className="demo-status" aria-live="polite">
        Attempts so far: <strong>{steps.length}</strong>
        {last !== null ? (
          <>
            {" "}
            · Last attempt took <strong>{last}</strong> steps (the shortest possible is {CELLS - 1})
          </>
        ) : null}
      </p>
      {shown.length > 1 ? (
        <>
          <Spark values={shown} max={Math.max(20, ...shown)} reference={CELLS - 1} label="Steps taken in each attempt" />
          <p className="small muted">Steps per attempt (the last 100). The dashed line is the shortest possible trip.</p>
        </>
      ) : null}
    </div>
  );
}
