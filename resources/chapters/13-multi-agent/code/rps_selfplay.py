"""Chapter 13: rock-paper-scissors between learners.

Two players each hold three scores (rock, paper, scissors), turn them into probabilities with a softmax, and learn
with the policy-gradient nudge from chapter 12:   score_k <- score_k + alpha * (reward - baseline) * ([k was played] - probability of k)
A win pays +1, a loss -1, a draw 0.

Two situations:
  * the learner plays a FIXED opponent that favours rock: there is a best reply (paper), and the learner finds it
  * BOTH players learn: each is the other's changing environment, and there is no fixed best reply

Run it:
    python rps_selfplay.py            # both situations, over several seeds
    python rps_selfplay.py --fast     # a quick, self-checking version (for tests)

Needs only numpy.
"""

import sys

import numpy as np

# PAYOFF[a][b] = what the row player gets for playing a against b (0 rock, 1 paper, 2 scissors)
PAYOFF = np.array([[0, -1, 1], [1, 0, -1], [-1, 1, 0]], dtype=float)
BIASED_OPPONENT = np.array([0.5, 0.25, 0.25])  # plays rock half the time


def softmax(scores):
    e = np.exp(scores - scores.max())
    return e / e.sum()


def grad_log_prob(scores, action):
    g = -softmax(scores)
    g[action] += 1.0
    return g


def play(steps, alpha, seed, both_learn):
    """Returns (A's probabilities at every step, B's probabilities at every step)."""
    rng = np.random.default_rng(seed)
    sa, sb = np.zeros(3), np.zeros(3)
    base_a = base_b = 0.0
    pa, pb = np.zeros((steps, 3)), np.zeros((steps, 3))
    for t in range(1, steps + 1):
        probs_a = softmax(sa)
        probs_b = softmax(sb) if both_learn else BIASED_OPPONENT
        a = int(rng.choice(3, p=probs_a))
        b = int(rng.choice(3, p=probs_b))
        ra = PAYOFF[a, b]
        sa += alpha * (ra - base_a) * grad_log_prob(sa, a)
        if both_learn:
            sb += alpha * (-ra - base_b) * grad_log_prob(sb, b)
        base_a += (ra - base_a) / t  # running average reward (chapter 3's update)
        base_b += (-ra - base_b) / t
        pa[t - 1], pb[t - 1] = probs_a, probs_b
    return pa, pb


def versus_biased(seeds=10, steps=3000, alpha=0.05):
    """The learner's final probability of playing paper, one per seed."""
    return [float(play(steps, alpha, s, both_learn=False)[0][-1, 1]) for s in range(seeds)]


def both_learning(seeds=10, steps=20_000, alpha=0.02):
    """For each seed: (smallest and largest probability of rock for player A over the last 5,000 steps,
    A's average strategy over the whole run)."""
    out = []
    for s in range(seeds):
        pa, _ = play(steps, alpha, s, both_learn=True)
        out.append((float(pa[-5000:, 0].min()), float(pa[-5000:, 0].max()), pa.mean(axis=0)))
    return out


def main(fast=False):
    seeds = 4 if fast else 10
    finals = versus_biased(seeds)
    print(f"learner vs a bot that plays rock half the time: final probability of paper, {seeds} runs:")
    print("  ", np.round(finals, 2))
    print("\nboth players learning (alpha 0.02, 20,000 rounds):")
    for i, (lo, hi, avg) in enumerate(both_learning(seeds)):
        print(f"  run {i}: late in training, P(rock) swings between {lo:.2f} and {hi:.2f}; average strategy {np.round(avg, 3)}")
    if fast:
        assert all(f > 0.9 for f in finals)
        print("ok")


if __name__ == "__main__":
    main(fast="--fast" in sys.argv)
