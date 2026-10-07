import numpy as np
import papersseum.rating as R


def _scores(cov, deaths=None):
    deaths = deaths or [0] * len(cov)
    return [{"pid": i, "coverage": cov[i], "time_avg_coverage": cov[i],
             "deaths": deaths[i], "alive": cov[i] > 0} for i in range(len(cov))]


def test_match_scores_blend_orders_by_placement_then_margin():
    s = _scores([30.0, 28.0, 10.0, 3.0, 0.0])
    ms = R.match_scores(s)
    # winner highest, dead agent lowest, order preserved
    order = sorted(ms, key=lambda p: -ms[p])
    assert order == [0, 1, 2, 3, 4]
    # margin counts: 1st (30 + 8) beats 2nd (28 + 6) by more than the raw 2% gap
    assert (ms[0] - ms[1]) > 2.0


def test_placements_use_tiebreaks():
    s = _scores([10.0, 10.0], deaths=[2, 1])
    assert R.placements_from_scores(s) == [1, 0]   # equal coverage, fewer deaths wins


def test_ladder_winner_rises_and_sigma_shrinks():
    lad = R.Ladder()
    s0 = lad.sigma(0) if 0 in lad.games else R.SIGMA_START
    for _ in range(10):
        lad.update_match({0: 40.0, 1: 20.0, 2: 5.0})
    assert lad.elo[0] > lad.elo[1] > lad.elo[2]
    assert lad.sigma(0) < R.SIGMA_START            # uncertainty drops with games
    st = lad.standings()
    assert st[0]["id"] == 0 and st[0]["rank"] == 1


def test_ladder_lively_from_first_game():
    lad = R.Ladder()
    lad.update_match({0: 40.0, 1: 0.0})
    # both appear immediately after one game
    ids = {r["id"] for r in lad.standings()}
    assert ids == {0, 1}
    assert lad.standings()[0]["id"] == 0


def test_batch_plackett_luce_recovers_true_order():
    # player 0 always beats 1 beats 2 beats 3 beats 4
    rankings = [[0, 1, 2, 3, 4]] * 20
    order, gamma = R.batch_ranking(rankings, 5)
    assert order == [0, 1, 2, 3, 4]
    assert gamma[0] > gamma[1] > gamma[2] > gamma[3] > gamma[4]


def test_batch_plackett_luce_pairwise_is_bradley_terry():
    # 0 beats 1 in 9 of 10 head-to-heads -> 0 stronger
    rankings = [[0, 1]] * 9 + [[1, 0]]
    _, gamma = R.batch_ranking(rankings, 2)
    assert gamma[0] > gamma[1]


def test_batch_handles_partial_and_mixed_rankings():
    rankings = [[0, 1, 2], [2, 0], [0, 1], [1, 2]]
    order, gamma = R.batch_ranking(rankings, 3)
    assert len(order) == 3 and abs(gamma.sum() - 3.0) < 1e-6


def test_elo_update_pure_and_final_ranking():
    from papersseum.rating import elo_update, final_ranking, ELO_START
    scores = [{"pid": i, "coverage": 40.0 - 10 * i, "time_avg_coverage": 1.0, "deaths": 0}
              for i in range(5)]
    cur = {"a": (1000.0, 3)}
    new = elo_update(cur, scores, ["a", "b", "c", "d", "e"])
    assert cur == {"a": (1000.0, 3)}                       # input untouched
    assert new["a"][1] == 4 and new["b"][1] == 1
    assert new["a"][0] > ELO_START > new["e"][0]
    order = [b for b, _ in final_ranking([["a", "b", "c"], ["a", "c", "b"], ["b", "a", "c"]])]
    assert order[0] == "a" and order[-1] == "c"
