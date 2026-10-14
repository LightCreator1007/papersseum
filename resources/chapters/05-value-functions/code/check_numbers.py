"""Checks every number quoted in the chapter 5 lesson, so the text and the maths cannot drift apart.

    python check_numbers.py
"""

import numpy as np

from bellman import FRESH, REST, STUDY, TIRED, bellman_residual, greedy_policy, q_values, values_cramer, values_exact


def close(a, b, tol=1e-9):
    return abs(a - b) <= tol


def main():
    gamma = 0.9
    policy = [STUDY, REST]  # study when fresh, rest when tired

    # --- The two equations, with the numbers filled in:
    #       V_F = 3 + 0.9 (0.6 V_F + 0.4 V_T)   ->   0.46 V_F - 0.36 V_T = 3
    #       V_T = 0 + 0.9 (0.7 V_F + 0.3 V_T)   ->  -0.63 V_F + 0.73 V_T = 0
    assert close(1 - 0.9 * 0.6, 0.46) and close(0.9 * 0.4, 0.36)
    assert close(0.9 * 0.7, 0.63) and close(1 - 0.9 * 0.3, 0.73)

    # --- Solving by substitution:  V_T = (0.63 / 0.73) V_F  ~ 0.863 V_F
    ratio = 0.63 / 0.73
    assert round(ratio, 3) == 0.863
    coefficient = 0.46 - 0.36 * ratio
    assert round(coefficient, 4) == 0.1493
    v_fresh = 3 / coefficient
    v_tired = ratio * v_fresh
    assert round(v_fresh, 2) == 20.09 and round(v_tired, 2) == 17.34

    # --- Solving with Cramer's rule: determinant 0.46 * 0.73 - 0.36 * 0.63 = 0.109
    det = 0.46 * 0.73 - 0.36 * 0.63
    assert round(det, 3) == 0.109 and round(0.46 * 0.73, 4) == 0.3358 and round(0.36 * 0.63, 4) == 0.2268
    assert close(3 * 0.73, 2.19) and close(0.63 * 3, 1.89)
    assert round(2.19 / det, 2) == 20.09 and round(1.89 / det, 2) == 17.34

    # --- The code agrees (exact solve and Cramer's rule), and the Bellman equation holds with no leftover
    v = values_exact(policy, gamma)
    assert np.allclose(v, [v_fresh, v_tired]) and np.allclose(v, values_cramer(policy, gamma))
    assert bellman_residual(policy, v, gamma) < 1e-9

    assert round(v_fresh - v_tired, 2) == 2.75  # "the fresh student is better off by about 2.75 points"

    # --- All four policies
    expected = {
        (STUDY, STUDY): (15.94, 12.03),
        (STUDY, REST): (20.09, 17.34),
        (REST, STUDY): (8.78, 7.43),
        (REST, REST): (8.90, 7.68),
    }
    for pol, (vf, vt) in expected.items():
        got = values_exact(list(pol), gamma)
        assert abs(got[0] - vf) < 0.006 and abs(got[1] - vt) < 0.006, (pol, got)

    # --- Q-values under the best policy: nothing beats it, so it cannot be improved
    q = q_values(v, gamma)
    assert round(q[FRESH, STUDY], 2) == 20.09 and round(q[FRESH, REST], 2) == 18.83
    assert round(q[TIRED, STUDY], 2) == 16.60 and round(q[TIRED, REST], 2) == 17.34
    assert greedy_policy(q) == policy
    # the value of a state is the Q of the action the policy takes
    assert close(q[FRESH, STUDY], v[FRESH]) and close(q[TIRED, REST], v[TIRED])

    # --- With gamma = 0 only the immediate reward counts
    assert np.allclose(values_exact(policy, 0.0), [3.0, 0.0])

    # --- Check-yourself: two states A and B. A gives reward 1 and goes to B; B gives 0 and goes to A. gamma = 0.5
    #       V_A = 1 + 0.5 V_B,  V_B = 0.5 V_A   ->   V_A = 1 + 0.25 V_A   ->   V_A = 4/3, V_B = 2/3
    a = np.linalg.solve(np.eye(2) - 0.5 * np.array([[0, 1], [1, 0]]), [1, 0])
    assert np.allclose(a, [4 / 3, 2 / 3]) and round(4 / 3, 3) == 1.333 and round(2 / 3, 3) == 0.667

    print("every number in chapter 5 checks out")


if __name__ == "__main__":
    main()
