# requires: papersseum
"""Checks the numbers quoted in the chapter 14 lesson by re-playing the trained agent.

    python check_numbers.py       # about 3 minutes

Training itself (train.py, about 35 minutes) is not repeated here; the lesson's training-curve
numbers come from training_log.txt. The agent's quality is measured on seeds 0 to 29, which
training never used (it used seeds from 1000 up).
"""

import numpy as np

import papersseum
from papersseum import BASELINES, constants as C, unpack_weights
import learned_agent as LA

FIELD_EASY = ["greedy", "safe_expander", "random", "greedy"]
FIELD_HARD = ["hunter", "hunter", "safe_expander", "greedy"]


class Untrained(LA.Agent):
    """The same network and features, but with random weights instead of trained ones."""

    def reset(self, config):
        keep, LA.WEIGHTS = LA.WEIGHTS, ""
        super().reset(config)
        LA.WEIGHTS = keep


class BestMove(LA.Agent):
    """The trained network, but always taking its most likely move instead of sampling."""

    def reset(self, config):
        super().reset(config)
        self.sample = False


def measure(agent, field, games):
    firsts, timeavg = 0, []
    for seed in range(games):
        res = papersseum.play(agent, vs=field, seed=seed)
        firsts += res["placements"][0] == 0
        timeavg.append(res["scores"][0]["time_avg_coverage"])
    return firsts, float(np.mean(timeavg))


def main():
    # --- the observation and the network
    assert C.MAP_W * C.MAP_H == 14400 and C.TOTAL_TICKS // C.STEP_PER_DECISION == 1800
    assert LA.N_FEATURES == 19 and LA.N_FEATURES * LA.HIDDEN + LA.HIDDEN + LA.HIDDEN * 3 + 3 == 371
    W = unpack_weights(LA.WEIGHTS)
    assert {k: v.shape for k, v in W.items()} == {"w1": (16, 19), "b1": (16,), "w2": (3, 16), "b2": (3,)}
    exact = np.load("learned_weights.npz")
    assert max(float(np.abs(W[k] - exact[k]).max()) for k in W) < 1e-3, "float16 packing should barely change the weights"
    assert len(LA.WEIGHTS) + 2000 < 10_000, "the whole agent file is a few kilobytes"

    # --- trained against untrained, on the field the lesson describes (30 matches, seeds 0 to 29)
    firsts, avg = measure(LA.Agent, FIELD_EASY, 30)
    base_firsts, base_avg = measure(Untrained, FIELD_EASY, 30)
    print(f"easy field: trained {firsts}/30 wins, {avg:.1f}% held; untrained {base_firsts}/30, {base_avg:.1f}%")
    assert firsts >= 17 and avg >= 25, (firsts, avg)         # 23 and 32.3 on our machine
    assert base_avg <= 15 and avg > 2 * base_avg, base_avg   # 7.6 on our machine

    # --- the finished policy plays about as well when it always takes its most likely move (it sampled while training)
    _, best_avg = measure(BestMove, FIELD_EASY, 10)
    print(f"always-best-move: {best_avg:.1f}% held")
    assert best_avg >= 15, best_avg                          # 33.1 over 10 matches on our machine; very noisy

    # --- the hand-written baselines hold far less land than the learned agent on the same field
    for name in ("greedy", "hunter"):
        _, b = measure(BASELINES[name], FIELD_EASY, 4)
        assert b < 0.75 * avg, (name, b)                    # 6 to 18 on our machine, against about 32

    # --- a harder field with two hunters
    firsts_h, avg_h = measure(LA.Agent, FIELD_HARD, 8)
    print(f"hard field: trained {firsts_h}/8 wins, {avg_h:.1f}% held")
    assert avg_h >= 14, avg_h                                # 20.1 on our machine

    print("every number in chapter 14 checks out")


if __name__ == "__main__":
    main()
