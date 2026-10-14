"""Chapter 8: temporal-difference learning on a five-house street.

A walker starts at house C on a street of five houses (A B C D E). Every step it moves one house left or right,
with equal chance. Falling off the left end earns 0 and falling off the right end earns 1, and then it stops.
The value of each house is the chance of finishing on the right: A = 1/6, B = 2/6, C = 3/6, D = 4/6, E = 5/6.

Two ways to learn those values from played episodes, both using  new = old + alpha * (target - old):
    Monte Carlo   target = the final outcome of the episode (0 or 1), known only at the very end
    TD(0)         target = reward + the current estimate of the NEXT house, available after every single step

Run it:
    python random_walk_td.py            # compare the two learning curves
    python random_walk_td.py --fast     # a quick, self-checking version (for tests)

Needs only numpy.
"""

import sys

import numpy as np

HOUSES = 5
TRUE = np.arange(1, HOUSES + 1) / (HOUSES + 1)  # [1/6, 2/6, 3/6, 4/6, 5/6]


def play_episode(rng, start=2):
    """Returns the list of houses visited (0..4) and the final reward (0 or 1)."""
    house, visited = start, [start]
    while True:
        house += 1 if rng.random() < 0.5 else -1
        if house < 0:
            return visited, 0.0
        if house >= HOUSES:
            return visited, 1.0
        visited.append(house)


def learn_td(episodes, alpha, rng):
    """TD(0). Returns the estimates after each episode (episodes + 1 rows, starting from the first guess of 0.5)."""
    v = np.full(HOUSES, 0.5)
    history = [v.copy()]
    for _ in range(episodes):
        house = 2
        while True:
            nxt = house + (1 if rng.random() < 0.5 else -1)
            if nxt < 0:
                v[house] += alpha * (0.0 - v[house])  # fell off the left: reward 0, nothing after
                break
            if nxt >= HOUSES:
                v[house] += alpha * (1.0 - v[house])  # fell off the right: reward 1, nothing after
                break
            v[house] += alpha * (0.0 + v[nxt] - v[house])  # no reward yet: lean toward the next house's estimate
            house = nxt
        history.append(v.copy())
    return np.array(history)


def learn_mc(episodes, alpha, rng):
    """Every-visit Monte Carlo. Each visited house leans toward the final outcome of the episode."""
    v = np.full(HOUSES, 0.5)
    history = [v.copy()]
    for _ in range(episodes):
        visited, outcome = play_episode(rng)
        for house in visited:
            v[house] += alpha * (outcome - v[house])
        history.append(v.copy())
    return np.array(history)


def rms_error(history):
    """Root-mean-square error against the true values, after each episode."""
    return np.sqrt(((history - TRUE) ** 2).mean(axis=1))


def average_curve(method, alpha, runs, episodes, seed=0):
    rng = np.random.default_rng(seed)
    return np.mean([rms_error(method(episodes, alpha, rng)) for _ in range(runs)], axis=0)


def main(fast=False):
    runs, episodes = (60, 100) if fast else (300, 100)
    print("true values:", TRUE.round(3))
    print("average error (RMS) over", runs, "runs")
    print("episodes   TD(0) a=0.1   MC a=0.1   TD(0) a=0.05   MC a=0.05")
    curves = {(m, a): average_curve(f, a, runs, episodes) for m, f in (("td", learn_td), ("mc", learn_mc)) for a in (0.1, 0.05)}
    for n in (0, 5, 10, 25, 50, 100):
        print(f"{n:>8}   {curves[('td', 0.1)][n]:11.3f}   {curves[('mc', 0.1)][n]:8.3f}   {curves[('td', 0.05)][n]:12.3f}   {curves[('mc', 0.05)][n]:9.3f}")
    if fast:
        assert curves[("td", 0.05)][100] < curves[("mc", 0.05)][100]
        print("ok")


if __name__ == "__main__":
    main(fast="--fast" in sys.argv)
