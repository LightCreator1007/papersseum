"""Chapter 4: a small Markov decision process, "the student's evening", and how to measure returns.

The student is either FRESH or TIRED, and each evening step chooses to STUDY or REST.

    state, action      reward   next state
    Fresh, Study         3      Fresh 0.6, Tired 0.4
    Fresh, Rest          1      Fresh 0.9, Tired 0.1
    Tired, Study         0.5    Fresh 0.2, Tired 0.8
    Tired, Rest          0      Fresh 0.7, Tired 0.3

Run it:
    python student_mdp.py            # simulate evenings and measure the return
    python student_mdp.py --fast     # a quick, self-checking version (for tests)

Needs only numpy.
"""

import sys

import numpy as np

FRESH, TIRED = 0, 1
STUDY, REST = 0, 1
STATE_NAMES = ["Fresh", "Tired"]
ACTION_NAMES = ["Study", "Rest"]

# TRANSITIONS[state][action] = probabilities of the next state [Fresh, Tired]
TRANSITIONS = {
    FRESH: {STUDY: [0.6, 0.4], REST: [0.9, 0.1]},
    TIRED: {STUDY: [0.2, 0.8], REST: [0.7, 0.3]},
}
# REWARDS[state][action] = the reward for taking that action in that state
REWARDS = {
    FRESH: {STUDY: 3.0, REST: 1.0},
    TIRED: {STUDY: 0.5, REST: 0.0},
}


def discounted_return(rewards, gamma):
    """G = r_1 + gamma * r_2 + gamma^2 * r_3 + ...   (adds the rewards, each one discounted)."""
    return sum(r * gamma**k for k, r in enumerate(rewards))


def return_backwards(rewards, gamma):
    """The same return, worked out from the end using G_t = r_(t+1) + gamma * G_(t+1)."""
    g = 0.0
    for r in reversed(rewards):
        g = r + gamma * g
    return g


def step(state, action, rng):
    """Take one action: returns (reward, next_state)."""
    reward = REWARDS[state][action]
    nxt = int(rng.choice(2, p=TRANSITIONS[state][action]))
    return reward, nxt


def run_episode(policy, start, steps, rng):
    """Follow a policy (a list: the action to take in each state) for some steps; returns the list of rewards."""
    state, rewards = start, []
    for _ in range(steps):
        reward, state = step(state, policy[state], rng)
        rewards.append(reward)
    return rewards


def average_return(policy, start, gamma, episodes, steps, seed):
    rng = np.random.default_rng(seed)
    return float(np.mean([discounted_return(run_episode(policy, start, steps, rng), gamma) for _ in range(episodes)]))


def main(fast=False):
    gamma = 0.9
    episodes = 400 if fast else 4000
    policies = {
        "always study": [STUDY, STUDY],
        "study when fresh, rest when tired": [STUDY, REST],
        "always rest": [REST, REST],
    }
    print(f"average discounted return from Fresh (gamma = {gamma}, {episodes} evenings of 100 steps):")
    results = {}
    for name, policy in policies.items():
        results[name] = average_return(policy, FRESH, gamma, episodes, 100, seed=0)
        print(f"  {name:<36} {results[name]:6.2f}")
    if fast:
        best = max(results, key=results.get)
        assert best == "study when fresh, rest when tired", results
        print("ok")


if __name__ == "__main__":
    main(fast="--fast" in sys.argv)
