"""Chapter 6: dynamic programming on the student's evening. Three ways to find values and the best policy.

  policy evaluation   repeat the Bellman equation as an update until the values stop changing
  policy iteration    evaluate a policy, improve it, repeat until it stops changing
  value iteration     repeat the Bellman OPTIMALITY equation as an update

    state, action      reward   next state
    Fresh, Study         3      Fresh 0.6, Tired 0.4
    Fresh, Rest          1      Fresh 0.9, Tired 0.1
    Tired, Study         0.5    Fresh 0.2, Tired 0.8
    Tired, Rest          0      Fresh 0.7, Tired 0.3

Run it:
    python dp_student.py            # print each method's progress
    python dp_student.py --fast     # the same, checking itself (for tests)

Needs only numpy.
"""

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


def backup(v, state, action, gamma):
    """One Bellman backup: the reward now plus gamma times the average value of where we land."""
    return R[state][action] + gamma * np.dot(P[state][action], v)


def evaluation_sweep(v, policy, gamma):
    """Apply the Bellman equation once to every state (using the OLD values on the right-hand side)."""
    return np.array([backup(v, s, policy[s], gamma) for s in (FRESH, TIRED)])


def policy_evaluation(policy, gamma, tol=1e-8):
    """Sweep until the values stop changing. Returns (values, history of values after each sweep)."""
    v = np.zeros(2)
    history = [v.copy()]
    while True:
        new = evaluation_sweep(v, policy, gamma)
        history.append(new.copy())
        if np.max(np.abs(new - v)) < tol:
            return new, history
        v = new


def q_table(v, gamma):
    return np.array([[backup(v, s, a, gamma) for a in (STUDY, REST)] for s in (FRESH, TIRED)])


def policy_iteration(gamma, start=(REST, REST)):
    """Evaluate, improve, repeat. Returns (best policy, list of (policy, values) after each round)."""
    policy = list(start)
    rounds = []
    while True:
        v, _ = policy_evaluation(policy, gamma)
        rounds.append((list(policy), v.copy()))
        improved = [int(np.argmax(q_table(v, gamma)[s])) for s in (FRESH, TIRED)]
        if improved == policy:
            return policy, rounds
        policy = improved


def value_iteration(gamma, tol=1e-8):
    """Repeat v <- max over actions of the backup, until the values stop changing."""
    v = np.zeros(2)
    history = [v.copy()]
    while True:
        new = np.array([max(backup(v, s, a, gamma) for a in (STUDY, REST)) for s in (FRESH, TIRED)])
        history.append(new.copy())
        if np.max(np.abs(new - v)) < tol:
            policy = [int(np.argmax(q_table(new, gamma)[s])) for s in (FRESH, TIRED)]
            return new, policy, history
        v = new


def main(fast=False):
    gamma = 0.9
    policy = [STUDY, REST]

    print("1. policy evaluation: 'study when fresh, rest when tired', sweep by sweep")
    v, history = policy_evaluation(policy, gamma)
    for k in list(range(0, 5)) + [10, 20]:
        print(f"   after {k:>2} sweeps: V(Fresh) = {history[k][0]:6.3f}   V(Tired) = {history[k][1]:6.3f}")
    print(f"   settled after {len(history) - 1} sweeps at {v[0]:.2f} and {v[1]:.2f}")

    print("\n2. policy iteration, starting from 'always rest'")
    best, rounds = policy_iteration(gamma)
    for i, (pol, vals) in enumerate(rounds):
        print(f"   round {i}: policy [{ACTIONS[pol[0]]}, {ACTIONS[pol[1]]}]  values {vals.round(2)}")
    print(f"   stopped: the policy is [{ACTIONS[best[0]]}, {ACTIONS[best[1]]}]")

    print("\n3. value iteration, starting from all zeros")
    vstar, vpol, vhist = value_iteration(gamma)
    for k in range(0, 5):
        print(f"   after {k} sweeps: V = {vhist[k].round(3)}")
    print(f"   settled after {len(vhist) - 1} sweeps at {vstar.round(2)}; best policy [{ACTIONS[vpol[0]]}, {ACTIONS[vpol[1]]}]")

    if fast:
        assert np.allclose(v, [20.09, 17.34], atol=0.006)
        assert best == [STUDY, REST] and vpol == [STUDY, REST]
        assert np.allclose(vstar, v, atol=1e-6)
        print("ok")


if __name__ == "__main__":
    main(fast="--fast" in sys.argv)
