"""Chapter 9: gradient descent from scratch. Find the bottom of a valley by repeatedly stepping downhill.

    f(w) = (w - 3)^2        its lowest point is at w = 3, and its slope is 2 (w - 3)

The update:   w <- w - alpha * slope.   (Step against the slope, by an amount set by alpha.)

Run it:
    python gradient_descent.py            # three step sizes, and then two variables
    python gradient_descent.py --fast     # the same, checking itself (for tests)

Needs only numpy.
"""

import sys

import numpy as np


def f(w):
    return (w - 3.0) ** 2


def slope(w):
    return 2.0 * (w - 3.0)


def descend(w0, alpha, steps):
    """Returns the list of values w takes, starting at w0."""
    path = [w0]
    for _ in range(steps):
        path.append(path[-1] - alpha * slope(path[-1]))
    return path


def f2(w):
    """Two variables: a bowl whose lowest point is at (3, -1)."""
    return (w[0] - 3.0) ** 2 + 2.0 * (w[1] + 1.0) ** 2


def gradient2(w):
    """The slope with respect to each variable, one at a time (a 'partial derivative' for each)."""
    return np.array([2.0 * (w[0] - 3.0), 4.0 * (w[1] + 1.0)])


def descend2(w0, alpha, steps):
    path = [np.array(w0, dtype=float)]
    for _ in range(steps):
        path.append(path[-1] - alpha * gradient2(path[-1]))
    return path


def main(fast=False):
    for alpha in (0.1, 0.5, 0.9, 1.0, 1.1):
        path = descend(0.0, alpha, 10)
        print(f"alpha = {alpha:<3}  w after 0, 1, 2, 3, 10 steps: " + ", ".join(f"{path[k]:.3f}" for k in (0, 1, 2, 3, 10)))
    print()
    path2 = descend2([0.0, 0.0], 0.1, 50)
    print("two variables, starting at (0, 0) with alpha = 0.1:")
    for k in (0, 1, 2, 50):
        print(f"  step {k:>2}: w = ({path2[k][0]:.3f}, {path2[k][1]:.3f})   gradient = {np.round(gradient2(path2[k]), 3)}")
    if fast:
        assert abs(descend(0.0, 0.1, 100)[-1] - 3.0) < 1e-6
        assert abs(path2[-1][0] - 3.0) < 0.01 and abs(path2[-1][1] + 1.0) < 0.01
        print("ok")


if __name__ == "__main__":
    main(fast="--fast" in sys.argv)
