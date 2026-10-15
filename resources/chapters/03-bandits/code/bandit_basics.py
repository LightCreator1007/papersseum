"""Chapter 3: bandits. Five slot machines, and three ways to play them.

Run it:
    python bandit_basics.py            # the experiment from the chapter (takes a few seconds)
    python bandit_basics.py --fast     # a tiny version that checks itself, for tests

Needs only numpy.
"""

import sys

import numpy as np


def make_casino(rng, arms=5):
    """Each machine pays 1 coin with some hidden probability, otherwise nothing."""
    return rng.uniform(0.1, 0.9, size=arms)


def pull(rng, probs, arm):
    return 1.0 if rng.random() < probs[arm] else 0.0


def argmax_random_ties(values, rng):
    """The index of the largest value; if several tie, pick one of them at random."""
    best = np.max(values)
    return int(rng.choice(np.flatnonzero(values == best)))


def play(strategy, probs, steps, rng, epsilon=0.1, c=1.0):
    """Play `steps` pulls with a strategy: "random", "epsilon" (epsilon = 0 is plain greedy) or "ucb".

    Returns (rewards, arms_pulled).
    """
    k = len(probs)
    q = np.zeros(k)  # our running average for each machine
    n = np.zeros(k)  # how many times we have pulled each machine
    rewards = np.zeros(steps)
    arms = np.zeros(steps, dtype=int)

    for t in range(steps):
        if strategy == "random":
            arm = int(rng.integers(k))
        elif strategy == "epsilon":
            if rng.random() < epsilon:
                arm = int(rng.integers(k))  # explore: any machine, all equally likely
            else:
                arm = argmax_random_ties(q, rng)  # exploit: the best average so far
        elif strategy == "ucb":
            if np.any(n == 0):
                arm = int(np.flatnonzero(n == 0)[0])  # try every machine once first
            else:
                bonus = c * np.sqrt(np.log(t + 1) / n)
                arm = argmax_random_ties(q + bonus, rng)
        else:
            raise ValueError(f"unknown strategy {strategy!r}")

        reward = pull(rng, probs, arm)
        n[arm] += 1
        q[arm] += (reward - q[arm]) / n[arm]  # new = old + step * (surprise)
        rewards[t] = reward
        arms[t] = arm
    return rewards, arms


def compare(casinos=200, steps=1000, seed=0):
    """Average each strategy over many random casinos.

    Returns {name: (average payout chance, share of pulls on the best machine)}.
    Each pull is scored by the true chance of the machine we picked, which is what it pays
    on average. That keeps luck out of the comparison, so no strategy can beat the best machine.
    """
    setups = {
        "random": dict(strategy="random"),
        "greedy (epsilon = 0)": dict(strategy="epsilon", epsilon=0.0),
        "epsilon = 0.01": dict(strategy="epsilon", epsilon=0.01),
        "epsilon = 0.1": dict(strategy="epsilon", epsilon=0.1),
        "epsilon = 0.3": dict(strategy="epsilon", epsilon=0.3),
        "UCB (c = 1)": dict(strategy="ucb", c=1.0),
    }
    # The casinos are made once, up front, so every strategy plays exactly the same ones.
    casino_rng = np.random.default_rng(seed)
    all_probs = [make_casino(casino_rng) for _ in range(casinos)]
    best_possible = float(np.mean([p.max() for p in all_probs]))

    out = {}
    for name, kwargs in setups.items():
        play_rng = np.random.default_rng(seed + 1)
        avg_reward = 0.0
        on_best = 0.0
        for probs in all_probs:
            _, arms = play(probs=probs, steps=steps, rng=play_rng, **kwargs)
            avg_reward += probs[arms].mean() / casinos
            on_best += np.mean(arms == np.argmax(probs)) / casinos
        out[name] = (avg_reward, on_best)
    out["best possible"] = (best_possible, 1.0)
    return out


def main(fast=False):
    results = compare(casinos=20, steps=300) if fast else compare()
    width = max(len(name) for name in results)
    print(f"{'strategy'.ljust(width)}   avg payout   pulls on best machine")
    for name, (reward, share) in results.items():
        print(f"{name.ljust(width)}   {reward:9.3f}   {100 * share:14.0f}%")
    if fast:
        # a few things that must always be true, so a broken edit is caught by the tests
        assert results["epsilon = 0.1"][0] > results["random"][0]
        assert results["UCB (c = 1)"][0] > results["random"][0]
        assert results["best possible"][0] >= max(r for r, _ in results.values()) - 1e-12
        print("ok")


if __name__ == "__main__":
    main(fast="--fast" in sys.argv)
