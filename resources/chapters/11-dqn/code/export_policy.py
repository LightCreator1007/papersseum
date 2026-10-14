"""Chapter 11: train a DQN and save its weights as a small JSON file (used by the cart-pole demo on the website).

    python export_policy.py ../../../../web/lib/learn/cartpole-policy.json

It trains with a few seeds, keeps the network that does best on fresh test episodes, rounds its weights to
5 decimals, and writes them out. The file is plain numbers: layer sizes, weights, biases.
"""

import json
import sys

import numpy as np

from cartpole import average_score
from dqn_cartpole import Network, greedy_action, train


def load(path):
    """Rebuild a network from the JSON file."""
    with open(path) as fh:
        data = json.load(fh)
    net = Network(data["layers"], np.random.default_rng(0))
    net.W = [np.array(w) for w in data["W"]]
    net.b = [np.array(b) for b in data["b"]]
    return net, data


def main(path):
    best_score, best = -1.0, None
    for seed in range(5):
        _, net = train(seed=seed, episodes=300, keep_best=True)
        score = average_score(lambda s: greedy_action(net, s), 50, seed=777)
        print(f"seed {seed}: survives {score:.1f} of 200 steps on 50 fresh test episodes")
        if score > best_score:
            best_score, best = score, net
    data = {
        "layers": [4, 64, 64, 2],
        "W": [np.round(w, 5).tolist() for w in best.W],
        "b": [np.round(b, 5).tolist() for b in best.b],
    }
    rounded, _ = None, None
    with open(path, "w") as fh:
        json.dump(data, fh, separators=(",", ":"))
    net, _ = load(path)
    final = average_score(lambda s: greedy_action(net, s), 100, seed=2024)
    print(f"saved to {path}: after rounding, survives {final:.1f} of 200 steps on 100 fresh episodes")


if __name__ == "__main__":
    main(sys.argv[1])
