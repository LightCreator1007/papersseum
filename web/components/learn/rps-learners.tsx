"use client";

import { useRef, useState } from "react";
import { MOVES, averageStrategy, makeGame, play, probsA, probsB, type Game, type Mode } from "@/lib/learn/rps";
import { Spark } from "./spark";

type Snap = { a: number[]; b: number[]; avgA: number[]; rounds: number; histA: number[]; histB: number[] };

function snap(g: Game): Snap {
  return { a: probsA(g), b: probsB(g), avgA: averageStrategy(g.sumA, g.rounds), rounds: g.rounds, histA: g.history.map((h) => h.a), histB: g.history.map((h) => h.b) };
}

function Bars({ probs, name }: { probs: number[]; name: string }) {
  return (
    <div className="pn-bars" role="img" aria-label={`${name}: chance of each move`}>
      {probs.map((p, k) => (
        <div key={k} className="pn-row">
          <span className="small">{MOVES[k]}</span>
          <div className="pn-track">
            <div className="pn-fill" style={{ width: `${Math.round(p * 100)}%` }} />
          </div>
          <span className="small pn-num">{Math.round(p * 100)}%</span>
          <span />
        </div>
      ))}
    </div>
  );
}

// Chapter 13's demo: a learner against a predictable bot, or two learners against each other.
export function RpsLearners() {
  const [mode, setMode] = useState<Mode>("biased");
  const seed = useRef(1);
  const game = useRef<Game>(makeGame("biased", 1, 0.05));
  const [s, setS] = useState<Snap>(() => snap(makeGame("biased", 1, 0.05)));

  function restart(next: Mode) {
    seed.current += 1;
    setMode(next);
    game.current = makeGame(next, seed.current, next === "biased" ? 0.05 : 0.02);
    setS(snap(game.current));
  }

  function run(rounds: number) {
    play(game.current, rounds);
    setS(snap(game.current));
  }

  return (
    <div className="demo" aria-label="Rock-paper-scissors learners">
      <p className="demo-title">Rock-paper-scissors learners</p>
      <p className="small muted">
        Each learner keeps a score for each move and turns the scores into chances. After every round it nudges those chances toward whatever just worked. Pick who it plays against, then press play.
      </p>

      <div className="actions">
        <label className="small">
          <input type="radio" name="rps-mode" checked={mode === "biased"} onChange={() => restart("biased")} /> against a bot that plays rock half the time
        </label>
        <label className="small">
          <input type="radio" name="rps-mode" checked={mode === "both"} onChange={() => restart("both")} /> two learners against each other
        </label>
      </div>

      <p className="small">
        <strong>Learner A</strong>
      </p>
      <Bars probs={s.a} name="Learner A" />
      <Spark values={s.histA.length ? s.histA : [1 / 3]} reference={1 / 3} label="Learner A's chance of playing rock over time" />
      <p className="small muted">Chance of rock over time (dashed line: one third).</p>

      <p className="small">
        <strong>{mode === "both" ? "Learner B" : "The bot (never changes)"}</strong>
      </p>
      <Bars probs={s.b} name="Opponent" />
      {mode === "both" ? (
        <>
          <Spark values={s.histB.length ? s.histB : [1 / 3]} reference={1 / 3} label="Learner B's chance of playing rock over time" />
          <p className="small muted">
            A&apos;s average over the whole run: rock {Math.round(s.avgA[0] * 100)}%, paper {Math.round(s.avgA[1] * 100)}%, scissors {Math.round(s.avgA[2] * 100)}%.
          </p>
        </>
      ) : null}

      <div className="actions">
        <button type="button" className="btn" onClick={() => run(100)}>
          100 rounds
        </button>
        <button type="button" className="btn-secondary" onClick={() => run(1000)}>
          1,000
        </button>
        <button type="button" className="btn-secondary" onClick={() => run(5000)}>
          5,000
        </button>
        <button type="button" className="link-button small" onClick={() => restart(mode)}>
          Start over
        </button>
      </div>
      <p className="demo-status" aria-live="polite">
        Rounds played: <strong>{s.rounds.toLocaleString("en-US")}</strong>
      </p>
    </div>
  );
}
