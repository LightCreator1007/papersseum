import enclave.constants as C
from enclave.env import EnclaveEnv


def _safe_act(agent, obs):
    try:
        a = agent.act(obs)
        return a if a in (0, 1, 2) else 0
    except Exception:
        return 0


def _config(seed, pid):
    cfg = {k: getattr(C, k) for k in dir(C) if k.isupper()}
    cfg["seed"] = seed
    cfg["pid"] = pid
    return cfg


def run_match(seed, agents):
    env = EnclaveEnv(seed)
    obs = env.reset()
    for pid, ag in enumerate(agents):
        ag.reset(_config(seed, pid))
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
    env = EnclaveEnv(seed)
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
