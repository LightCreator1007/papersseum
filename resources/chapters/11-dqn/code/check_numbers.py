"""Checks every number quoted in the chapter 11 lesson, so the text and the maths cannot drift apart.

    python check_numbers.py            (takes about 90 seconds: it trains 21 networks)
"""

from pathlib import Path

import numpy as np

from cartpole import average_score
from dqn_cartpole import compare_tricks, greedy_action, train
from export_policy import load

POLICY_FILE = Path(__file__).resolve().parents[4] / "web" / "lib" / "learn" / "cartpole-policy.json"


def close(a, b, tol=1e-9):
    return abs(a - b) <= tol


def main():
    # --- A random agent survives about 23 steps
    coin = np.random.default_rng(0)
    random_score = average_score(lambda s: int(coin.integers(2)), 200, seed=1)
    assert 22 <= random_score < 24 and round(random_score) == 23, random_score

    # --- One DQN run (seed 0, 300 episodes): average steps survived in each block of 25 training episodes
    lengths, net = train(seed=0, episodes=300)
    blocks = [round(float(np.mean(lengths[i : i + 25])), 1) for i in range(0, 300, 25)]
    assert blocks == [20.8, 17.4, 63.1, 171.8, 160.1, 136.9, 149.5, 138.3, 178.2, 195.6, 192.6, 192.4], blocks
    assert round(average_score(lambda st: greedy_action(net, st), 20, seed=123)) == 198  # with no exploring

    # --- The two tricks, over 5 seeds: the average steps survived over the last 50 training episodes
    tricks = {name: [round(s) for s in scores] for name, scores in compare_tricks().items()}
    assert tricks["both tricks"] == [193, 200, 194, 191, 134], tricks
    assert tricks["no target network"] == [193, 191, 157, 157, 164], tricks
    assert tricks["no replay buffer"] == [110, 102, 114, 107, 142], tricks
    assert tricks["neither"] == [145, 75, 191, 163, 10], tricks
    means = {name: round(float(np.mean(v))) for name, v in tricks.items()}
    assert means == {"both tricks": 182, "no target network": 172, "no replay buffer": 115, "neither": 117}, means

    # --- The target in the lesson's worked example: reward 1, gamma 0.99, best Q in the next state 11
    target = 1 + 0.99 * 11
    assert close(target, 11.89) and round(11.89 - 12, 2) == -0.11

    # --- The network saved for the website demo still balances the pole for the full 200 steps
    served, data = load(POLICY_FILE)
    assert data["layers"] == [4, 64, 64, 2]
    assert sum(w.size for w in served.W) + sum(b.size for b in served.b) == 4610 == (4 * 64 + 64) + (64 * 64 + 64) + (64 * 2 + 2)
    assert average_score(lambda st: greedy_action(served, st), 100, seed=2024) == 200.0

    print("every number in chapter 11 checks out")


if __name__ == "__main__":
    main()
