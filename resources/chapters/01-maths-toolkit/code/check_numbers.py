"""Checks every number quoted in the chapter 1 lesson, so the text and the maths cannot drift apart.

    python check_numbers.py
"""

import math

import numpy as np


def close(a, b, tol=1e-9):
    return abs(a - b) <= tol


def main():
    # --- Sums
    assert sum([1, 0, 1, 1, 0]) == 3
    assert sum(range(1, 101)) == 5050 == 100 * 101 // 2
    assert close(sum([1, 0, 1, 1, 0]) / 5, 0.6)

    # --- Probability
    assert close(1 / 36, 0.027777777777777776) and round(1 / 36, 3) == 0.028
    assert close(1 - (5 / 6) ** 2, 11 / 36) and round(11 / 36, 3) == 0.306
    assert close(sum(range(1, 7)) / 6, 3.5)
    assert close(3.5 + 3.5, 7.0)  # two dice: expected values add
    assert close(5 * 0.1 - 1, -0.5)  # the slot machine: pays 5 with chance 0.1, costs 1
    # a fair coin: 5 heads in 5 flips
    assert close(0.5**5, 1 / 32)

    # --- The average of many rolls settles near 3.5 (true for every seed we try)
    for seed in range(10):
        rolls = np.random.default_rng(seed).integers(1, 7, size=10_000)
        assert abs(rolls.mean() - 3.5) < 0.06, (seed, rolls.mean())

    # --- The exact run quoted in the lesson (seed 0): 10 rolls -> 2.8, 100 rolls -> 3.62, 10000 rolls -> about 3.50
    rolls = np.random.default_rng(0).integers(1, 7, size=10_000)
    assert round(rolls[:10].mean(), 2) == 2.8 and round(rolls[:100].mean(), 2) == 3.62 and round(rolls.mean(), 2) == 3.5

    # --- Discounting
    assert close(1 / (1 - 0.9), 10.0)
    assert round((1 - 0.9**50) / (1 - 0.9), 2) == 9.95
    assert close(0.7 * 10, 7.0)
    # the partial sum really is that, term by term
    assert close(sum(0.9**k for k in range(50)), (1 - 0.9**50) / (1 - 0.9))

    # --- Logarithms
    assert close(math.log(math.e**2), 2.0)
    assert round(math.log(10), 2) == 2.30
    assert round(math.log(0.125), 3) == -2.079 and close(math.log(0.125), 3 * math.log(0.5))
    assert round(math.log(6), 3) == 1.792 and close(math.log(6), math.log(2) + math.log(3))
    assert round(math.log(2), 3) == 0.693 and round(math.log(3), 3) == 1.099

    # --- Slopes: the gap shrinks, the slope of x^2 at x = 3 approaches 6
    slopes = [((3 + g) ** 2 - 9) / g for g in (1, 0.1, 0.01)]
    assert [round(s, 2) for s in slopes] == [7.0, 6.1, 6.01], slopes
    f = lambda x: x * x - 4 * x + 5
    assert f(2) == 1 and f(3) == 2 and f(1) == 2 and f(0) == 5
    assert 2 * 3 - 4 == 2 and 2 * 2 - 4 == 0  # f'(3) = 2, f'(2) = 0
    # the lowest point is at x = 2: nothing nearby is lower
    assert all(f(2) <= f(x) for x in np.linspace(-1, 5, 601))
    # chain rule example
    g = lambda x: (3 * x + 1) ** 2
    h = 1e-6
    assert abs((g(1 + h) - g(1 - h)) / (2 * h) - 24) < 1e-3 and 2 * (3 * 1 + 1) * 3 == 24

    # --- Vectors and matrices
    a, b = np.array([1, 2, 3]), np.array([4, 5, 6])
    assert a @ b == 32 == 1 * 4 + 2 * 5 + 3 * 6
    assert list(np.array([[1, 2], [3, 4]]) @ np.array([5, 6])) == [17, 39]
    assert 1 * 5 + 2 * 6 == 17 and 3 * 5 + 4 * 6 == 39

    # --- Check-yourself answers
    assert sum(i * i for i in range(1, 5)) == 30
    assert close(10 * 0.2 - 3, -1.0)
    assert close(1 / (1 - 0.5), 2.0)
    h2 = lambda x: x * x - 6 * x + 10
    assert 2 * 3 - 6 == 0 and h2(3) == 1 and all(h2(3) <= h2(x) for x in np.linspace(-2, 8, 1001))
    assert np.array([2, 0, 1]) @ np.array([3, 5, 4]) == 10

    print("every number in chapter 1 checks out")


if __name__ == "__main__":
    main()
