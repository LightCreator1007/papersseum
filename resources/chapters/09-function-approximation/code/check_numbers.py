"""Checks every number quoted in the chapter 9 lesson, so the text and the maths cannot drift apart.

    python check_numbers.py
"""

import math

import numpy as np

from gradient_descent import descend, descend2, gradient2
from linear_td import best_possible_error, learn, true_values


def close(a, b, tol=1e-9):
    return abs(a - b) <= tol


def main():
    # --- How many boards? Papersseum has 11,304 playable cells, each owned by one of 5 players or no one (6 possibilities).
    #     That is 6^11304 ownership layouts, about 10^8796 (a loose count: it ignores trails and heads).
    assert 11_304 * math.log10(6) > 8796 and int(11_304 * math.log10(6)) == 8796
    assert 80 < 8796  # the number of atoms in the observable universe is about 10^80

    # --- Gradient descent on f(w) = (w - 3)^2, starting at 0:  w_k = 3 - 3 (1 - 2 alpha)^k
    for alpha in (0.1, 0.5, 0.9, 1.0, 1.1):
        path = descend(0.0, alpha, 10)
        for k, w in enumerate(path):
            assert close(w, 3 - 3 * (1 - 2 * alpha) ** k, 1e-9), (alpha, k)
    p = descend(0.0, 0.1, 10)
    assert [round(p[k], 3) for k in (1, 2, 3, 4, 10)] == [0.6, 1.08, 1.464, 1.771, 2.678]
    assert close(1 - 2 * 0.1, 0.8) and round(0.8**10, 5) == 0.10737 and round(3 - 3 * 0.8**10, 3) == 2.678
    assert [round(x, 3) for x in descend(0.0, 0.5, 3)] == [0.0, 3.0, 3.0, 3.0]  # alpha 0.5: straight to the bottom
    assert [round(x, 3) for x in descend(0.0, 0.9, 3)] == [0.0, 5.4, 1.08, 4.536]  # alpha 0.9: overshoots, then settles
    assert [round(x, 3) for x in descend(0.0, 1.0, 4)] == [0.0, 6.0, 0.0, 6.0, 0.0]  # alpha 1.0: bounces forever
    d = descend(0.0, 1.1, 10)
    assert abs(d[10] - 3) > abs(d[0] - 3) and round(d[10], 2) == -15.58  # alpha 1.1: blows up
    assert round(abs(1 - 2 * 1.1), 1) == 1.2 and round(3 * 1.2**10, 1) == 18.6  # the distance from 3 grows by 1.2x each step
    assert abs(descend(0.0, 0.1, 100)[-1] - 3) < 1e-9

    # --- Two variables:  f = (w1 - 3)^2 + 2 (w2 + 1)^2.  At (0, 0) the slopes (one variable at a time) are -6 and 4
    assert np.allclose(gradient2(np.array([0.0, 0.0])), [-6, 4])
    path2 = descend2([0.0, 0.0], 0.1, 50)
    assert np.allclose(path2[1], [0.6, -0.4]) and np.allclose(path2[2], [1.08, -0.64]) and np.allclose(path2[50], [3, -1], atol=1e-3)
    # the slope really is what the formula says (checked by nudging each variable a tiny bit)
    f2 = lambda w: (w[0] - 3.0) ** 2 + 2.0 * (w[1] + 1.0) ** 2
    h = 1e-6
    num = [(f2([h, 0]) - f2([-h, 0])) / (2 * h), (f2([0, h]) - f2([0, -h])) / (2 * h)]
    assert np.allclose(num, [-6, 4], atol=1e-4)

    # --- The tiny update for a linear formula: x = [1, 0.5], weights [0, 0], target 1, alpha 0.1
    w = np.zeros(2)
    x = np.array([1.0, 0.5])
    w = w + 0.1 * (1.0 - w @ x) * x
    assert np.allclose(w, [0.1, 0.05]) and close(w @ x, 0.125)

    # --- The 1,000-position walk
    truth = true_values()
    assert round(truth[0], 3) == -0.922 and round(truth[500], 3) == 0.001 and round(truth[999], 3) == 0.922
    assert round(best_possible_error("line", truth), 3) == 0.003  # the true values are almost exactly a straight line
    assert round(best_possible_error("groups", truth), 3) == 0.053
    cps = (100, 300, 1000, 3000)
    settings = {"table": 0.1, "groups": 0.01, "line": 0.01}
    mean = {}
    for kind, alpha in settings.items():
        runs = [learn(kind, 3000, alpha, seed=s, checkpoints=cps, truth=truth)[1] for s in range(5)]
        mean[kind] = {c: round(float(np.mean([r[c] for r in runs])), 3) for c in cps}
    assert mean["table"] == {100: 0.529, 300: 0.501, 1000: 0.412, 3000: 0.224}, mean["table"]
    assert mean["groups"] == {100: 0.414, 300: 0.25, 1000: 0.118, 3000: 0.131}, mean["groups"]
    assert mean["line"] == {100: 0.458, 300: 0.311, 1000: 0.131, 3000: 0.049}, mean["line"]
    assert mean["line"][1000] < mean["table"][3000]  # two weights at 1,000 episodes beat a 1,000-entry table at 3,000

    # --- Check-yourself answers
    assert [round(x, 3) for x in descend(0.0, 0.25, 2)] == [0.0, 1.5, 2.25] and close(1 - 2 * 0.25, 0.5)
    assert np.allclose(gradient2(np.array([1.0, 1.0])), [-4, 8])
    wv = np.array([0.5, 0.25])
    xv = np.array([1.0, 2.0])
    assert close(wv @ xv, 1.0)
    assert np.allclose(wv + 0.1 * (2.0 - wv @ xv) * xv, [0.6, 0.45])

    print("every number in chapter 9 checks out")


if __name__ == "__main__":
    main()
