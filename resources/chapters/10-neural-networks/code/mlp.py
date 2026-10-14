"""Chapter 10: a neural network from scratch, in plain numpy.

A "multi-layer perceptron": layers of weighted sums with a bend (an activation) in between. This file has
  * the forward pass (inputs in, prediction out)
  * backpropagation (the chain rule, applied layer by layer, working out how to change every weight)
  * a gradient check (compare backpropagation with brute-force slopes, to prove it is right)
  * two experiments: learning XOR, and learning a sine curve

Run it:
    python mlp.py            # check the gradients, learn XOR, learn a sine curve
    python mlp.py --fast     # the same, checking itself (for tests)

Needs only numpy.
"""

import sys

import numpy as np


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-z))


class MLP:
    """layers is a list of sizes, e.g. [2, 4, 1] = 2 inputs, a hidden layer of 4, 1 output.
    Hidden layers use tanh (a smooth bend between -1 and 1). The output is left as it is ("linear")."""

    def __init__(self, layers, rng):
        # small random starting weights; a different start for every neuron, so they learn different things
        self.W = [rng.normal(0, 1.0 / np.sqrt(a), size=(a, b)) for a, b in zip(layers[:-1], layers[1:])]
        self.b = [np.zeros(b) for b in layers[1:]]

    def forward(self, x):
        """x has one row per example. Remembers what each layer produced, for the backward pass."""
        self.inputs = [x]
        for i, (w, b) in enumerate(zip(self.W, self.b)):
            z = x @ w + b  # weighted sums (a matrix times a vector, as in chapter 1)
            x = np.tanh(z) if i < len(self.W) - 1 else z
            self.inputs.append(x)
        return x

    def backward(self, d_out):
        """Backpropagation. d_out is the slope of the loss with respect to the network's output.
        Returns the slope of the loss with respect to every weight and bias.

        Each layer does the same two things, working from the end back to the start:
          1. slope for this layer's weights = (what went in) x (slope arriving from the layer after)
          2. pass a slope back to the layer before: multiply by the weights, then by the slope of the bend
        """
        grads_w, grads_b = [], []
        delta = d_out
        for i in reversed(range(len(self.W))):
            a_in = self.inputs[i]
            grads_w.insert(0, a_in.T @ delta)
            grads_b.insert(0, delta.sum(axis=0))
            if i > 0:
                delta = (delta @ self.W[i].T) * (1 - self.inputs[i] ** 2)  # tanh'(z) = 1 - tanh(z)^2
        return grads_w, grads_b

    def step(self, grads_w, grads_b, lr):
        """Gradient descent, as in chapter 9: move every weight a little against its slope."""
        for w, gw in zip(self.W, grads_w):
            w -= lr * gw
        for b, gb in zip(self.b, grads_b):
            b -= lr * gb


def mse_loss(pred, target):
    """Mean squared error, and its slope with respect to the predictions."""
    diff = pred - target
    return float(np.mean(diff**2)), 2 * diff / diff.size


def gradient_check(seed=0):
    """Compare backpropagation's slopes with brute-force slopes (nudge one weight, see how the loss changes).
    Returns the biggest relative difference. It should be tiny."""
    rng = np.random.default_rng(seed)
    net = MLP([3, 5, 4, 2], rng)
    x = rng.normal(size=(6, 3))
    target = rng.normal(size=(6, 2))

    loss, d = mse_loss(net.forward(x), target)
    grads_w, grads_b = net.backward(d)

    worst = 0.0
    h = 1e-6
    for params, grads in ((net.W, grads_w), (net.b, grads_b)):
        for p, g in zip(params, grads):
            for idx in np.ndindex(p.shape):
                old = p[idx]
                p[idx] = old + h
                up, _ = mse_loss(net.forward(x), target)
                p[idx] = old - h
                down, _ = mse_loss(net.forward(x), target)
                p[idx] = old
                numeric = (up - down) / (2 * h)
                worst = max(worst, abs(numeric - g[idx]) / max(1e-8, abs(numeric) + abs(g[idx])))
    return worst


def train(net, x, y, steps, lr):
    """Full-batch gradient descent. Returns the loss after every step."""
    losses = []
    for _ in range(steps):
        loss, d = mse_loss(net.forward(x), y)
        net.step(*net.backward(d), lr)
        losses.append(loss)
    return losses


XOR_X = np.array([[0.0, 0.0], [0.0, 1.0], [1.0, 0.0], [1.0, 1.0]])
XOR_Y = np.array([[0.0], [1.0], [1.0], [0.0]])


def learn_xor(hidden, seed=0, steps=3000, lr=0.3):
    net = MLP([2, hidden, 1], np.random.default_rng(seed))
    losses = train(net, XOR_X, XOR_Y, steps, lr)
    return net, losses


def learn_sine(hidden=16, seed=0, steps=6000, lr=0.05):
    rng = np.random.default_rng(seed)
    x = np.linspace(-np.pi, np.pi, 60).reshape(-1, 1)
    y = np.sin(x)
    net = MLP([1, hidden, 1], rng)
    losses = train(net, x, y, steps, lr)
    return net, losses, x, y


def main(fast=False):
    print(f"gradient check: biggest relative difference between backpropagation and brute force = {gradient_check():.2e}")

    print("\nXOR (the output should be 0, 1, 1, 0):")
    for hidden in (1, 2, 4):
        net, losses = learn_xor(hidden, steps=1000 if fast else 3000)
        pred = net.forward(XOR_X).ravel()
        print(f"  {hidden} hidden neurons: final loss {losses[-1]:.4f}, outputs {np.round(pred, 2)}")

    print("\nlearning a sine curve with 16 hidden neurons:")
    net, losses, x, y = learn_sine(steps=2000 if fast else 6000)
    print(f"  loss at step 1: {losses[0]:.3f}, final: {losses[-1]:.5f}")
    if fast:
        assert gradient_check() < 1e-6
        net4, l4 = learn_xor(4, steps=1000)
        assert l4[-1] < 0.05
        assert losses[-1] < losses[0] / 10
        print("ok")


if __name__ == "__main__":
    main(fast="--fast" in sys.argv)
