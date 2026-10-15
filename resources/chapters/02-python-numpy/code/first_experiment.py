"""Chapter 2: your first experiment. Flip a fair coin many times and watch the share of heads settle near 1/2.

Run it:
    python first_experiment.py          # the experiment from the lesson
    python first_experiment.py --fast   # a quick, self-checking version (for tests)

Needs only numpy.
"""

import sys

import numpy as np


def share_of_heads(flips, sizes):
    """For each n in sizes, the share of heads in the first n flips."""
    return {n: float(flips[:n].mean()) for n in sizes}


def typical_error(n, repeats, rng):
    """Flip n coins `repeats` times; return the typical size (standard deviation) of the error in the share of heads."""
    shares = rng.integers(0, 2, size=(repeats, n)).mean(axis=1)
    return float(shares.std())


def main(fast=False):
    rng = np.random.default_rng(0)  # a seed makes the experiment repeatable
    flips = rng.integers(0, 2, size=100_000)  # 0 = tails, 1 = heads
    sizes = (10, 100, 1_000, 10_000, 100_000)

    print("flips      share of heads")
    shares = share_of_heads(flips, sizes)
    for n, share in shares.items():
        print(f"{n:>7}      {share:.4f}")

    print("\nhow far off are we, typically? (compared with the rule 0.5 / sqrt(n))")
    repeats = 400 if fast else 2000
    errors = {}
    for n in (100, 10_000):
        errors[n] = typical_error(n, repeats, rng)
        print(f"n = {n:>6}: typical error {errors[n]:.4f}   rule says {0.5 / n**0.5:.4f}")

    if fast:
        assert abs(shares[100_000] - 0.5) < 0.01
        for n, err in errors.items():
            assert abs(err - 0.5 / n**0.5) / (0.5 / n**0.5) < 0.15, (n, err)
        print("ok")


if __name__ == "__main__":
    main(fast="--fast" in sys.argv)
