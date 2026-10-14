"""Checks every number quoted in the chapter 4 lesson, so the text and the maths cannot drift apart.

    python check_numbers.py
"""

import numpy as np

from student_mdp import FRESH, REST, STUDY, TRANSITIONS, REWARDS, TIRED, average_return, discounted_return, return_backwards


def close(a, b, tol=1e-9):
    return abs(a - b) <= tol


def exact_values(policy, gamma):
    """V for each state by solving  V = r + gamma * P V  exactly."""
    p = np.array([TRANSITIONS[s][policy[s]] for s in (FRESH, TIRED)])
    r = np.array([REWARDS[s][policy[s]] for s in (FRESH, TIRED)])
    return np.linalg.solve(np.eye(2) - gamma * p, r)


def main():
    # --- Returns: the worked example, forwards and backwards
    assert close(discounted_return([1, 0, 0, 5], 0.9), 4.645)
    assert close(1 + 0.9**3 * 5, 4.645) and close(0.9**3, 0.729)
    g3 = 5.0
    g2 = 0 + 0.9 * g3
    g1 = 0 + 0.9 * g2
    g0 = 1 + 0.9 * g1
    assert (g3, g2, round(g1, 10), round(g0, 10)) == (5.0, 4.5, 4.05, 4.645)
    assert close(return_backwards([1, 0, 0, 5], 0.9), 4.645)
    assert close(discounted_return([2, 0, 3], 0.5), 2.75)  # check-yourself answer
    assert close(2 + 0.9 * 10, 11.0)  # check-yourself: G = R + gamma * G_next
    assert close(1 / (1 - 0.9), 10.0)

    # --- The cheese hunt from chapter 0: one reward of 1, seven steps away, discounted at 0.9
    assert close(0.9**6, 0.531441) and round(0.9**6, 2) == 0.53

    # --- The discount playground: ten steady rewards of 1 against a prize of 15 on the last step
    steady = lambda g: (1 - g**10) / (1 - g)
    prize = lambda g: 15 * g**9
    assert (round(steady(0.5), 2), round(prize(0.5), 3)) == (2.0, 0.029)
    assert (round(steady(0.9), 2), round(prize(0.9), 2)) == (6.51, 5.81)
    assert (round(steady(0.95), 2), round(prize(0.95), 2)) == (8.03, 9.45)
    lo, hi = 0.5, 0.99
    for _ in range(100):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if steady(mid) > prize(mid) else (lo, mid)
    assert round(lo, 2) == 0.92  # below this the trickle wins; above it the prize does

    # --- The student's evening: exact values of the policies (gamma = 0.9)
    exact = {
        "study, study": exact_values([STUDY, STUDY], 0.9),
        "study when fresh, rest when tired": exact_values([STUDY, REST], 0.9),
        "rest when fresh, study when tired": exact_values([REST, STUDY], 0.9),
        "always rest": exact_values([REST, REST], 0.9),
    }
    assert np.allclose(exact["study, study"], [15.94, 12.03], atol=0.006)
    assert np.allclose(exact["study when fresh, rest when tired"], [20.09, 17.34], atol=0.006)
    assert np.allclose(exact["rest when fresh, study when tired"], [8.78, 7.43], atol=0.006)
    assert np.allclose(exact["always rest"], [8.90, 7.68], atol=0.006)
    assert max(exact, key=lambda k: exact[k][0]) == "study when fresh, rest when tired"

    # --- A simulation of 4000 evenings agrees with the exact values (from Fresh)
    for name, policy in (("study, study", [STUDY, STUDY]), ("study when fresh, rest when tired", [STUDY, REST]), ("always rest", [REST, REST])):
        sim = average_return(policy, FRESH, 0.9, 4000, 100, seed=0)
        assert abs(sim - exact[name][0]) < 0.5, (name, sim)
    assert round(average_return([STUDY, STUDY], FRESH, 0.9, 4000, 100, seed=0), 1) == 15.9
    assert round(average_return([STUDY, REST], FRESH, 0.9, 4000, 100, seed=0), 2) == 20.09
    assert round(average_return([REST, REST], FRESH, 0.9, 4000, 100, seed=0), 2) == 8.91

    # --- Check-yourself: from Fresh, always studying, the chance of being Fresh after two steps
    p_fresh_fresh = TRANSITIONS[FRESH][STUDY][FRESH]
    p_tired_fresh = TRANSITIONS[TIRED][STUDY][FRESH]
    assert close(TRANSITIONS[FRESH][STUDY][TIRED], 0.4)
    assert close(p_fresh_fresh * p_fresh_fresh + TRANSITIONS[FRESH][STUDY][TIRED] * p_tired_fresh, 0.44)

    print("every number in chapter 4 checks out")


if __name__ == "__main__":
    main()
