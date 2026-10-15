"""Chapter 1: the maths toolkit, as running code.

Run it:
    python toolkit_examples.py            # print every example from the chapter
    python toolkit_examples.py --fast     # the same, checking itself (for tests)

Needs only numpy.
"""

import math
import sys

import numpy as np


def sums():
    rewards = [1, 0, 1, 1, 0]
    print("sum of the rewards", rewards, "=", sum(rewards))
    n = 100
    print(f"1 + 2 + ... + {n} =", sum(range(1, n + 1)), "(formula n(n+1)/2 =", n * (n + 1) // 2, ")")
    return sum(rewards), sum(range(1, n + 1))


def probability_and_expected_value(rng):
    print("chance of two sixes in two rolls:", round(1 / 36, 4))
    print("chance of at least one six in two rolls:", round(1 - (5 / 6) ** 2, 4), "(= 11/36)")
    faces = np.arange(1, 7)
    print("expected value of one die:", faces.mean())
    print("slot machine: pays 5 with chance 0.1, costs 1 ->", 5 * 0.1 - 1)

    rolls = rng.integers(1, 7, size=10_000)
    for n in (10, 100, 10_000):
        print(f"average of the first {n:>6} rolls: {rolls[:n].mean():.3f}")
    return rolls


def discounting():
    gamma = 0.9
    forever = 1 / (1 - gamma)
    fifty = (1 - gamma**50) / (1 - gamma)
    print(f"1 + 0.9 + 0.9^2 + ... = {forever:.2f}; the first 50 terms add up to {fifty:.2f}")
    print("a machine paying 0.7 on average, discounted at 0.9, is worth", round(0.7 * forever, 2))
    return forever, fifty


def logs():
    print("ln(e^2) =", math.log(math.e**2), "| ln 10 =", round(math.log(10), 4))
    print("ln(0.5 * 0.5 * 0.5) =", round(math.log(0.125), 4), "= 3 * ln 0.5 =", round(3 * math.log(0.5), 4))
    print("ln 6 =", round(math.log(6), 4), "= ln 2 + ln 3 =", round(math.log(2) + math.log(3), 4))


def slopes():
    f = lambda x: x * x - 4 * x + 5
    print("f(x) = x^2 - 4x + 5:  f(3) =", f(3), " f(2) =", f(2), "(the lowest point)")
    # slope of x^2 at x = 3, squeezing the gap between two nearby points
    for gap in (1, 0.1, 0.01, 0.001):
        print(f"  gap {gap:>6}: slope between x = 3 and x = {3 + gap} is {((3 + gap) ** 2 - 9) / gap:.4f}")
    g = lambda x: (3 * x + 1) ** 2
    h = 1e-6
    print("slope of (3x + 1)^2 at x = 1, measured:", round((g(1 + h) - g(1 - h)) / (2 * h), 3), "| chain rule 2(3x+1)*3 =", 2 * 4 * 3)


def vectors_and_matrices():
    a = np.array([1, 2, 3])
    b = np.array([4, 5, 6])
    m = np.array([[1, 2], [3, 4]])
    v = np.array([5, 6])
    print("dot product", a, "·", b, "=", a @ b)
    print("matrix times vector:", m @ v)
    return a @ b, m @ v


def main(fast=False):
    s5, s100 = sums()
    rolls = probability_and_expected_value(np.random.default_rng(0))
    forever, fifty = discounting()
    logs()
    slopes()
    dot, mv = vectors_and_matrices()
    if fast:
        assert s5 == 3 and s100 == 5050
        assert abs(rolls[:10_000].mean() - 3.5) < 0.1
        assert abs(forever - 10) < 1e-9 and 9.9 < fifty < 10
        assert dot == 32 and list(mv) == [17, 39]
        print("ok")


if __name__ == "__main__":
    main(fast="--fast" in sys.argv)
