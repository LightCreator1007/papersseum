"""A neural-network agent in a single file: weights embedded, numpy forward pass.

How to use a network you trained elsewhere (PyTorch, JAX, anything):

  1. Export its weights as a state dict (.pt) or arrays (.npz).
        torch.save(model.state_dict(), "model.pt")
  2. Embed them in this file (replaces the WEIGHTS line below):
        papersseum pack model.pt --into nn_agent.py            # float16, about half the size
        papersseum pack model.pt --into nn_agent.py --dtype int8   # smallest
  3. Make forward() below mirror your model, layer for layer, using papersseum.nn.
  4. papersseum validate nn_agent.py     # the platform's upload check, run locally

Submit just this .py file (max 1 MB, so roughly 350k float16 weights or 700k int8).
With WEIGHTS empty, this file runs a small randomly initialised network, which is
enough to check the plumbing.
"""

import numpy as np

from papersseum import nn, unpack_weights

WEIGHTS = ""


def init_random(rng):
    """Stand-in weights with the same names and shapes as a trained model."""
    def w(*shape):
        return (rng.normal(size=shape) * 0.1).astype(np.float32)
    return {"conv1.weight": w(16, 16, 3, 3), "conv1.bias": w(16),
            "conv2.weight": w(32, 16, 3, 3), "conv2.bias": w(32),
            "fc.weight": w(3, 32), "fc.bias": w(3)}


class Agent:
    def reset(self, config):
        # Heavy work belongs here (2 s allowed), not in act() (50 ms per decision).
        if WEIGHTS:
            self.W = unpack_weights(WEIGHTS)
        else:
            self.W = init_random(np.random.default_rng(config["seed"] * 1000 + config["pid"]))

    def forward(self, local):
        """local: (16, 31, 31) view centred on your head, rotated so you face up."""
        W = self.W
        h = nn.relu(nn.conv2d(local, W["conv1.weight"], W["conv1.bias"], padding=1))
        h = nn.relu(nn.conv2d(h, W["conv2.weight"], W["conv2.bias"], stride=2, padding=1))
        return nn.linear(nn.global_avg_pool(h), W["fc.weight"], W["fc.bias"])

    def act(self, obs):
        logits = self.forward(obs["local"])
        return int(np.argmax(logits))       # 0 straight, 1 left, 2 right
