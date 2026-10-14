"""Checks every number quoted in the chapter 7 lesson, so the text and the maths cannot drift apart.

    python check_numbers.py
"""

import numpy as np

from mc_grid import GOAL, MOVES, PIT, START, WALL, best_moves, learn
from mc_student import FRESH, REST, STUDY, estimate


def close(a, b, tol=1e-9):
    return abs(a - b) <= tol


def main():
    # --- The worked episode in the lesson: five steps from the start to the goal, discount 0.9.
    #     Rewards: four steps costing 0.04, then +1 for reaching the goal. Returns are worked out backwards.
    rewards = [-0.04, -0.04, -0.04, -0.04, 1.0]
    g, returns = 0.0, []
    for r in reversed(rewards):
        g = r + 0.9 * g
        returns.append(g)
    returns.reverse()
    assert [round(x, 3) for x in returns] == [0.519, 0.621, 0.734, 0.86, 1.0], returns
    assert close(-0.04 + 0.9 * 1.0, 0.86) and round(-0.04 + 0.9 * 0.86, 3) == 0.734

    # --- Monte Carlo prediction on the student (true value from Fresh: 20.09), seed 0
    expected = {10: (19.42, 0.39), 100: (20.26, 0.28), 1000: (20.03, 0.09), 10000: (20.13, 0.03)}
    sd = None
    for n, (mean, se) in expected.items():
        m, s, sd = estimate([STUDY, REST], FRESH, 0.9, n, 100, seed=0)
        assert round(m, 2) == mean and round(s, 2) == se, (n, m, s)
    assert round(sd, 1) == 2.7  # one episode's return varies by about 2.7
    # the typical error shrinks like (single-episode spread) / sqrt(n):  2.7 / sqrt(100) = 0.27, 2.7 / sqrt(10000) = 0.027
    assert round(2.7 / 100**0.5, 2) == 0.27 and round(2.7 / 10000**0.5, 3) == 0.027

    # --- Monte Carlo control on the grid, one run (seed 0, 3000 episodes): close to the exact values
    q = learn(episodes=3000, seed=0)
    value = lambda cell: max(q[(cell, m)] for m in MOVES)
    assert abs(value((0, 0)) - 0.734) < 0.02 and abs(value((0, 1)) - 0.860) < 0.02 and abs(value((0, 2)) - 1.0) < 0.02
    assert round(value(START), 2) == 0.51  # the exact value is 0.519
    policy = best_moves(q)
    optimal = {
        (0, 0): {"right"}, (0, 1): {"right"}, (0, 2): {"right"}, (1, 0): {"up"}, (1, 2): {"up"},
        (2, 0): {"up", "right"}, (2, 1): {"right"}, (2, 2): {"up"}, (2, 3): {"left"},
    }
    assert all(policy[c] in ok for c, ok in optimal.items())  # every cell picks an optimal move in this run
    assert round(value((2, 3)), 2) == 0.26  # ...but a cell next to the pit that is rarely visited is still far off (exact: 0.621)

    # --- Across ten different seeds, most but not all cells are right: 8.6 of 9 on average
    matches = []
    for seed in range(10):
        p = best_moves(learn(episodes=3000, seed=seed))
        matches.append(sum(p[c] in ok for c, ok in optimal.items()))
    assert round(float(np.mean(matches)), 1) == 8.6 and min(matches) >= 7, matches

    # --- Check-yourself answers
    g, out = 0.0, []
    for r in reversed([-1, -1, 5]):  # rewards -1, -1, +5 with no discounting
        g = r + 1.0 * g
        out.append(g)
    assert out[::-1] == [3, 4, 5]
    assert (2.7 / 0.1) ** 2 == 729.0000000000001 or round((2.7 / 0.1) ** 2) == 729  # episodes for a typical error of 0.1

    print("every number in chapter 7 checks out")


if __name__ == "__main__":
    main()
