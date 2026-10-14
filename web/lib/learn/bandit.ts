// The logic behind the Bandit Casino demo (chapter 3). Plain functions with a seeded
// random generator, so the same seed always gives the same casino, and it is testable.

export type Rng = () => number;

// mulberry32: a tiny seeded generator returning numbers in [0, 1).
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ARM_NAMES = ["A", "B", "C", "D", "E", "F", "G", "H"];

// Win probabilities for each machine: spread between 0.15 and 0.85, with the best
// machine at least 0.08 ahead of the second best so there is something to find.
export function makeProbabilities(seed: number, arms = 5): number[] {
  const rng = mulberry32(seed);
  for (let attempt = 0; attempt < 100; attempt++) {
    const p = Array.from({ length: arms }, () => Math.round((0.15 + 0.7 * rng()) * 100) / 100);
    const sorted = [...p].sort((x, y) => y - x);
    if (sorted[0] - sorted[1] >= 0.08) return p;
  }
  const p = Array.from({ length: arms }, (_, i) => 0.3 + 0.1 * (i % 3));
  p[0] = 0.8;
  return p;
}

export function bestArm(probs: number[]): number {
  return probs.indexOf(Math.max(...probs));
}

// Pull a machine: 1 if it pays out, otherwise 0.
export function pull(probs: number[], arm: number, rng: Rng): 0 | 1 {
  return rng() < probs[arm] ? 1 : 0;
}

// The learner from the chapter: keeps a running average of what each machine has paid.
export class EpsilonGreedy {
  q: number[];
  n: number[];
  constructor(
    arms: number,
    public epsilon: number,
    private rng: Rng,
  ) {
    this.q = Array(arms).fill(0);
    this.n = Array(arms).fill(0);
  }

  // With probability epsilon explore a random machine; otherwise exploit the best
  // average so far (ties broken at random, so it does not always favour machine A).
  choose(): number {
    if (this.rng() < this.epsilon) return Math.floor(this.rng() * this.q.length);
    const best = Math.max(...this.q);
    const tied = this.q.flatMap((v, i) => (v === best ? [i] : []));
    return tied[Math.floor(this.rng() * tied.length)];
  }

  // The incremental average:  Q <- Q + (1/N) * (reward - Q)
  update(arm: number, reward: number): void {
    this.n[arm] += 1;
    this.q[arm] += (reward - this.q[arm]) / this.n[arm];
  }
}

export type Run = { arms: number[]; rewards: number[]; counts: number[]; q: number[]; total: number };

// Let the agent play `steps` pulls on a casino and report what happened.
export function runAgent(probs: number[], epsilon: number, steps: number, seed: number): Run {
  const rng = mulberry32(seed);
  const agent = new EpsilonGreedy(probs.length, epsilon, rng);
  const arms: number[] = [];
  const rewards: number[] = [];
  for (let t = 0; t < steps; t++) {
    const arm = agent.choose();
    const r = pull(probs, arm, rng);
    agent.update(arm, r);
    arms.push(arm);
    rewards.push(r);
  }
  return { arms, rewards, counts: [...agent.n], q: [...agent.q], total: rewards.reduce((a, b) => a + b, 0) };
}

// Running average of the rewards, for plotting how the agent improves.
export function runningMean(xs: number[]): number[] {
  let sum = 0;
  return xs.map((x, i) => (sum += x) / (i + 1));
}
