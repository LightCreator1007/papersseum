"""Chapter 5: value functions and the Bellman equation, on the student's evening from chapter 4.

    state, action      reward   next state
    Fresh, Study         3      Fresh 0.6, Tired 0.4
    Fresh, Rest          1      Fresh 0.9, Tired 0.1
    Tired, Study         0.5    Fresh 0.2, Tired 0.8
    Tired, Rest          0      Fresh 0.7, Tired 0.3

Run it:
    python bellman.py            # solve for the value of every policy, then look for improvements
    python bellman.py --fast     # the same, checking itself (for tests)

Needs only numpy.
"""

import itertools
import sys

import numpy as np

FRESH, TIRED = 0, 1
STUDY, REST = 0, 1
STATES = ["Fresh", "Tired"]
ACTIONS = ["Study", "Rest"]

# P[state][action] = [chance of Fresh next, chance of Tired next]
P = {
    FRESH: {STUDY: [0.6, 0.4], REST: [0.9, 0.1]},
    TIRED: {STUDY: [0.2, 0.8], REST: [0.7, 0.3]},
}
R = {FRESH: {STUDY: 3.0, REST: 1.0}, TIRED: {STUDY: 0.5, REST: 0.0}}


def policy_matrices(policy):
    """For a policy (the action in each state): the transition matrix and the reward vector it produces."""
    p = np.array([P[s][policy[s]] for s in (FRESH, TIRED)])
    r = np.array([R[s][policy[s]] for s in (FRESH, TIRED)])
    return p, r


def values_exact(policy, gamma):
    """The value of each state under a policy, by solving the Bellman equation  V = r + gamma P V,
    which rearranges to  (I - gamma P) V = r."""
    p, r = policy_matrices(policy)
    return np.linalg.solve(np.eye(2) - gamma * p, r)


def values_cramer(policy, gamma):
    """The same answer for two states, using Cramer's rule on  (I - gamma P) V = r."""
    p, r = policy_matrices(policy)
    a = np.eye(2) - gamma * p
    det = a[0, 0] * a[1, 1] - a[0, 1] * a[1, 0]
    v_fresh = (r[0] * a[1, 1] - a[0, 1] * r[1]) / det
    v_tired = (a[0, 0] * r[1] - r[0] * a[1, 0]) / det
    return np.array([v_fresh, v_tired])


def q_values(v, gamma):
    """Q[state][action]: take this action now, then follow whatever policy produced the values v."""
    return np.array([[R[s][a] + gamma * np.dot(P[s][a], v) for a in (STUDY, REST)] for s in (FRESH, TIRED)])


def bellman_residual(policy, v, gamma):
    """How far v is from satisfying the Bellman equation for this policy (0 means it does)."""
    p, r = policy_matrices(policy)
    return float(np.max(np.abs(v - (r + gamma * p @ v))))


def greedy_policy(q):
    """In each state, the action with the highest Q."""
    return [int(np.argmax(q[s])) for s in (FRESH, TIRED)]


def main(fast=False):
    gamma = 0.9
    print(f"value of each state under each policy (gamma = {gamma}):")
    best, best_v = None, None
    for policy in itertools.product((STUDY, REST), repeat=2):
        v = values_exact(policy, gamma)
        label = f"Fresh: {ACTIONS[policy[0]]:<5} Tired: {ACTIONS[policy[1]]:<5}"
        print(f"  {label}  V(Fresh) = {v[0]:6.2f}   V(Tired) = {v[1]:6.2f}")
        if best is None or v.sum() > best_v.sum():
            best, best_v = policy, v

    q = q_values(best_v, gamma)
    print("\nthe best policy, and what each action is worth under it:")
    for s in (FRESH, TIRED):
        print(f"  {STATES[s]:<5}  Q(Study) = {q[s, STUDY]:6.2f}   Q(Rest) = {q[s, REST]:6.2f}")
    improved = greedy_policy(q)
    print("greedy with respect to those values:", [ACTIONS[a] for a in improved], "(unchanged, so it cannot be improved)")

    if fast:
        assert list(best) == [STUDY, REST] and greedy_policy(q) == list(best)
        assert np.allclose(values_exact(best, gamma), values_cramer(best, gamma))
        assert bellman_residual(best, best_v, gamma) < 1e-9
        print("ok")


if __name__ == "__main__":
    main(fast="--fast" in sys.argv)
