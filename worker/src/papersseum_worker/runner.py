"""Stand-in for the sandbox.

WARNING: runs agent code inside this process with no isolation and no time
limits. Local testing with your own bots only. The real sandbox replaces this
file; keep the two function signatures.
"""
import time

import papersseum
from papersseum import constants
from papersseum.agents import BASELINES
from papersseum.loader import load_agent_from_file
from papersseum.match import run_match
from papersseum.security.static_check import scan_file

SMOKE_DECISIONS = 200

def validate(path):
    report = scan_file(path)
    if not report["ok"]:
        first = report["violations"][0]
        return {"ok": False, "error": f'line {first["line"]}: {first["detail"]}',"violations": report["violations"]}
    try:
        agent = load_agent_from_file(path)()
        env = papersseum.PapersseumEnv(seed=7)
        obs = env.reset()
        cfg = {k: getattr(constants, k) for k in dir(constants) if k.isupper()}
        cfg.update(seed=7, pid=0)
        agent.reset(cfg)
        for _ in range(SMOKE_DECISIONS):
            action = agent.act(obs[0])
            if action not in (0, 1, 2):
                return {"ok": False, "violations": [],
                                "error": f"act() returned {action!r}; it must return 0, 1 or 2"}
            obs, _, done, _ = env.step({i: (int(action) if i == 0 else 0) for i in range(constants.N_PLAYERS)})
            if done:
                break

    except Exception as e:
         return {"ok": False, "error": f"{type(e).__name__}: {e}", "violations": []}

    return {"ok": True, "error": None, "violations": []}

def play(seed, players):
    """players: 5 dicts with "slot" and either "path" or "builtin".
    -> scores, placements, action_log, strikes, crashed (plain Python types only)"""
    agents = []
    for p in sorted(players, key=lambda p: p["slot"]):     # engine player id == slot
        cls = BASELINES[p["builtin"]] if p.get("builtin") else load_agent_from_file(p["path"])
        agents.append(cls())

    result = run_match(seed, agents)

    return {
        "scores": [{"pid": int(s["pid"]), "coverage": float(s["coverage"]),
                    "time_avg_coverage": float(s["time_avg_coverage"]),
                    "deaths": int(s["deaths"])} for s in result["scores"]],
        "placements": [int(p) for p in result["placements"]],
        "action_log": [[int(a) for a in row] for row in result["action_log"]],
        "strikes": {},     # the stand-in can't measure these; the sandbox will
        "crashed": {},
    }
