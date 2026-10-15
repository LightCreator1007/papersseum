"""Checks every number quoted in the chapter 2 lesson, so the text and the code cannot drift apart.

    python check_numbers.py
"""

import numpy as np

from first_experiment import share_of_heads, typical_error
from tiny_agent import play


def main():
    # --- The coin experiment from the lesson (seed 0)
    flips = np.random.default_rng(0).integers(0, 2, size=100_000)
    shares = share_of_heads(flips, (10, 100, 1_000, 10_000, 100_000))
    quoted = {10: 0.4000, 100: 0.5600, 1_000: 0.5370, 10_000: 0.5030, 100_000: 0.4996}
    for n, share in quoted.items():
        assert round(shares[n], 4) == share, (n, shares[n])

    # --- The size of the error shrinks like 0.5 / sqrt(n): about 0.05 at 100 flips, 0.005 at 10,000
    assert abs(0.5 / 100**0.5 - 0.05) < 1e-12 and abs(0.5 / 10_000**0.5 - 0.005) < 1e-12
    rng = np.random.default_rng(1)
    for n, rule in ((100, 0.05), (10_000, 0.005)):
        err = typical_error(n, 2000, rng)
        assert abs(err - rule) / rule < 0.1, (n, err)
    assert 10_000 // 100 == 100  # 100 times as many flips for 10 times the accuracy

    # --- The tiny agent from the lesson does clearly better than random play (0.50), close to the best machine (0.80)
    average, best = play(pulls=1000, seed=0)
    assert best == 0.8 and 0.70 < average < 0.80, average

    # --- Check-yourself answers
    assert list(np.array([1, 2, 3]) * 2) == [2, 4, 6]
    a = np.array([5, 6, 7, 8, 9])
    assert list(a[a > 6]) == [7, 8, 9] and list(a[1:4]) == [6, 7, 8]
    assert np.array([1, 2]) @ np.array([3, 4]) == 11 == 1 * 3 + 2 * 4

    print("every number in chapter 2 checks out")


if __name__ == "__main__":
    main()
