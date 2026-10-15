// Chapter 13's "Rock-paper-scissors learners". Mirrors resources/chapters/13-multi-agent/code/rps_selfplay.py
// (the random streams differ, the algorithm does not).

import { mulberry32, type Rng } from "./bandit";
import { gradLogProb, softmax } from "./policybandit";

export const MOVES = ["rock", "paper", "scissors"] as const;
// PAYOFF[a][b]: what the row player gets for playing a against b
export const PAYOFF = [
  [0, -1, 1],
  [1, 0, -1],
  [-1, 1, 0],
];
export const BIASED = [0.5, 0.25, 0.25]; // a bot that plays rock half the time

export type Mode = "biased" | "both";

export type Game = {
  mode: Mode;
  alpha: number;
  rng: Rng;
  scoresA: number[];
  scoresB: number[];
  baseA: number;
  baseB: number;
  rounds: number;
  sumA: number[]; // for the average strategy over the whole run
  sumB: number[];
  history: { a: number; b: number }[]; // P(rock) for each player, recorded every 20 rounds
};

export function makeGame(mode: Mode, seed = 1, alpha = 0.02): Game {
  return { mode, alpha, rng: mulberry32(seed), scoresA: [0, 0, 0], scoresB: [0, 0, 0], baseA: 0, baseB: 0, rounds: 0, sumA: [0, 0, 0], sumB: [0, 0, 0], history: [] };
}

function draw(probs: number[], rng: Rng): number {
  const u = rng();
  let cum = 0;
  for (let i = 0; i < probs.length - 1; i++) {
    cum += probs[i];
    if (u < cum) return i;
  }
  return probs.length - 1;
}

export function probsA(g: Game): number[] {
  return softmax(g.scoresA);
}
export function probsB(g: Game): number[] {
  return g.mode === "both" ? softmax(g.scoresB) : BIASED;
}

export function playRound(g: Game): void {
  const pa = probsA(g);
  const pb = probsB(g);
  const a = draw(pa, g.rng);
  const b = draw(pb, g.rng);
  const ra = PAYOFF[a][b];
  g.rounds += 1;
  const ga = gradLogProb(g.scoresA, a);
  g.scoresA = g.scoresA.map((s, k) => s + g.alpha * (ra - g.baseA) * ga[k]);
  if (g.mode === "both") {
    const gb = gradLogProb(g.scoresB, b);
    g.scoresB = g.scoresB.map((s, k) => s + g.alpha * (-ra - g.baseB) * gb[k]);
  }
  g.baseA += (ra - g.baseA) / g.rounds;
  g.baseB += (-ra - g.baseB) / g.rounds;
  pa.forEach((p, k) => (g.sumA[k] += p));
  pb.forEach((p, k) => (g.sumB[k] += p));
  if (g.rounds % 20 === 0) g.history.push({ a: pa[0], b: pb[0] });
}

export function play(g: Game, rounds: number): void {
  for (let i = 0; i < rounds; i++) playRound(g);
}

export function averageStrategy(sum: number[], rounds: number): number[] {
  return sum.map((s) => (rounds ? s / rounds : 1 / 3));
}
