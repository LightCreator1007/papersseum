"""Checks every number quoted in the chapter 6 lesson, so the text and the maths cannot drift apart.

    python check_numbers.py
"""

import math

import numpy as np

from dp_student import FRESH, REST, STUDY, TIRED, evaluation_sweep, policy_evaluation, policy_iteration, q_table, value_iteration
from gridworld_dp import START, value_iteration as grid_value_iteration


def close(a, b, tol=1e-9):
    return abs(a - b) <= tol


def corridor_sweeps(gamma, sweeps):
    """Cells 0, 1, 2 then the goal. Always step right. Reaching the goal pays 1. Returns the values after each sweep."""
    v = np.zeros(3)
    history = [v.copy()]
    for _ in range(sweeps):
        new = np.array([gamma * v[1], gamma * v[2], 1.0])  # using the OLD values on the right
        v = new
        history.append(v.copy())
    return history


def main():
    gamma = 0.9

    # --- The corridor ripple: values spread backwards from the goal, one cell per sweep
    h = corridor_sweeps(0.9, 4)
    assert np.allclose(h[1], [0, 0, 1]) and np.allclose(h[2], [0, 0.9, 1]) and np.allclose(h[3], [0.81, 0.9, 1]) and np.allclose(h[4], h[3])
    assert close(0.9 * 0.9, 0.81)
    assert np.allclose(corridor_sweeps(0.5, 5)[-1], [0.25, 0.5, 1.0])  # check-yourself answer

    # --- Policy evaluation on the student, sweep by sweep (policy: study when fresh, rest when tired)
    policy = [STUDY, REST]
    v, hist = policy_evaluation(policy, gamma)
    assert np.allclose(hist[1], [3, 0]) and np.allclose(hist[2], [4.62, 1.89]) and np.allclose(hist[3], [6.1752, 3.4209])
    assert close(3 + 0.9 * (0.6 * 3 + 0.4 * 0), 4.62) and close(0.9 * (0.7 * 3 + 0.3 * 0), 1.89)
    assert np.allclose(hist[10], [13.435, 10.683], atol=0.001) and np.allclose(hist[20], [17.771, 15.018], atol=0.001)
    assert np.allclose(v, [20.09, 17.34], atol=0.006)

    # --- The error shrinks by a factor of (at least) gamma every sweep
    errors = [np.max(np.abs(x - v)) for x in hist]
    assert all(errors[i + 1] <= 0.9 * errors[i] + 1e-12 for i in range(60))
    first_within = next(i for i, e in enumerate(errors) if e < 0.01)
    assert first_within == 72
    guaranteed = math.ceil(math.log(20.09 / 0.01) / math.log(1 / 0.9))
    assert guaranteed == 73 and first_within <= guaranteed
    assert round(math.log(20.09 / 0.01), 2) == 7.61 and round(math.log(1 / 0.9), 4) == 0.1054
    assert math.ceil(math.log(8 / 0.1) / math.log(2)) == 7 and 8 / 2**6 > 0.1 > 8 / 2**7  # check-yourself answer

    # --- Policy iteration from "always rest"
    best, rounds = policy_iteration(gamma, start=(REST, REST))
    assert rounds[0][0] == [REST, REST] and np.allclose(rounds[0][1], [8.90, 7.68], atol=0.006)
    q0 = q_table(rounds[0][1], gamma)
    assert round(q0[FRESH, STUDY], 2) == 10.57 and round(q0[FRESH, REST], 2) == 8.90  # fresh: switch to study
    assert round(q0[TIRED, STUDY], 2) == 7.63 and round(q0[TIRED, REST], 2) == 7.68  # tired: rest is still (just) better
    assert rounds[1][0] == [STUDY, REST] and np.allclose(rounds[1][1], [20.09, 17.34], atol=0.006)
    assert best == [STUDY, REST] and len(rounds) == 2

    # --- Value iteration from zeros
    vstar, vpol, vh = value_iteration(gamma)
    assert np.allclose(vh[1], [3, 0.5]) and np.allclose(vh[2], [4.8, 2.025]) and np.allclose(vh[3], [6.321, 3.571], atol=0.001) and np.allclose(vh[4], [7.699, 4.946], atol=0.001)
    assert close(3 + 0.9 * (0.6 * 3 + 0.4 * 0.5), 4.8) and close(0.9 * (0.7 * 3 + 0.3 * 0.5), 2.025)
    assert np.allclose(vstar, [20.09, 17.34], atol=0.006) and vpol == [STUDY, REST]

    # --- The grid world
    v0, p0, sweeps0 = grid_value_iteration(0.9, 0.0)
    assert sweeps0 == 6 and round(v0[(0, 2)], 3) == 1.0 and round(v0[(0, 1)], 3) == 0.86 and round(v0[(0, 0)], 3) == 0.734
    assert round(v0[(1, 0)], 3) == 0.621 and round(v0[START], 3) == 0.519
    assert close(-0.04 + 0.9 * 1.0, 0.86) and round(-0.04 + 0.9 * 0.86, 3) == 0.734 and round(-0.04 + 0.9 * 0.734, 3) == 0.621
    assert p0[START] == "up"
    v2, p2, sweeps2 = grid_value_iteration(0.9, 0.2)
    assert sweeps2 == 29 and round(v2[START], 3) == 0.374 and round(v2[(2, 3)], 3) == 0.189
    assert p2[(2, 3)] == "left" and p2[(2, 1)] == "right"  # slipping: keep away from the pit; and note the cautious route

    print("every number in chapter 6 checks out")


if __name__ == "__main__":
    main()
