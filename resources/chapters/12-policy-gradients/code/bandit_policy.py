"""Chapter 12: the idea behind policy gradients, on the smallest possible problem: choosing between three slot machines.

The policy is a set of three scores (called logits). Turning scores into probabilities with the softmax:
    probability of machine a  =  e^(score a) / (e^(score 1) + e^(score 2) + e^(score 3))

After each pull we nudge the scores so that machines which paid well become more likely:
    score_k  <-  score_k  +  alpha * (reward - baseline) * ( [k was pulled] - probability of k )

That last bracket is the slope of  ln(probability of the pulled machine)  with respect to score k.

Run it:
    python bandit_policy.py            # learn, with and without a baseline
    python bandit_policy.py --fast     # a quick, self-checking version (for tests)

Needs only numpy.
"""

import sys

import numpy as np

CHANCES = np.array([0.2, 0.5, 0.8])  # each machine's chance of paying 1 coin (the learner does not know these)


def softmax(scores):
    e = np.exp(scores - scores.max())
    return e / e.sum()


def grad_log_prob(scores, action):
    """The slope of ln(probability of `action`) with respect to each score: one-hot(action) - probabilities."""
    g = -softmax(scores)
    g[action] += 1.0
    return g


def learn(pulls, alpha, use_baseline, seed, shift=0.0):
    """Returns the final scores. The baseline is the running average reward so far.
    `shift` is added to every reward (as if each machine also paid a fixed bonus): it changes nothing about which
    machine is best, but it makes every reward look 'good'."""
    rng = np.random.default_rng(seed)
    scores = np.zeros(3)
    average = 0.0
    for n in range(1, pulls + 1):
        probs = softmax(scores)
        action = int(rng.choice(3, p=probs))
        reward = (1.0 if rng.random() < CHANCES[action] else 0.0) + shift
        baseline = average if use_baseline else 0.0
        scores += alpha * (reward - baseline) * grad_log_prob(scores, action)
        average += (reward - average) / n  # running average of the rewards (chapter 3's update)
    return scores


def experiment(shift, use_baseline, runs, pulls=300, alpha=0.1):
    """Many runs. Returns (average probability of the best machine, share of runs above 0.8, share of runs below 0.5)."""
    probs = np.array([softmax(learn(pulls, alpha, use_baseline, seed, shift))[2] for seed in range(runs)])
    return float(probs.mean()), float(np.mean(probs > 0.8)), float(np.mean(probs < 0.5))


def main(fast=False):
    runs = 60 if fast else 200
    print(f"{runs} runs of 300 pulls each; the best machine is the third (chance 0.8). Every reward is shifted by a fixed bonus.")
    print("bonus   baseline   avg probability of best   runs above 0.8   runs below 0.5")
    out = {}
    for shift in (0.0, 10.0):
        for use_baseline in (False, True):
            mean, high, low = experiment(shift, use_baseline, runs)
            out[(shift, use_baseline)] = (mean, high, low)
            print(f"{shift:>5}   {'yes' if use_baseline else 'no ':<8}   {mean:>22.2f}   {100 * high:>13.0f}%   {100 * low:>13.0f}%")
    if fast:
        assert out[(10.0, True)][0] > out[(10.0, False)][0] + 0.2
        assert abs(out[(10.0, True)][0] - out[(0.0, True)][0]) < 0.08  # the baseline makes the bonus irrelevant
        print("ok")


if __name__ == "__main__":
    main(fast="--fast" in sys.argv)
