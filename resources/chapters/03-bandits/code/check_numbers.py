"""Checks every number quoted in the chapter 3 lesson, so the text and the maths cannot drift apart.

    python check_numbers.py
"""

import math

from bandit_basics import compare


def close(a, b, tol=1e-9):
    return abs(a - b) <= tol


def main():
    # --- The average of five pulls: win, lose, win, win, lose
    rewards = [1, 0, 1, 1, 0]
    assert close(sum(rewards) / len(rewards), 0.6)

    # --- The same average kept up to date one reward at a time:  Q <- Q + (R - Q) / n
    q = 0.0
    seen = []
    for n, r in enumerate(rewards, start=1):
        q = q + (r - q) / n
        seen.append(q)
    expected = [1.0, 0.5, 2 / 3, 0.75, 0.6]
    assert all(close(a, b) for a, b in zip(seen, expected)), seen

    # --- Exploring picks each of the 5 machines with probability 1/5, so with epsilon = 0.1
    #     the best machine is pulled with probability 0.9 + 0.1 * (1/5) = 0.92
    assert close(0.9 + 0.1 * (1 / 5), 0.92)

    # --- Check-yourself answers
    assert close((1 + 0 + 0 + 1) / 4, 0.5)
    assert close(0.5 + (1 - 0.5) / 5, 0.6)
    assert close(0.8 + 0.2 * (1 / 4), 0.85)

    # --- A greedy start: after one pull each, Q = 0 for a machine that lost, so it only
    #     re-tries when every other average is also 0 (the demo calls this "stuck")
    #     Chance that a machine with win probability p loses its first pull: 1 - p
    assert close(1 - 0.8, 0.2)

    # --- UCB bonus  c * sqrt(ln t / N)  at t = 10, c = 1
    bonus_2 = math.sqrt(math.log(10) / 2)
    bonus_8 = math.sqrt(math.log(10) / 8)
    assert round(bonus_2, 2) == 1.07, bonus_2
    assert round(bonus_8, 2) == 0.54, bonus_8
    # the machine tried twice with Q = 0.50 beats the one tried 8 times with Q = 0.60
    assert 0.50 + bonus_2 > 0.60 + bonus_8

    # --- The experiment table (200 casinos, 1000 pulls each, seed 0)
    r = compare(casinos=200, steps=1000, seed=0)
    table = {
        "random": (0.51, 20),
        "greedy (epsilon = 0)": (0.60, 24),
        "epsilon = 0.01": (0.70, 52),
        "epsilon = 0.1": (0.73, 71),
        "epsilon = 0.3": (0.69, 65),
        "UCB (c = 1)": (0.72, 66),
        "best possible": (0.77, 100),
    }
    for name, (payout, share) in table.items():
        got_payout, got_share = r[name]
        assert abs(got_payout - payout) <= 0.01, (name, got_payout)
        assert abs(100 * got_share - share) <= 3, (name, got_share)
    # the claims made about the table
    assert r["epsilon = 0.1"][0] / r["best possible"][0] > 0.93  # "about 95 percent of the best possible"
    assert r["epsilon = 0.1"][0] > r["epsilon = 0.01"][0] > r["greedy (epsilon = 0)"][0] > r["random"][0]
    assert r["epsilon = 0.1"][0] > r["epsilon = 0.3"][0]  # too much exploring costs you

    print("every number in chapter 3 checks out")


if __name__ == "__main__":
    main()
