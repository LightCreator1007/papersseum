import papersseum.constants as C
from papersseum.env import PapersseumEnv


def _safe_act(agent, obs):
    try:
        a = agent.act(obs)
        return a if a in (0, 1, 2) else 0
    except Exception:
        return 0


def _config(seed, pid, weights_dir=None):
    cfg = {k: getattr(C, k) for k in dir(C) if k.isupper()}
    cfg["seed"] = seed
    cfg["pid"] = pid
    cfg["weights_dir"] = weights_dir   # folder holding the agent + its weights, or None
    return cfg


def run_match(seed, agents, weights_dirs=None):
    env = PapersseumEnv(seed)
    obs = env.reset()
    dirs = weights_dirs or [None] * len(agents)
    for pid, ag in enumerate(agents):
        ag.reset(_config(seed, pid, dirs[pid]))
    action_log = []
    done = False
    while not done:
        actions = {pid: _safe_act(agents[pid], obs[pid]) for pid in range(C.N_PLAYERS)}
        action_log.append([actions[p] for p in range(C.N_PLAYERS)])
        obs, _, done, info = env.step(actions)
    return {
        "seed": seed,
        "action_log": action_log,
        "scores": info["scores"],
        "placements": env.engine.placements(),
        "final_owner": env.engine.state.owner.copy(),
    }


def replay_match(seed, action_log):
    env = PapersseumEnv(seed)
    obs = env.reset()
    info = {"scores": env.engine.scores(), "tick": 0}
    for row in action_log:
        actions = {p: row[p] for p in range(C.N_PLAYERS)}
        obs, _, done, info = env.step(actions)
        if done:
            break
    return {
        "seed": seed,
        "action_log": action_log,
        "scores": info["scores"],
        "placements": env.engine.placements(),
        "final_owner": env.engine.state.owner.copy(),
    }
