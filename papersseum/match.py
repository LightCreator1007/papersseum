import papersseum.constants as C
from papersseum.engine import Engine
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
    """Re-run a match from its action log. Drives the engine directly, so it
    skips building observations (about half the cost of a live match)."""
    eng = Engine(seed)
    for row in action_log:
        for k in range(C.STEP_PER_DECISION):
            eng.advance_tick({p: row[p] for p in range(C.N_PLAYERS)} if k == 0 else None)
        if eng.is_over():
            break
    return {
        "seed": seed,
        "action_log": action_log,
        "scores": eng.scores(),
        "placements": eng.placements(),
        "final_owner": eng.state.owner.copy(),
    }


def iter_frames(seed, action_log):
    """Yield one frame per decision (plus the opening frame) for viewers.

    Each frame: {"tick", "owner" (int8 HxW, -1 = none), "trail" (int8 HxW),
    "heads": [(row, col) or None if dead, per slot]}. Arrays are copies, safe
    to keep. Needs no observations, so it is cheap enough for a browser.
    """
    eng = Engine(seed)

    def frame():
        st = eng.state
        return {
            "tick": st.tick,
            "owner": st.owner.copy(),
            "trail": st.trail.copy(),
            "heads": [(p.r, p.c) if p.alive else None for p in st.players],
        }

    yield frame()
    for row in action_log:
        for k in range(C.STEP_PER_DECISION):
            eng.advance_tick({p: row[p] for p in range(C.N_PLAYERS)} if k == 0 else None)
        yield frame()
        if eng.is_over():
            break
