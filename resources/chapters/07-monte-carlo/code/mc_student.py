"""Chapter 7: Monte Carlo prediction. Estimate a policy's value by playing it many times and averaging the returns.

We treat the student's evening as a black box: we can play it and watch rewards, but pretend we do not
know the probabilities. The true value of "study when fresh, rest when tired" from Fresh is 20.09 (chapter 5).

Run it:
    python mc_student.py            # the experiment from the lesson
    python mc_student.py --fast     # a quick, self-checking version (for tests)

Needs only numpy.
"""

import sys

import numpy as np

FRESH, TIRED = 0, 1
STUDY, REST = 0, 1
# The hidden "rules of the world". The learner never reads these; it can only call play_step().
_P = {FRESH: {STUDY: [0.6, 0.4], REST: [0.9, 0.1]}, TIRED: {STUDY: [0.2, 0.8], REST: [0.7, 0.3]}}
_R = {FRESH: {STUDY: 3.0, REST: 1.0}, TIRED: {STUDY: 0.5, REST: 0.0}}

TRUE_VALUE_FRESH = 20.0917  # worked out exactly in chapter 5 (20.09)


def play_step(state, action, rng):
    """The black box: take an action, get back a reward and the next state."""
    return _R[state][action], int(rng.choice(2, p=_P[state][action]))


def episode_return(policy, start, gamma, steps, rng):
    """Play one episode of `steps` steps and return the discounted return, worked out backwards."""
    state, rewards = start, []
    for _ in range(steps):
        reward, state = play_step(state, policy[state], rng)
        rewards.append(reward)
    g = 0.0
    for r in reversed(rewards):
        g = r + gamma * g
    return g


def estimate(policy, start, gamma, episodes, steps, seed):
    """The Monte Carlo estimate: the average return over many episodes. Also returns the standard error."""
    rng = np.random.default_rng(seed)
    returns = np.array([episode_return(policy, start, gamma, steps, rng) for _ in range(episodes)])
    return float(returns.mean()), float(returns.std(ddof=1) / np.sqrt(episodes)), float(returns.std(ddof=1))


def main(fast=False):
    policy = [STUDY, REST]
    sizes = (10, 100, 1000) if fast else (10, 100, 1000, 10000)
    print(f"true value from Fresh: {TRUE_VALUE_FRESH:.2f}")
    print("episodes   estimate   typical error")
    out = {}
    for n in sizes:
        mean, se, sd = estimate(policy, FRESH, 0.9, n, 100, seed=0)
        out[n] = (mean, se, sd)
        print(f"{n:>8}   {mean:8.2f}   {se:8.2f}")
    print(f"(each single episode's return varies a lot: standard deviation about {out[sizes[-1]][2]:.1f})")
    if fast:
        assert abs(out[1000][0] - TRUE_VALUE_FRESH) < 1.0
        print("ok")


if __name__ == "__main__":
    main(fast="--fast" in sys.argv)
