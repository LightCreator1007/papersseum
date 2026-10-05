"""Local self-evaluation: run many matches against a field of baselines and
report how your agent does, the same signals the ladder uses.

    import papersseum
    report = papersseum.evaluate("my_agent.py", games=30)
    print(report["win_rate"], report["rating_conservative"])
"""

import statistics

import papersseum
from papersseum.rating import Ladder, match_scores, placements_from_scores, batch_ranking

# a varied field of four opponents, so you are tested against a mix, not one style
DEFAULT_FIELD = ["greedy", "safe_expander", "random", "greedy"]


def evaluate(agent, vs=None, games=30, seed0=0, on_progress=None):
    """Play `games` matches with your agent in slot 0 against `vs` (default a
    varied baseline field) over seeds seed0..seed0+games-1. Returns a report:

      games, field, placements (count of 1st..5th finishes), win_rate,
      coverage_mean/best/worst, deaths_mean,
      rating_elo, rating_conservative (online Elo vs this field),
      strength (batch Plackett-Luce strength of your agent in the field).
    """
    field = list(vs) if vs else list(DEFAULT_FIELD)
    ladder = Ladder()
    rankings = []
    placements = [0] * 5
    covs, deaths, wins = [], [], 0

    for i in range(games):
        res = papersseum.play(agent, vs=field, seed=seed0 + i)
        order = res["placements"]            # pids best-first
        my_rank = order.index(0)             # your agent is always slot 0
        placements[my_rank] += 1
        if my_rank == 0:
            wins += 1
        s0 = next(s for s in res["scores"] if s["pid"] == 0)
        covs.append(s0["coverage"])
        deaths.append(s0["deaths"])
        ladder.update_match(match_scores(res["scores"]))
        rankings.append(placements_from_scores(res["scores"]))
        if on_progress:
            on_progress(i + 1, games)

    _, gamma = batch_ranking(rankings, 5)
    return {
        "games": games,
        "field": field,
        "placements": placements,
        "win_rate": wins / games,
        "coverage_mean": statistics.mean(covs),
        "coverage_best": max(covs),
        "coverage_worst": min(covs),
        "deaths_mean": statistics.mean(deaths),
        "rating_elo": ladder.elo[0],
        "rating_conservative": ladder.conservative(0),
        "strength": float(gamma[0]),
    }
