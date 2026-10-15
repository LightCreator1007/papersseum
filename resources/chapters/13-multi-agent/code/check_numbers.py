"""Checks every number quoted in the chapter 13 lesson, so the text and the maths cannot drift apart.

    python check_numbers.py
"""

import numpy as np

from elo import accuracy, expected_score, update
from rps_selfplay import BIASED_OPPONENT, PAYOFF, both_learning, versus_biased


def close(a, b, tol=1e-9):
    return abs(a - b) <= tol


def main():
    # --- Rock-paper-scissors: what each move earns against a bot that plays rock half the time, and against fair play
    assert list(PAYOFF @ BIASED_OPPONENT) == [0.0, 0.25, -0.25]  # rock 0, paper +0.25, scissors -0.25
    uniform = np.full(3, 1 / 3)
    for strategy in (np.array([1.0, 0, 0]), np.array([0, 1.0, 0]), np.array([0.5, 0.25, 0.25])):
        assert close(float(strategy @ PAYOFF @ uniform), 0.0)  # nothing beats a player who mixes evenly: nobody can be exploited
    assert close(float(uniform @ PAYOFF @ uniform), 0.0)

    # --- A learner against that rock-heavy bot finds "paper" (10 runs)
    finals = versus_biased(10)
    assert all(f > 0.95 for f in finals) and round(min(finals), 2) == 0.98 and round(max(finals), 2) == 0.99, finals

    # --- Two learners against each other (10 runs): they keep swinging, but their long-run averages sit near one third
    runs = both_learning(10)
    swings = [hi - lo for lo, hi, _ in runs]
    assert all(s > 0.3 for s in swings), swings
    assert round(min(lo for lo, _, _ in runs), 2) == 0.02 and round(max(hi for _, hi, _ in runs), 2) == 0.96
    worst = max(float(np.abs(avg - 1 / 3).max()) for _, _, avg in runs)
    assert round(worst, 2) == 0.04, worst
    assert all(np.abs(avg - 1 / 3).max() < 0.04 for _, _, avg in runs)

    # --- Elo: the worked example. A (1000) against B (1200), K = 32
    e = expected_score(1000, 1200)
    assert round(e, 4) == 0.2403 and round(expected_score(1200, 1000), 4) == 0.7597 and close(e + expected_score(1200, 1000), 1.0)
    assert round(10 ** 0.5, 3) == 3.162 and round(1 / (1 + 10**0.5), 4) == 0.2403
    win = update(1000, 1200, 1.0)
    lose = update(1000, 1200, 0.0)
    assert (round(win[0], 2), round(win[1], 2)) == (1024.31, 1175.69)
    assert (round(lose[0], 2), round(lose[1], 2)) == (992.31, 1207.69)
    assert close(win[0] - 1000 + win[1] - 1200, 0.0) and close(lose[0] - 1000 + lose[1] - 1200, 0.0)  # points move, none are created
    assert round(32 * (1 - e), 1) == 24.3 and round(32 * e, 1) == 7.7

    # --- How often the favourite wins, by rating gap
    assert [round(expected_score(g, 0), 3) for g in (0, 100, 200, 400, 800)] == [0.5, 0.64, 0.76, 0.909, 0.99]

    # --- Elo ratings finding the true order (4 players at 1000, 1100, 1200, 1400; K = 16; 30 simulations)
    results = {games: accuracy(games) for games in (100, 500, 2000, 10000)}
    assert {g: (round(err), n) for g, (err, n) in results.items()} == {100: (96, 25), 500: (48, 28), 2000: (42, 28), 10000: (41, 28)}, results

    # --- Check-yourself answers: a 1400 player against a 1000 player, K = 32
    fav = expected_score(1400, 1000)
    assert round(fav, 3) == 0.909 and round(32 * (1 - fav), 1) == 2.9 and round(32 * (0 - fav), 1) == -29.1

    print("every number in chapter 13 checks out")


if __name__ == "__main__":
    main()
