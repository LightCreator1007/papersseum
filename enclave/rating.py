"""Leaderboard scoring for Enclave.

Two layers, matching the platform design:

* Online ladder (`Ladder`): a margin-aware pairwise rating updated after every
  match. Lively from the first game; each agent also carries an uncertainty that
  shrinks as it plays, so the board ranks by a conservative `rating - K*sigma`
  and a one-game fluke cannot top it.

* Final verdict (`fit_plackett_luce`): a batch Bradley-Terry / Plackett-Luce
  maximum-likelihood fit over the whole game record. It weighs every match
  together and estimates each agent's strength relative to the entire field,
  which is the clean answer to "who genuinely beats the most and strongest
  opponents."

Pure NumPy, no external dependencies, deterministic.
"""

import math
import numpy as np

# --- match -> blended score (placement + coverage), see PLATFORM.md section 6 ---

RANK_BONUS = [8, 6, 4, 2, 0]      # added to coverage% for 1st..5th
SIGMA_K = 2                        # conservative rating = rating - SIGMA_K * sigma


def placements_from_scores(engine_scores):
    """Return player ids best-first, using the engine tiebreak chain
    (coverage desc, time-averaged coverage desc, deaths asc, pid asc)."""
    ordered = sorted(
        engine_scores,
        key=lambda s: (-s["coverage"], -s["time_avg_coverage"], s["deaths"], s["pid"]),
    )
    return [s["pid"] for s in ordered]


def match_scores(engine_scores):
    """Blend placement and coverage into one score per player.

    `match_score = coverage% + RANK_BONUS[rank]`. The rank bonus keeps the
    finishing order dominant; the coverage term rewards a blowout over a photo
    finish. Returns {pid: blended_score}.
    """
    order = placements_from_scores(engine_scores)
    rank_of = {pid: i for i, pid in enumerate(order)}
    by_pid = {s["pid"]: s for s in engine_scores}
    out = {}
    for pid, s in by_pid.items():
        bonus = RANK_BONUS[rank_of[pid]] if rank_of[pid] < len(RANK_BONUS) else 0
        out[pid] = s["coverage"] + bonus
    return out


# --- online ladder: margin-aware pairwise Elo with shrinking uncertainty ---

ELO_START = 1000.0
ELO_K = 32.0
ELO_SCALE = 400.0          # standard Elo logistic scale
MARGIN_SCALE = 6.0         # blended-score gap that counts as a clear win
SIGMA_START = 350.0        # uncertainty (Elo units) for a brand-new agent


def _expected(ra, rb):
    return 1.0 / (1.0 + 10.0 ** ((rb - ra) / ELO_SCALE))


def _actual(sa, sb):
    """Margin-aware outcome in [0,1]: how decisively a beat b by blended score."""
    return 1.0 / (1.0 + math.exp(-(sa - sb) / MARGIN_SCALE))


class Ladder:
    """Online rating over any set of agent identities.

    Feed each match's blended scores; ratings update immediately. Rank by
    `conservative()` = rating - SIGMA_K * sigma, where sigma shrinks with games.
    """

    def __init__(self):
        self.elo = {}
        self.games = {}

    def _ensure(self, pid):
        if pid not in self.elo:
            self.elo[pid] = ELO_START
            self.games[pid] = 0

    def sigma(self, pid):
        return SIGMA_START / math.sqrt(1 + self.games.get(pid, 0))

    def conservative(self, pid):
        return self.elo[pid] - SIGMA_K * self.sigma(pid)

    def update_match(self, scores):
        """scores: {identity: blended_score} for the players in one match."""
        ids = list(scores)
        for pid in ids:
            self._ensure(pid)
        deltas = {pid: 0.0 for pid in ids}
        for i, a in enumerate(ids):
            for b in ids:
                if a is b:
                    continue
                exp = _expected(self.elo[a], self.elo[b])
                act = _actual(scores[a], scores[b])
                deltas[a] += (act - exp)
        n_opp = max(1, len(ids) - 1)
        for pid in ids:
            self.elo[pid] += ELO_K * deltas[pid] / n_opp
            self.games[pid] += 1

    def standings(self):
        """Identities ranked by conservative rating, best first."""
        rows = [
            {
                "id": pid,
                "rating": round(self.elo[pid], 1),
                "sigma": round(self.sigma(pid), 1),
                "conservative": round(self.conservative(pid), 1),
                "games": self.games[pid],
            }
            for pid in self.elo
        ]
        rows.sort(key=lambda r: -r["conservative"])
        for i, r in enumerate(rows):
            r["rank"] = i + 1
        return rows


# --- final verdict: batch Plackett-Luce / Bradley-Terry MLE (MM algorithm) ---

def fit_plackett_luce(rankings, n_players, iters=500, tol=1e-9):
    """Maximum-likelihood Plackett-Luce strengths via Hunter's MM algorithm.

    `rankings`: list of finishing orders, each a list of player ids best-first
    (subsets allowed). `n_players`: total number of distinct ids (0..n-1).
    Returns a strength vector gamma (normalized to sum = n_players); higher is
    stronger. Plackett-Luce is the multiplayer generalization of Bradley-Terry,
    so for 2-player contests this reduces to a Bradley-Terry fit.
    """
    gamma = np.ones(n_players, dtype=np.float64)
    for _ in range(iters):
        w = np.zeros(n_players)       # times each item is "chosen" (not last in a contest)
        denom = np.zeros(n_players)   # MM denominator accumulation
        for order in rankings:
            m = len(order)
            if m < 2:
                continue
            idx = np.array(order)
            g = gamma[idx]
            # suffix sums of gamma over the remaining set at each stage
            suffix = np.cumsum(g[::-1])[::-1]        # suffix[t] = sum gamma[order[t:]]
            # stages 0..m-2 each have a chosen item (order[t]); last item never chosen
            w[idx[:-1]] += 1
            inv = 1.0 / suffix[:-1]                   # 1/denominator for stages 0..m-2
            contrib = np.cumsum(inv)                  # item at pos j appears in stages 0..j
            denom[idx[:-1]] += contrib
            denom[idx[-1]] += contrib[-1]             # last item appears in every stage
        new = np.where(denom > 0, w / np.maximum(denom, 1e-300), gamma)
        s = new.sum()
        if s <= 0:
            break
        new = new / s * n_players
        if np.max(np.abs(new - gamma)) < tol:
            gamma = new
            break
        gamma = new
    return gamma


def batch_ranking(rankings, n_players, **kw):
    """Convenience: return (ordering best-first, gamma) from a batch PL fit."""
    gamma = fit_plackett_luce(rankings, n_players, **kw)
    order = sorted(range(n_players), key=lambda i: -gamma[i])
    return order, gamma


# --- calibration sim ---

def calibrate(n_matches=200, base_seed=0):
    """Run mixed-lobby matches, feed the online ladder by slot identity, and
    fit the batch Plackett-Luce verdict. Prints both rankings so RANK_BONUS,
    SIGMA_K and the margin scale can be sanity-checked against baselines."""
    from enclave.match import run_match
    import enclave.demo as d

    labels = {0: "Greedy-0", 1: "SafeExp-1", 2: "Greedy-2", 3: "SafeExp-3", 4: "Random-4"}
    ladder = Ladder()
    rankings = []
    for i in range(n_matches):
        res = run_match(base_seed + i, d.mixed_lobby(base_seed + i))
        ladder.update_match(match_scores(res["scores"]))
        rankings.append(placements_from_scores(res["scores"]))

    print(f"=== online ladder after {n_matches} matches (rating - {SIGMA_K}*sigma) ===")
    for r in ladder.standings():
        print(f'  #{r["rank"]} {labels[r["id"]]:10s} cons={r["conservative"]:7.1f} '
              f'elo={r["rating"]:7.1f} sigma={r["sigma"]:5.1f} games={r["games"]}')

    order, gamma = batch_ranking(rankings, 5)
    print("=== batch Plackett-Luce / Bradley-Terry verdict ===")
    for rank, pid in enumerate(order, 1):
        print(f'  #{rank} {labels[pid]:10s} strength={gamma[pid]:.3f}')
    return ladder, gamma
