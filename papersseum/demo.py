import numpy as np
import papersseum.constants as C
from papersseum.match import run_match
from papersseum.render import render_replay_gif
from papersseum.agents.random_agent import RandomAgent
from papersseum.agents.greedy_agent import GreedyAgent
from papersseum.agents.safe_expander import SafeExpanderAgent


def mixed_lobby(seed):
    return [GreedyAgent(), SafeExpanderAgent(), GreedyAgent(), SafeExpanderAgent(), RandomAgent()]


def run_and_render(seed, out_path):
    res = run_match(seed, mixed_lobby(seed))
    render_replay_gif(seed, res["action_log"], out_path, stride=30)
    names = ["Greedy", "SafeExp", "Greedy", "SafeExp", "Random"]
    for s in sorted(res["scores"], key=lambda x: -x["coverage"]):
        print(f'{names[s["pid"]]:8s} pid={s["pid"]} coverage={s["coverage"]:.1f}% deaths={s["deaths"]}')
    print("placements:", res["placements"])
    return res


def calibration_report(n_matches=50, base_seed=0):
    finals, maxes, deaths = [], [], []
    for i in range(n_matches):
        agents = mixed_lobby(base_seed + i)
        res = run_match(base_seed + i, agents)
        cov = [s["coverage"] for s in res["scores"]]
        finals.extend(cov)
        maxes.append(max(cov))
        deaths.extend(s["deaths"] for s in res["scores"])
    return {
        "mean_final_coverage": float(np.mean(finals)),
        "max_final_coverage": float(np.max(maxes)),
        "mean_deaths": float(np.mean(deaths)),
    }
