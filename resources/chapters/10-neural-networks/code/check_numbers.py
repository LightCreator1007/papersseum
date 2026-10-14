"""Checks every number quoted in the chapter 10 lesson, so the text and the maths cannot drift apart.

    python check_numbers.py
"""

import math

import numpy as np

from mlp import XOR_X, gradient_check, learn_sine, learn_xor


def close(a, b, tol=1e-9):
    return abs(a - b) <= tol


def relu(z):
    return np.maximum(z, 0)


def main():
    # --- One neuron: inputs [1, 2], weights [0.5, -1], bias 0.25
    z = 0.5 * 1 + (-1) * 2 + 0.25
    assert close(z, -1.25)
    assert relu(z) == 0
    assert round(1 / (1 + math.exp(1.25)), 4) == 0.2227  # sigmoid(-1.25)
    assert round(math.tanh(-1.25), 4) == -0.8483

    # --- Two layers with no bend collapse into one:  W2 (W1 x) = (W2 W1) x
    w1 = np.array([[1, 2], [3, 4]])
    w2 = np.array([[1, 1]])
    x = np.array([1, 1])
    assert list(w2 @ (w1 @ x)) == [10] and list((w2 @ w1) @ x) == [10]
    assert list((w2 @ w1).ravel()) == [4, 6]  # the same as one layer with weights [4, 6]

    # --- A forward pass through a 2-2-1 network with ReLU:  x = [1, 0.5]
    x = np.array([1.0, 0.5])
    w1 = np.array([[0.2, 0.4], [-0.5, 0.3]])  # rows = inputs, columns = hidden neurons
    b1 = np.array([0.0, 0.1])
    h = relu(x @ w1 + b1)
    assert np.allclose(x @ w1 + b1, [-0.05, 0.65]) and np.allclose(h, [0.0, 0.65])
    y = h @ np.array([1.0, 2.0]) + 0.5
    assert close(y, 1.8)

    # --- Backpropagation by hand:  x = 2, w1 = 0.5, w2 = 3, target 4, ReLU hidden neuron, loss = (y - t)^2 / 2
    x_, w1_, w2_, t = 2.0, 0.5, 3.0, 4.0
    z_ = w1_ * x_
    h_ = max(z_, 0.0)
    y_ = w2_ * h_
    loss = 0.5 * (y_ - t) ** 2
    assert (z_, h_, y_, loss) == (1.0, 1.0, 3.0, 0.5)
    d_y = y_ - t  # -1
    d_w2 = d_y * h_  # -1
    d_h = d_y * w2_  # -3
    d_z = d_h * (1.0 if z_ > 0 else 0.0)  # -3
    d_w1 = d_z * x_  # -6
    assert (d_y, d_w2, d_h, d_z, d_w1) == (-1.0, -1.0, -3.0, -3.0, -6.0)
    # brute-force check of those slopes
    def L(a, b):
        return 0.5 * (b * max(a * x_, 0.0) - t) ** 2
    e = 1e-6
    assert abs((L(w1_ + e, w2_) - L(w1_ - e, w2_)) / (2 * e) - (-6)) < 1e-4
    assert abs((L(w1_, w2_ + e) - L(w1_, w2_ - e)) / (2 * e) - (-1)) < 1e-4
    # one gradient step with a small step size (0.01) lowers the loss; a big one (0.1) overshoots and raises it
    assert (round(w1_ - 0.01 * d_w1, 3), round(w2_ - 0.01 * d_w2, 3)) == (0.56, 3.01)
    assert round(L(w1_ - 0.01 * d_w1, w2_ - 0.01 * d_w2), 3) == 0.198
    assert (round(w1_ - 0.1 * d_w1, 3), round(w2_ - 0.1 * d_w2, 3)) == (1.1, 3.1)
    assert round(L(w1_ - 0.1 * d_w1, w2_ - 0.1 * d_w2), 2) == 3.98 and L(1.1, 3.1) > loss

    # --- The gradient check: backpropagation agrees with brute-force slopes to better than one part in a million
    worst = gradient_check()
    assert worst < 1e-6, worst   # the exact size is rounding noise and differs between machines

    # --- XOR: one hidden neuron cannot do it (it settles on the best constant guess, 0.5); two or four can
    net1, l1 = learn_xor(1, steps=3000)
    assert round(l1[-1], 4) == 0.25 and np.allclose(net1.forward(XOR_X), 0.5, atol=1e-3)
    for hidden in (2, 4):
        net, losses = learn_xor(hidden, steps=3000)
        assert losses[-1] < 1e-4, (hidden, losses[-1])
        assert np.allclose(net.forward(XOR_X).ravel(), [0, 1, 1, 0], atol=0.02)
    assert close(0.5**2, 0.25)  # always answering 0.5 is wrong by 0.5 on every example, so the mean squared error is 0.25

    # --- A sine curve with 16 hidden neurons (seed 0, 6000 steps)
    net, losses, _, _ = learn_sine(steps=6000)
    assert round(losses[0], 3) == 0.127 and round(losses[-1], 5) == 0.00218

    # --- Check-yourself answers
    zq = 2 * 1 + (-1) * 3 + 0.5
    assert close(zq, -0.5) and relu(zq) == 0
    assert 3 * 4 == 12  # a layer that multiplies by 3 followed by one that multiplies by 4, with no bend, is one layer that multiplies by 12
    xq, w1q, w2q, tq = 1.0, 2.0, 0.5, 0.0
    hq = max(w1q * xq, 0.0)
    yq = w2q * hq
    assert (hq, yq, 0.5 * (yq - tq) ** 2) == (2.0, 1.0, 0.5)
    d_yq = yq - tq
    d_w2q = d_yq * hq
    d_w1q = d_yq * w2q * 1.0 * xq
    assert (d_yq, d_w2q, d_w1q) == (1.0, 2.0, 0.5)

    print("every number in chapter 10 checks out")


if __name__ == "__main__":
    main()
