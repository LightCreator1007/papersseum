"""Chapter 13: the Elo rating system, which turns match results into skill ratings.

    expected score of A against B  =  1 / (1 + 10 ^ ((rating of B - rating of A) / 400))
    new rating of A                =  old rating of A + K * (actual score - expected score)

A win counts as 1 and a loss as 0 (a draw as 0.5). K controls how far one result moves a rating.

Run it:
    python elo.py            # worked examples, and a simulation of ratings finding the true order
    python elo.py --fast     # a quick, self-checking version (for tests)

Needs only numpy.
"""

import sys

import numpy as np


def expected_score(rating_a, rating_b):
    return 1.0 / (1.0 + 10.0 ** ((rating_b - rating_a) / 400.0))


def update(rating_a, rating_b, score_a, k=32.0):
    """Returns the new ratings of A and B after a game where A scored `score_a` (1 win, 0.5 draw, 0 loss)."""
    e = expected_score(rating_a, rating_b)
    return rating_a + k * (score_a - e), rating_b + k * ((1 - score_a) - (1 - e))


def simulate(games, k, seed, true=(1000.0, 1100.0, 1200.0, 1400.0)):
    """Players with known true strengths play random pairings; results are drawn from the true win chances.
    Returns the final estimated ratings, shifted to have the same average as the true ones."""
    true = np.array(true)
    rng = np.random.default_rng(seed)
    ratings = np.full(len(true), 1000.0)
    for _ in range(games):
        i, j = rng.choice(len(true), size=2, replace=False)
        score = 1.0 if rng.random() < expected_score(true[i], true[j]) else 0.0
        ratings[i], ratings[j] = update(ratings[i], ratings[j], score, k)
    return ratings - ratings.mean() + true.mean()


def accuracy(games, k=16.0, seeds=30, true=(1000.0, 1100.0, 1200.0, 1400.0)):
    """Over many simulations: (average of the largest rating error, how many runs put the players in the right order)."""
    errors, ordered = [], 0
    for seed in range(seeds):
        r = simulate(games, k, seed, true)
        errors.append(np.abs(r - np.array(true)).max())
        ordered += list(np.argsort(r)) == list(np.argsort(true))
    return float(np.mean(errors)), ordered


def main(fast=False):
    e = expected_score(1000, 1200)
    print(f"a 1000-rated player against a 1200-rated one is expected to score {e:.4f}")
    print("if they win:", round(update(1000, 1200, 1.0)[0], 2), " if they lose:", round(update(1000, 1200, 0.0)[0], 2))
    print("\nhow often does the favourite win, by rating gap?")
    for gap in (0, 100, 200, 400, 800):
        print(f"  gap {gap:>3}: {expected_score(gap, 0):.3f}")
    print("\nfour players with true ratings 1000, 1100, 1200, 1400; K = 16, over 30 simulations:")
    for games in ((100, 500) if fast else (100, 500, 2000, 10000)):
        err, ordered = accuracy(games)
        print(f"  after {games:>5} games: typical largest error {err:4.0f} rating points; right order in {ordered} of 30 runs")
    if fast:
        assert abs(e - 0.2403) < 1e-4
        print("ok")


if __name__ == "__main__":
    main(fast="--fast" in sys.argv)
