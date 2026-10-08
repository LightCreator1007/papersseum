import pytest

from papersseum_worker.ratings import new_ratings


def scores(order):
    """Engine-style scores where `order` lists pids best-first."""
    return [
        {"pid": pid, "coverage": 40.0 - 8 * rank, "time_avg_coverage": 20.0 - rank, "deaths": rank}
        for rank, pid in enumerate(order)
    ]


def seats(elos, games=0):
    return [(slot, f"bot{slot}", elo, games) for slot, elo in enumerate(elos)]


def test_winner_gains_and_last_place_loses():
    after, _ = new_ratings(seats([1000] * 5), scores([2, 0, 1, 3, 4]))
    assert after[2] > 1000
    assert after[4] < 1000
    assert after[2] > after[0] > after[1] > after[3] > after[4]


def test_rating_changes_sum_to_zero():
    after, _ = new_ratings(seats([1000, 1100, 950, 1200, 1000], games=7), scores([0, 1, 2, 3, 4]))
    before = [1000, 1100, 950, 1200, 1000]
    assert sum(after[s] - before[s] for s in range(5)) == pytest.approx(0, abs=1e-9)


def test_beating_a_weaker_field_earns_less():
    strong_win, _ = new_ratings(seats([1400, 1000, 1000, 1000, 1000]), scores([0, 1, 2, 3, 4]))
    even_win, _ = new_ratings(seats([1000] * 5), scores([0, 1, 2, 3, 4]))
    assert strong_win[0] - 1400 < even_win[0] - 1000


def test_blended_score_rewards_placement():
    _, blended = new_ratings(seats([1000] * 5), scores([3, 1, 4, 0, 2]))
    assert blended[3] > blended[1] > blended[4] > blended[0] > blended[2]
