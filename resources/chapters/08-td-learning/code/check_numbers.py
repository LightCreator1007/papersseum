"""Checks every number quoted in the chapter 8 lesson, so the text and the maths cannot drift apart.

    python check_numbers.py
"""

import numpy as np

from cliff_walk import greedy_route, learn
from random_walk_td import TRUE, average_curve, learn_mc, learn_td


def close(a, b, tol=1e-9):
    return abs(a - b) <= tol


def main():
    # --- The true values of the five houses (the chance of finishing on the right): 1/6 ... 5/6
    assert np.allclose(TRUE, [1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6]) and [round(x, 3) for x in TRUE] == [0.167, 0.333, 0.5, 0.667, 0.833]
    # They satisfy the Bellman equations: each house is the average of its two neighbours (with 0 and 1 beyond the ends)
    padded = np.concatenate([[0.0], TRUE, [1.0]])
    assert np.allclose(TRUE, (padded[:-2] + padded[2:]) / 2)

    # --- The hand-worked first episodes (alpha = 0.1, every house starts at 0.5): the walker goes C -> D -> E -> off the right end
    v = {"C": 0.5, "D": 0.5, "E": 0.5}
    v["C"] += 0.1 * (0 + v["D"] - v["C"])
    v["D"] += 0.1 * (0 + v["E"] - v["D"])
    v["E"] += 0.1 * (1 - v["E"])
    assert (v["C"], v["D"], round(v["E"], 3)) == (0.5, 0.5, 0.55)  # only E has moved: the reward leaks back one house per episode
    v["C"] += 0.1 * (0 + v["D"] - v["C"])
    v["D"] += 0.1 * (0 + v["E"] - v["D"])
    v["E"] += 0.1 * (1 - v["E"])
    assert (round(v["C"], 3), round(v["D"], 3), round(v["E"], 3)) == (0.5, 0.505, 0.595)
    # Monte Carlo, from the same first episode, moves all three houses at once toward the outcome 1
    assert [round(0.5 + 0.1 * (1 - 0.5), 3)] * 3 == [0.55, 0.55, 0.55]

    # --- Learning curves: average error over 300 runs (seed 0)
    td5 = average_curve(learn_td, 0.05, 300, 100)
    mc5 = average_curve(learn_mc, 0.05, 300, 100)
    td1 = average_curve(learn_td, 0.1, 300, 100)
    mc1 = average_curve(learn_mc, 0.1, 300, 100)
    assert round(td5[0], 3) == 0.236
    assert [round(td5[n], 3) for n in (5, 10, 25, 50, 100)] == [0.203, 0.175, 0.111, 0.055, 0.037]
    assert [round(mc5[n], 3) for n in (5, 10, 25, 50, 100)] == [0.201, 0.177, 0.138, 0.124, 0.119]
    assert (round(td5[25], 3), round(mc5[25], 3)) == (0.111, 0.138)
    assert (round(td5[100], 3), round(mc5[100], 3)) == (0.037, 0.119)
    assert (round(td1[100], 3), round(mc1[100], 3)) == (0.057, 0.166)
    assert td5[100] < mc5[100] and td1[100] < mc1[100]

    # --- The cliff, over 20 seeds (500 episodes, alpha 0.5, epsilon 0.1)
    online = {"q-learning": [], "sarsa": []}
    route_len = {"q-learning": [], "sarsa": []}
    for seed in range(20):
        for method in online:
            q, totals = learn(method, episodes=500, seed=seed)
            online[method].append(np.mean(totals[-100:]))
            route_len[method].append(len(greedy_route(q)) - 1)
    assert set(route_len["q-learning"]) == {9}  # always the shortest route, right along the edge
    assert set(route_len["sarsa"]) <= {11, 13} and min(route_len["sarsa"]) > 9
    assert round(float(np.mean(online["q-learning"])), 1) == -31.7
    assert round(float(np.mean(online["sarsa"])), 1) == -21.6
    # and the single run (seed 0) shown in the lesson's description
    q0, t0 = learn("q-learning", seed=0)
    s0, ts0 = learn("sarsa", seed=0)
    assert round(float(np.mean(t0[-100:])), 1) == -27.4 and round(float(np.mean(ts0[-100:])), 1) == -20.1 and len(greedy_route(s0)) - 1 == 13

    # --- Check-yourself answers
    delta = 1 + 0.9 * 3 - 2
    assert close(delta, 1.7) and close(2 + 0.5 * delta, 2.85)  # TD error and the updated value
    assert close(0.5 + 0.5 * ((-1 + 1.0 * -3) - 0.5), -1.75)  # Q-learning
    assert close(0.5 + 0.5 * ((-1 + 1.0 * -10) - 0.5), -5.25)  # SARSA when the next move is an unlucky exploratory one

    print("every number in chapter 8 checks out")


if __name__ == "__main__":
    main()
