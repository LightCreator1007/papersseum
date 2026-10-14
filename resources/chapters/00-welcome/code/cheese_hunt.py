"""Chapter 0: the cheese hunt, in Python.

A learner starts at the left end of an 8-cell corridor. The cheese is in the last cell.
It is never told where the cheese is; it only finds out how each attempt went.

Run it:
    python cheese_hunt.py            # watch the attempts get shorter
    python cheese_hunt.py --fast     # a quick version that checks itself, for tests

Needs only numpy. (This is Q-learning, which chapter 8 explains properly.)
"""

import sys

import numpy as np

LEFT, RIGHT = 0, 1


def move(cells, cell, action):
    """One step along the corridor. The walls stop you."""
    return min(cells - 1, max(0, cell + (1 if action == RIGHT else -1)))


def run_episode(q, rng, alpha=0.5, gamma=0.9, epsilon=0.2, max_steps=500):
    """One attempt, from the start until the cheese is found. Updates q as it goes. Returns the steps taken."""
    cells = q.shape[0]
    cell = 0
    for step in range(1, max_steps + 1):
        if rng.random() < epsilon:
            action = int(rng.integers(2))  # try something random
        elif q[cell, LEFT] == q[cell, RIGHT]:
            action = int(rng.integers(2))  # no preference yet: flip a coin
        else:
            action = int(np.argmax(q[cell]))  # do what has worked best so far

        nxt = move(cells, cell, action)
        done = nxt == cells - 1
        reward = 1.0 if done else 0.0
        target = reward + (0.0 if done else gamma * q[nxt].max())
        # new estimate = old estimate + step size * (target - old estimate)
        q[cell, action] += alpha * (target - q[cell, action])
        if done:
            return step
        cell = nxt
    return max_steps


def learn(cells=8, episodes=60, seed=3, **kwargs):
    """Run many attempts. Returns (q, steps_per_attempt)."""
    rng = np.random.default_rng(seed)
    q = np.zeros((cells, 2))
    steps = [run_episode(q, rng, **kwargs) for _ in range(episodes)]
    return q, steps


def random_walk_steps(cells, rng, max_steps=100_000):
    """A blind wanderer: every step left or right with equal chance. Returns steps until the cheese."""
    cell = 0
    for step in range(1, max_steps + 1):
        cell = move(cells, cell, int(rng.integers(2)))
        if cell == cells - 1:
            return step
    return max_steps


def arrows(q):
    return " ".join("." if l == r else ("->" if r > l else "<-") for l, r in q[:-1])


def main(fast=False):
    episodes = 40 if fast else 60
    q, steps = learn(episodes=episodes)
    print("steps taken in each attempt:")
    print(" ".join(f"{s}" for s in steps))
    print("preferred direction from each cell:", arrows(q))
    early, late = np.mean(steps[:5]), np.mean(steps[-10:])
    print(f"first five attempts averaged {early:.0f} steps; the last ten averaged {late:.0f} (the shortest possible is 7)")
    if fast:
        assert late < early
        assert arrows(q) == " ".join(["->"] * 7)
        print("ok")


if __name__ == "__main__":
    main(fast="--fast" in sys.argv)
