"""Checks every number quoted in the chapter 0 lesson, so the text and the maths cannot drift apart.

    python check_numbers.py
"""

import numpy as np

from cheese_hunt import LEFT, RIGHT, learn, random_walk_steps, run_episode


def expected_steps_exact(cells):
    """Expected steps for a blind wanderer to reach the last cell, from the start, by solving equations.

    E_i = expected steps from cell i, and E_last = 0. Every step goes left or right with equal chance.
    Bumping the left wall costs a step but you stay put:   E_0 = 1 + (E_0 + E_1) / 2
    Elsewhere:                                           E_i = 1 + (E_(i-1) + E_(i+1)) / 2
    """
    n = cells - 1  # unknowns E_0 .. E_(n-1); E_n = 0 is known
    a = np.zeros((n, n))
    b = np.ones(n)
    a[0, 0] = 0.5
    if n > 1:
        a[0, 1] = -0.5
    for i in range(1, n):
        a[i, i] = 1
        a[i, i - 1] = -0.5
        if i + 1 < n:
            a[i, i + 1] = -0.5  # the E_n term is 0, so it drops out
    return np.linalg.solve(a, b)[0]


def main():
    # --- The 3-cell corridor solved by hand in the lesson:
    #       E_1 = 1 + E_0 / 2      (one step, then left with chance 1/2; right ends it)
    #       E_0 = 1 + (E_0 + E_1) / 2   (bumping the wall keeps you at cell 0)
    #     -> E_0 = 2 + E_1, so E_1 = 1 + (2 + E_1)/2 = 2 + E_1/2, giving E_1 = 4 and E_0 = 6
    e1 = 4.0
    e0 = 2 + e1
    assert abs(e1 - (1 + e0 / 2)) < 1e-12 and abs(e0 - (1 + (e0 + e1) / 2)) < 1e-12 and e0 == 6
    assert abs(expected_steps_exact(3) - 6) < 1e-9

    # --- The general rule: a blind wanderer needs cells * (cells - 1) steps on average
    for cells in (2, 3, 5, 8, 10):
        assert abs(expected_steps_exact(cells) - cells * (cells - 1)) < 1e-6, cells
    assert 8 * (8 - 1) == 56

    # --- A simulation agrees with the maths
    rng = np.random.default_rng(1)
    walks = [random_walk_steps(8, rng) for _ in range(3000)]
    assert abs(np.mean(walks) - 56) < 4, np.mean(walks)

    # --- The learner: its first attempts take dozens of steps; after about 60 it averages 8 or 9
    #     (the shortest possible trip is 7). True for every seed we try, not just one lucky run.
    for seed in (3, 4, 5, 6, 7):
        _, steps = learn(episodes=60, seed=seed)
        assert np.mean(steps[:5]) > 20, (seed, np.mean(steps[:5]))
        assert 7 <= np.mean(steps[-10:]) < 11, (seed, np.mean(steps[-10:]))
        assert min(steps) == 7
    q, steps = learn(episodes=60, seed=3)
    late = np.mean(steps[-10:])
    assert 56 / late > 3  # "several times faster than blind wandering"

    # --- With discount 0.9, a cell k steps from the cheese is worth 0.9^(k-1) once it has learned
    #     (so the start cell, 7 steps away, is worth 0.9^6 = 0.531441)
    q, _ = learn(episodes=400, seed=5)
    assert abs(q[6, RIGHT] - 1.0) < 1e-9
    assert abs(q[0, RIGHT] - 0.9**6) < 0.03, q[0, RIGHT]
    assert abs(0.9**6 - 0.531441) < 1e-12
    assert q[0, RIGHT] > q[0, LEFT]

    print("every number in chapter 0 checks out")


if __name__ == "__main__":
    main()
