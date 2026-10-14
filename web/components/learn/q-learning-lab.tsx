"use client";

import { useRef, useState } from "react";
import { ARROW, COLS, GOAL, ROWS, START, isCliff, makeLearner, runEpisode, snapshot, type Learner, type Method, type Snapshot } from "@/lib/learn/cliff";

const NAMES: Record<Method, string> = { qlearning: "Q-learning", sarsa: "SARSA" };

// Chapter 8's demo: the same cliff, two learners. Watch which route each one settles on, and how it scores while learning.
export function QLearningLab() {
  const [method, setMethod] = useState<Method>("qlearning");
  const [alpha, setAlpha] = useState(0.5);
  const [epsilon, setEpsilon] = useState(0.1);
  const learner = useRef<Learner>(makeLearner("qlearning", 3)); // mutable; only touched inside the handlers below
  const nextSeed = useRef(3); // each restart uses a fresh seed, so repeated runs differ but the page stays predictable
  const [snap, setSnap] = useState<Snapshot>(() => snapshot(makeLearner("qlearning", 3)));

  function restart(next: Method) {
    setMethod(next);
    nextSeed.current += 7919;
    learner.current = makeLearner(next, nextSeed.current);
    setSnap(snapshot(learner.current));
  }

  function play(count: number) {
    const l = learner.current;
    l.alpha = alpha;
    l.epsilon = epsilon;
    for (let i = 0; i < count; i++) runEpisode(l);
    setSnap(snapshot(l));
  }

  return (
    <div className="demo" aria-label="Q-learning lab">
      <p className="demo-title">The cliff</p>
      <p className="small muted">
        Reach the goal G. Every step costs 1, but stepping on the cliff costs 100 and sends you back to the start. The agent always tries a random move now and then, so walking beside the cliff is risky. Arrows show what it currently prefers, and the outlined cells are the route it would take if it stopped exploring.
      </p>

      <div className="actions">
        {(Object.keys(NAMES) as Method[]).map((m) => (
          <button key={m} type="button" className={m === method ? "btn" : "btn-secondary"} onClick={() => restart(m)} aria-pressed={m === method}>
            {NAMES[m]}
          </button>
        ))}
      </div>

      <div className="cliff-grid" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
        {Array.from({ length: ROWS }, (_, r) =>
          Array.from({ length: COLS }, (_, c) => {
            const cliff = isCliff([r, c]);
            const goal = r === GOAL[0] && c === GOAL[1];
            const start = r === START[0] && c === START[1];
            const move = snap.moves[r][c];
            return (
              <div key={`${r}${c}`} className={`cl${cliff ? " cl-cliff" : ""}${goal ? " cl-goal" : ""}${snap.onRoute[r][c] && !cliff ? " cl-route" : ""}`}>
                <span className="cl-tag">{cliff ? "cliff" : goal ? "G" : start ? "S" : ""}</span>
                <span className="cl-arrow">{move ? ARROW[move] : ""}</span>
              </div>
            );
          }),
        )}
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
        <button type="button" className="link-button small" onClick={() => restart(method)}>
          Start over
        </button>
      </div>

      <div className="actions">
        <label className="small">
          step size α = <strong>{alpha.toFixed(2)}</strong>{" "}
          <input type="range" min={0.05} max={1} step={0.05} value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} aria-label="Step size alpha" />
        </label>
        <label className="small">
          exploring ε = <strong>{epsilon.toFixed(2)}</strong>{" "}
          <input type="range" min={0} max={0.5} step={0.05} value={epsilon} onChange={(e) => setEpsilon(Number(e.target.value))} aria-label="Exploration rate epsilon" />
        </label>
      </div>

      <p className="demo-status" aria-live="polite">
        Episodes: <strong>{snap.episodes}</strong>
        {snap.routeLength !== null ? (
          <>
            {" "}
            · its best route takes <strong>{snap.routeLength}</strong> steps
          </>
        ) : null}
        {snap.recent !== null ? (
          <>
            {" "}
            · average score over the last 100 episodes: <strong>{snap.recent.toFixed(1)}</strong>
          </>
        ) : null}
      </p>
      <p className="small muted">A higher score is better; the shortest possible route scores −9. Try each learner for about 500 episodes.</p>
    </div>
  );
}
