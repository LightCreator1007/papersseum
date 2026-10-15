"""Chapter 9: learning values with a formula instead of a table, on a 1,000-state random walk.

A walker stands on a line of 1,000 positions and starts in the middle (500). Each step it jumps a random distance
between 1 and 100 to the left or right (all 200 jumps equally likely). Jump off the left end and the episode ends with
reward -1; off the right end, reward +1. There is no discounting. The true value of a position is the average
reward it leads to, which rises smoothly from about -1 on the far left to about +1 on the far right.

A table would need 1,000 numbers. We learn with a formula of just a few weights instead:

    value(s)  ~  w . x(s)        (a dot product of the weights w with some numbers x(s) describing the position)

and after every step we nudge the weights with a TD update:   w <- w + alpha * (surprise) * x(s).

Two ways to describe a position:
    "groups"   10 weights; a position's description says which block of 100 positions it is in
    "line"     2 weights; the description is [1, position / 1000], so the value is a straight line

Run it:
    python linear_td.py            # learn with both, compare against the exact values
    python linear_td.py --fast     # a quicker, self-checking version (for tests)

Needs only numpy.
"""

import sys

import numpy as np

N = 1000
JUMP = 100


def true_values():
    """Exact values by solving the Bellman equations as a linear system."""
    a = np.eye(N)
    b = np.zeros(N)
    for s in range(N):
        for jump in range(1, JUMP + 1):
            for target in (s - jump, s + jump):
                if target < 0:
                    b[s] += -1.0 / (2 * JUMP)
                elif target >= N:
                    b[s] += 1.0 / (2 * JUMP)
                else:
                    a[s, target] -= 1.0 / (2 * JUMP)
    return np.linalg.solve(a, b)


def features(kind, s):
    if kind == "table":
        x = np.zeros(N)
        x[s] = 1.0
        return x
    if kind == "groups":
        x = np.zeros(10)
        x[s // 100] = 1.0
        return x
    return np.array([1.0, s / N])


def n_weights(kind):
    return {"table": N, "groups": 10, "line": 2}[kind]


def next_position(s, rng):
    jump = int(rng.integers(1, JUMP + 1)) * (1 if rng.random() < 0.5 else -1)
    return s + jump


def predict(kind, w):
    if kind == "table":
        return w.copy()
    return np.array([w @ features(kind, s) for s in range(N)])


def rms_error(estimate, truth):
    return float(np.sqrt(np.mean((estimate - truth) ** 2)))


def learn(kind, episodes, alpha, seed=0, checkpoints=(), truth=None):
    """Semi-gradient TD(0) with a linear formula (a table is the special case with one weight per position).

    Returns (weights, {episode: average error}) where the dict has the average error at each checkpoint episode.
    """
    rng = np.random.default_rng(seed)
    w = np.zeros(n_weights(kind))
    curve = {}
    for episode in range(1, episodes + 1):
        s = 500
        while True:
            nxt = next_position(s, rng)
            x = features(kind, s)
            if nxt < 0:
                target = -1.0
            elif nxt >= N:
                target = 1.0
            else:
                target = w @ features(kind, nxt)  # the next position's estimate (a guess, as in chapter 8)
            w += alpha * (target - w @ x) * x  # w <- w + alpha * (surprise) * x
            if nxt < 0 or nxt >= N:
                break
            s = nxt
        if episode in checkpoints:
            curve[episode] = rms_error(predict(kind, w), truth)
    return w, curve


def best_possible_error(kind, truth):
    """The smallest average error ANY setting of the weights could reach (a least-squares fit to the true values)."""
    x = np.array([features(kind, s) for s in range(N)])
    w = np.linalg.lstsq(x, truth, rcond=None)[0]
    return rms_error(x @ w, truth)


def main(fast=False):
    truth = true_values()
    print(f"true values: far left {truth[0]:.3f}, middle {truth[500]:.3f}, far right {truth[999]:.3f}")
    for kind in ("groups", "line"):
        print(f"best possible average error with {n_weights(kind)} weights ({kind}): {best_possible_error(kind, truth):.3f}")

    seeds = 2 if fast else 5
    checkpoints = (100, 300, 1000, 3000)
    episodes = max(checkpoints)
    settings = {"table": 0.1, "groups": 0.01, "line": 0.01}  # a step size for each
    print(f"\naverage error after this many episodes (mean of {seeds} runs):")
    print("episodes   " + "   ".join(f"{k + f' ({n_weights(k)} weights)':>20}" for k in settings))
    curves = {k: [learn(k, episodes, a, seed=s, checkpoints=checkpoints, truth=truth)[1] for s in range(seeds)] for k, a in settings.items()}
    for c in checkpoints:
        print(f"{c:>8}   " + "   ".join(f"{np.mean([r[c] for r in curves[k]]):>20.3f}" for k in settings))
    if fast:
        assert np.mean([r[1000] for r in curves["line"]]) < np.mean([r[1000] for r in curves["table"]])
        print("ok")


if __name__ == "__main__":
    main(fast="--fast" in sys.argv)
